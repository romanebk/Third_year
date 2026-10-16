import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authOptions } from "@/server/auth/auth";
import { decryptToken } from "@/server/auth/token-encryption";
import { getServiceByName, oauthProviderIdForService } from "@/server/services";

// DELETE /api/services/[name]/link — délie le compte tiers (GitHub)
// de l'utilisateur connecté : supprime la ligne Account, donc les tokens
// chiffrés. La souscription et les instances de widgets sont conservées — les
// widgets GitHub publics retombent sur l'accès anonyme, ceux qui exigent un
// compte (security alerts) affichent "requires a linked account".
//
// 200 { linked: false } ; 401 sans session ; 404 service inconnu ou non
// OAuth ; 409 si ce compte est le dernier moyen de connexion de l'utilisateur.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  // Services "oauth" : la ligne Account est rangée sous l'id du provider
  // NextAuth, qui peut différer du nom du service (google-calendar partage
  // le provider "google"). Délier google-calendar supprime donc aussi la
  // connexion Google (même ligne, mêmes tokens) — le garde 409 ci-dessous
  // empêche au moins de se verrouiller dehors.
  const provider = oauthProviderIdForService(name);
  if (getServiceByName(name)?.auth !== "oauth") {
    return NextResponse.json({ error: "service not found" }, { status: 404 });
  }

  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, provider: true, access_token: true },
    }),
  ]);
  const account = accounts.find((candidate) => candidate.provider === provider);
  if (!account) {
    return NextResponse.json({ linked: false });
  }

  // Un compte créé via GitHub n'a pas de mot de passe : lui retirer son seul
  // compte OAuth le rendrait impossible à reconnecter.
  if (!user?.passwordHash && accounts.length === 1) {
    return NextResponse.json(
      { error: `${name} is your only sign-in method — link another account or set a password first` },
      { status: 409 },
    );
  }

  await prisma.account.delete({ where: { id: account.id } });
  if (provider === "github" && account.access_token) {
    await revokeGithubGrant(account.access_token);
  }

  return NextResponse.json({ linked: false });
}

// Révoque l'autorisation côté GitHub (l'app disparaît des "Authorized OAuth
// Apps" de l'utilisateur, tous ses tokens deviennent invalides) — sinon
// délier ne ferait qu'oublier le token chez nous. Best-effort : le compte est
// déjà délié en base, un échec ici est loggé sans faire échouer la requête.
async function revokeGithubGrant(encryptedAccessToken: string): Promise<void> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  try {
    const response = await fetch(`https://api.github.com/applications/${clientId}/grant`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: decryptToken(encryptedAccessToken) }),
      signal: AbortSignal.timeout(8000),
    });
    // 204 révoqué ; 404/422 token déjà expiré ou révoqué — rien de plus à faire.
    if (!response.ok && response.status !== 404 && response.status !== 422) {
      console.error(`[services] GitHub grant revocation responded with status ${response.status}`);
    }
  } catch (error) {
    console.error("[services] GitHub grant revocation failed:", error);
  }
}
