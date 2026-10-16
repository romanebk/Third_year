import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import {
  createEncryptedPrismaAdapter,
  refreshStoredAccountTokens,
} from "@/server/auth/encrypted-adapter";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Où renvoyer l'utilisateur quand une liaison échoue côté application : la page
// services (qui lit link_error), pas /login — il est déjà connecté.
const LINK_ERROR_REDIRECT = "/services?link_error=";

// Login email/mdp branché ici (et pas sur une route /api/auth/login séparée) pour que
// credentials et OAuth partagent la même session NextAuth — indispensable pour le
// middleware de protection du dashboard et la liaison de compte tiers à venir cet
// après-midi : un seul système d'auth à vérifier, pas deux qui s'ignorent.
const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      // Même message que le mot de passe soit faux, le compte inexistant, ou le compte
      // créé uniquement via OAuth (pas de passwordHash) : dans les trois cas, le login
      // par mot de passe ne doit pas pouvoir fonctionner ni révéler lequel c'est.
      if (!user || !user.passwordHash) throw new Error("InvalidCredentials");

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) throw new Error("InvalidCredentials");

      // Bloque les comptes créés mais jamais confirmés (cf. POST /api/auth/register
      // + /api/auth/confirm) — un message distinct ici est utile, pas sensible : ça
      // n'apprend rien de plus que ce que /register révèle déjà (409 si email pris).
      if (!user.emailVerified) throw new Error("EmailNotVerified");

      // Compte désactivé par un admin (section admin, cf. PATCH /api/users/[id]) —
      // bloqué ici pour un message clair à la connexion ; le callback jwt() revérifie
      // aussi ce champ à chaque requête pour couvrir les sessions déjà ouvertes.
      if (user.disabled) throw new Error("AccountDisabled");

      return { id: user.id, email: user.email };
    },
  }),
];

if (githubClientId && githubClientSecret) {
  providers.push(
    GitHubProvider({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      // Scope par défaut du provider (read:user user:email) + security_events,
      // requis par l'API Dependabot Alerts utilisée par github_security_alerts
      // (backend/src/server/services/github/fetch.ts) — sans lui, cet appel
      // échoue systématiquement en 403 "insufficient permissions", quel que
      // soit le repo, car le token n'a jamais eu ce droit. Un compte déjà lié
      // avant ce changement doit se reconnecter pour obtenir un token avec le
      // nouveau scope (pas rétroactif).
      authorization: { params: { scope: "read:user user:email security_events" } },
      // Le client HTTP d'openid-client (utilisé par NextAuth pour l'échange
      // code→tokens et le profil) coupe à 3500 ms par défaut : trop juste
      // quand le DNS sortant du conteneur est lent (VPN hôte, premier appel
      // sans cache), ce qui faisait échouer le callback en
      // OAUTH_CALLBACK_ERROR alors que le provider répondait. 10 s : même
      // ordre de grandeur que les timeouts des fetchers de widgets (8 s).
      httpOptions: { timeout: 10000 },
      // Lie automatiquement ce compte GitHub à un User existant ayant le même email,
      // au lieu de bloquer avec OAuthAccountNotLinked (comportement par défaut de
      // NextAuth, pensé pour éviter qu'un attaquant s'approprie un compte existant
      // via un provider qui ne vérifie pas les emails). Défendable spécifiquement
      // avec GitHub, qui vérifie les emails qu'il expose via son API — décision
      // discutée et assumée, pas un oubli.
      allowDangerousEmailAccountLinking: true,
      async profile(profile, tokens) {
        // profile.email (venant de GET /user) est null tant que le compte n'a
        // pas explicitement un email public — réglage désactivé par défaut
        // chez la plupart des utilisateurs GitHub. User.email est requis en
        // base (unique, non nul), donc la création du compte plantait pour
        // quiconque n'avait pas cet email public. Le scope user:email (déjà
        // demandé par défaut par ce provider) donne accès à /user/emails,
        // qui liste aussi les emails privés mais vérifiés — on va y chercher
        // l'email primaire vérifié à la place quand /user n'en donne pas.
        let email = profile.email;
        if (!email) {
          try {
            const response = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/vnd.github+json",
              },
            });
            if (response.ok) {
              const emails = (await response.json()) as Array<{
                email: string;
                primary: boolean;
                verified: boolean;
              }>;
              email =
                emails.find((e) => e.primary && e.verified)?.email ??
                emails.find((e) => e.verified)?.email ??
                null;
            }
          } catch {
            // /user/emails injoignable : email reste null, la création du
            // compte échouera plus loin avec une erreur claire côté NextAuth
            // plutôt que de planter ici silencieusement.
          }
        }

        // emailVerified mis ici n'a aucun effet : le core NextAuth (callback-handler.js)
        // écrase toujours emailVerified à null à la création d'un user OAuth, quoi que
        // profile() renvoie. Le vrai fix est dans events.createUser ci-dessous.
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email,
          image: profile.avatar_url,
        };
      },
    }),
  );
}

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // Même raisonnement que pour GitHub (cf. plus haut) : Google vérifie les
      // emails qu'il expose. Contrairement à GitHub, Google renvoie toujours un
      // email (le scope par défaut "openid email profile" l'exige et Google
      // n'a pas d'équivalent "email privé" masquant le champ) — pas besoin du
      // même repli via une seconde requête API.
      // Scope Calendar ajouté pour le service google-calendar (prochains rendez-vous,
      // agenda du jour). Les comptes déjà liés doivent se reconnecter pour obtenir
      // un token avec ce scope (pas rétroactif).
      authorization: { params: { scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly" } },
      // Même raison que pour GitHub ci-dessus : le timeout HTTP par défaut
      // (3500 ms) faisait échouer le callback sur un réseau sortant lent.
      httpOptions: { timeout: 10000 },
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// Providers OAuth réellement enregistrés (variables d'environnement présentes)
// — lu par GET /api/services pour désactiver le bouton "Connect" d'un service
// dont le serveur n'a pas les credentials, plutôt que d'envoyer l'utilisateur
// vers une page d'erreur NextAuth.
export function isOAuthProviderConfigured(providerId: string): boolean {
  return providers.some((provider) => provider.id === providerId && provider.type === "oauth");
}

export const authOptions: NextAuthOptions = {
  adapter: createEncryptedPrismaAdapter(),
  providers,
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    // Seuls les providers OAuth (GitHub, Google) créent des users via l'adapter
    // ici (credentials passe par /api/auth/register, pas par l'adapter) — donc
    // tout user créé ici vient d'un provider dont l'email est déjà vérifié.
    // Corrige ce que NextAuth force à null à la création (cf. commentaire sur
    // profile() du provider GitHub plus haut). termsAcceptedAt : les boutons
    // GitHub/Google des pages de connexion et d'inscription indiquent qu'en
    // continuant, l'utilisateur accepte les Conditions et la Politique de
    // confidentialité (l'inscription les exige déjà avant d'activer ces boutons).
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date(), termsAcceptedAt: new Date() },
      });
    },
    // Chaque autorisation OAuth réussie (liaison depuis /services ou connexion)
    // réécrit les tokens stockés — cf. refreshStoredAccountTokens.
    async signIn({ account }) {
      if (account) await refreshStoredAccountTokens(account);
    },
  },
  callbacks: {
    // Rejette la connexion GitHub d'un compte désactivé — authorize() ne couvre que
    // credentials, ce callback couvre les deux providers puisqu'il s'exécute après
    // n'importe lequel des deux (user vient de l'adapter pour GitHub, donc a déjà
    // `disabled` en base, pas besoin de requête supplémentaire).
    async signIn({ user, account }) {
      if ((user as { disabled?: boolean }).disabled) {
        return "/login?error=AccountDisabled";
      }
      if (account?.type !== "oauth") return true;

      // Utilisateur déjà connecté = liaison d'un compte tiers depuis /services :
      // NextAuth rattache alors le compte OAuth à CET utilisateur (cf.
      // callback-handler de next-auth), quel que soit l'email du compte tiers.
      // Le rappel s'exécute dans la route /api/auth/[...nextauth], donc le
      // cookie de session du navigateur est lisible ici.
      const session = await getServerSession(authOptions);
      const currentUserId = session?.user?.id;

      if (!currentUserId) return true;

      // Compte tiers déjà rattaché à un AUTRE utilisateur Hubly : NextAuth
      // lèverait OAuthAccountNotLinked et renverrait vers /login — refusé ici
      // pour renvoyer vers /services avec un message explicite, sans jamais
      // basculer la session vers l'autre compte.
      const existing = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        select: { userId: true },
      });
      if (existing && existing.userId !== currentUserId) {
        return `${LINK_ERROR_REDIRECT}AccountLinkedElsewhere`;
      }
      return true;
    },
    // Revérifie le rôle et le statut désactivé en base à chaque requête serveur
    // (getServerSession appelle jwt() avant session(), pas seulement à la connexion)
    // — permet à un admin de désactiver un compte ou changer un rôle avec effet
    // quasi immédiat, sans attendre l'expiration naturelle du JWT.
    async jwt({ token }) {
      if (!token.sub) return token;
      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { role: true, disabled: true },
      });
      if (!dbUser || dbUser.disabled) {
        // Vide l'identité plutôt que de renvoyer le token tel quel : session() ne
        // pourra alors plus exposer session.user.id, donc tout `if (!session?.user?.id)`
        // existant (API /api/dashboard, etc.) traite l'utilisateur comme déconnecté.
        return { ...token, sub: undefined, role: undefined };
      }
      token.role = dbUser.role;
      return token;
    },
    // Expose l'email/nom du provider GitHub dans la session, + l'id DB (token.sub
    // = adapter User.id par défaut pour credentials ET oauth, pas l'id du provider)
    // — nécessaire pour retrouver le compte tiers lié (Account.userId) d'un widget.
    async session({ session, token }) {
      if (!token.sub) {
        // token vidé par jwt() (compte désactivé/supprimé) : ne pas exposer un user
        // "à moitié" avec un id manquant, sinon session?.user?.id mentirait sur l'état.
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.image = (token.picture as string | undefined) ?? session.user.image;
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },
};