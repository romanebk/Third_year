import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import { WidgetValidationError } from "@/server/widgets/errors";

// Garde SSRF pour tout fetcher qui appelle une URL fournie par l'utilisateur
// (aujourd'hui : rss_article_list. weather/github/steam construisent toujours
// l'URL eux-mêmes vers un host fixe, donc ne sont pas concernés). Sans ça,
// rss_article_list laisserait n'importe quel utilisateur connecté faire faire
// au serveur une requête HTTP arbitraire vers n'importe quelle adresse, y
// compris le réseau interne Docker (db:5432, backend:3002...) : un SSRF
// classique.
//
// Résout le host en DNS et rejette toute IP privée/loopback/link-local plutôt
// que de filtrer sur le nom d'host (contournable par DNS rebinding). Suit les
// redirections manuellement (max 3 sauts) en revalidant chaque cible, puisque
// fetch() suivrait sinon une redirection vers une IP interne sans repasser
// par ce contrôle.

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (couvre le bridge Docker par défaut)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (dont 169.254.169.254, métadonnées cloud)
    if (a === 0) return true; // 0.0.0.0/8
    // Plages manquantes trouvées lors d'un audit de sécurité :
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 224) return true; // 224.0.0.0/8 (multicast — 224.0.0.0/4 complet serait a 224-239, mais 225-239 n'a pas d'usage réseau local pertinent ici)
    if (a >= 240) return true; // 240.0.0.0/4 (réservé) + 255.255.255.255 (broadcast)
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower === "::") return true; // non spécifiée
    if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA (équivalent RFC1918 en v6)
    if (lower.startsWith("ff")) return true; // multicast (ff00::/8) — trouvé manquant lors d'un audit de sécurité
    if (lower.startsWith("::ffff:")) return isPrivateOrReservedIp(lower.replace("::ffff:", "")); // IPv4-mapped
    return false;
  }
  return true; // ni v4 ni v6 reconnu : rejette par prudence
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WidgetValidationError("feed_url must use http(s)");
  }

  // url.hostname garde les crochets pour une IPv6 littérale (ex: "[::1]") —
  // isIP() ne les reconnaît jamais avec, donc ce cas retombait toujours sur
  // lookup() (échec de résolution DNS, pas le blocage explicite attendu du
  // blocklist) au lieu d'être traité comme littéral. Trouvé lors de la
  // vérification du fix ci-dessus.
  const bareHostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalIp = isIP(bareHostname) ? bareHostname : null;
  const addresses = literalIp
    ? [literalIp]
    : await lookup(url.hostname, { all: true }).then(
        (results) => results.map((r) => r.address),
        () => {
          throw new WidgetValidationError(`could not resolve host: ${url.hostname}`);
        },
      );

  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) {
    throw new WidgetValidationError("feed_url points to a non-public address");
  }
}

// Risque résiduel connu (trouvé lors d'un audit de sécurité, assumé pour
// l'instant) : fetch() ci-dessous re-résout lui-même url.hostname en interne
// (undici) au lieu d'utiliser l'IP déjà validée par assertPublicHost —
// fenêtre de DNS-rebinding étroite (le serveur DNS de l'attaquant doit
// changer sa réponse entre les deux résolutions, dans le temps d'une seule
// requête). Fermer complètement ce TOCTOU demanderait d'épingler l'IP validée
// via un dispatcher undici personnalisé (nouvelle dépendance, code réseau bas
// niveau) — jugé disproportionné pour ce projet vu la fenêtre d'exploitation
// déjà étroite. fetch() avec suivi manuel des redirections, chaque cible
// revalidée avant d'être suivie — sinon un serveur distant "propre" pourrait
// rediriger vers une IP interne et contourner le contrôle initial.
export async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  let current = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(current);
    // Sans timeout, un flux RSS qui ne répond jamais bloque indéfiniment la
    // requête entrante avec lui — un fournisseur passe déjà son propre
    // AbortSignal (headers), il n'y en avait pas ici avant.
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      current = new URL(response.headers.get("location")!, current);
      continue;
    }
    return response;
  }
  throw new WidgetValidationError("too many redirects");
}
