import type { ServiceInfo } from "@/types";
import { decryptToken } from "@/server/auth/token-encryption";

import { cryptoService } from "./crypto";
import { devisesService } from "./devises";
import { githubService } from "./github";
import { googleCalendarService } from "./google-calendar";
import { holidaysService } from "./holidays";
import { ipgeoService } from "./ipgeo";
import { mapsService } from "./maps";
import { nasaService } from "./nasa";
import { rssService } from "./rss";
import { steamService } from "./steam";
import { universitiesService } from "./universities";
import { weatherService } from "./weather";
import { wikipediaService } from "./wikipedia";
import { youtubeService } from "./youtube";

// Registre global des services supportés.
// Ajouter un service = créer son module dans ce dossier puis l'ajouter ici.
export const services: ServiceInfo[] = [
  githubService,
  googleCalendarService,
  holidaysService,
  ipgeoService,
  nasaService,
  steamService,
  universitiesService,
  weatherService,
  rssService,
  cryptoService,
  mapsService,
  devisesService,
  wikipediaService,
  youtubeService,
];

export function getServiceByName(name: string): ServiceInfo | undefined {
  return services.find((service) => service.name === name);
}

// Id du provider NextAuth correspondant à un service OAuth. La plupart du
// temps c'est le nom du service lui-même (github), sauf quand un service lit
// les données d'un provider partagé : google-calendar utilise le compte
// Google (même ligne Account, même token avec le scope calendar.readonly).
const OAUTH_PROVIDER_ID_BY_SERVICE: Record<string, string> = {
  "google-calendar": "google",
};

export function oauthProviderIdForService(serviceName: string): string {
  return OAUTH_PROVIDER_ID_BY_SERVICE[serviceName] ?? serviceName;
}

// Une ligne Account ne vaut liaison que si son token se déchiffre : après
// une régénération des secrets, les lignes périmées restent en base mais ne
// doivent plus être présentées comme liées — sinon le frontend souscrirait
// directement sans consentement, avec un token inutilisable (pictogramme
// "lié" mais widgets en erreur). Testé dans oauth-providers.test.ts.
export function isAccountLinkUsable(account: { access_token: string | null }): boolean {
  if (!account.access_token) return false;
  try {
    decryptToken(account.access_token);
    return true;
  } catch {
    return false;
  }
}