# Résumé : comment la connexion a été faite

## Vue d’ensemble

L’application gère l’authentification avec un système unique basé sur NextAuth.js, qui couvre à la fois :

- l’authentification par email/mot de passe
- l’authentification OAuth GitHub
- l’authentification OAuth Google

Le point important est que tous ces modes partagent la même session NextAuth et la même logique de sécurité, ce qui évite d’avoir plusieurs systèmes d’auth dissociés.

## Fichiers clés

- `backend/src/server/auth/auth.ts` : configuration globale des providers et callbacks NextAuth
- `backend/src/lib/db.ts` : accès Prisma / base de données
- `backend/src/server/auth/encrypted-adapter.ts` : adapter Prisma avec chiffrement des tokens OAuth
- `frontend/src/components/ui/login-16.tsx` : écran de login côté UI
- `frontend/src/app/api/[...path]/route.ts` : proxy du frontend vers le backend, nécessaire pour garder un seul point d’entrée public

## 1) Authentification par email / mot de passe

La connexion par email et mot de passe est déclarée dans `auth.ts` via `CredentialsProvider`.

Le flux est le suivant :

1. l’utilisateur remplit son email + mot de passe
2. le front appelle `signIn("credentials", { email, password, callbackUrl: "/dashboard" })`
3. le provider `authorize()` vérifie :
   - l’email existe en base
   - le compte a un `passwordHash`
   - le mot de passe correspond via `bcrypt.compare()`
   - le compte a bien été confirmé (`emailVerified`)
   - le compte n’est pas désactivé (`disabled`)
4. si tout est bon, l’utilisateur est connecté via la session NextAuth

Les erreurs sont standardisées pour ne pas exposer trop d’informations :

- `InvalidCredentials`
- `EmailNotVerified`
- `AccountDisabled`

## 2) OAuth GitHub

GitHub est activé conditionnellement si les variables suivantes sont présentes :

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Dans `auth.ts` :

```ts
if (githubClientId && githubClientSecret) {
  providers.push(
    GitHubProvider({ ... })
  );
}
```

### Ce qu’il fait

- redirige l’utilisateur vers la page d’autorisation GitHub
- récupère le profil GitHub
- relie automatiquement le compte GitHub à un compte existant ayant le même email
- crée la session NextAuth côté backend

### Gestion des emails GitHub

C’est un point important : certains comptes GitHub n’exposent pas directement un email public.

Pour corriger ça, le code :

- demande le scope `read:user user:email security_events`
- appelle ensuite `https://api.github.com/user/emails`
- cherche un email vérifié et principal

Cela évite un bug où un utilisateur GitHub sans email public ne pouvait pas créer de compte correctement.

### OAuth et sécurité

Le projet utilise `allowDangerousEmailAccountLinking: true` pour GitHub et Google afin de relier automatiquement le compte OAuth à un utilisateur existant partageant le même email.

Cela est volontaire et justifié dans le code : les providers vérifient les emails qu’ils exposent, donc le risque est considéré comme acceptable.

## 3) OAuth Google

Google suit le même modèle : il est activé seulement si :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Le code est dans `auth.ts` :

```ts
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({ ... })
  );
}
```

### Points spéciaux

Google renvoie normalement un email vérifié via le scope par défaut (`openid email profile`), donc pas besoin d’un mécanisme supplémentaire comme pour GitHub.

Le provider est aussi configuré avec `allowDangerousEmailAccountLinking: true` pour permettre la liaison automatique à un compte déjà existant avec le même email.

## 4) Session NextAuth

Le projet utilise :

```ts
session: { strategy: "jwt" }
```

Cela signifie que la session est gérée par des JWT signés côté backend, avec une vérification côté callback `jwt()`.

### Pourquoi c’est important

Dans `jwt()` le projet refait une vérification en base :

- le rôle utilisateur (`role`)
- le statut `disabled`

Donc même si un compte est désactivé après connexion, la session est invalidée à la prochaine requête.

### `session()` callback

Le callback `session()` ajoute aussi :

- `session.user.id`
- `session.user.role`
- `session.user.email`
- `session.user.name`
- `session.user.image`

Cela permet ensuite aux routes API de savoir qui est l’utilisateur connecté sans avoir à re-questionner le frontend.

## 5) Les comptes OAuth créés automatiquement

Les comptes créés via GitHub ou Google passent par l’adapter Prisma et sont ensuite marqués avec :

```ts
emailVerified: new Date()
```

Le callback `createUser` est utilisé pour corriger le fait que NextAuth force parfois `emailVerified` à `null` lors de la création d’un compte OAuth.

Cela rend le comportement cohérent avec les comptes classiques.

## 6) Gestion des comptes désactivés

Le système vérifie les comptes désactivés à deux niveaux :

- au moment du `signIn()`
- dans le callback `jwt()` à chaque requête

Si un compte est désactivé, la session est neutralisée et l’utilisateur ne peut plus accéder aux pages protégées.

## 7) Le bouton OAuth dans le front

Dans `frontend/src/components/ui/login-16.tsx`, les boutons OAuth sont activés via `next-auth/react` :

- `signIn("github", { callbackUrl: "/dashboard" })`
- `signIn("google", { callbackUrl: "/dashboard" })`

Le composant affiche aussi un message utile si le provider n’est pas configuré :

- `GITHUB_CLIENT_ID/SECRET`
- `GOOGLE_CLIENT_ID/SECRET`

## 8) Configuration nécessaire

Les providers sont activés seulement si les variables d’environnement sont correctement définies.

### Mode local

Le backend local attend généralement :

- `NEXTAUTH_URL="http://localhost:3001"`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GITHUB_CLIENT_ID=...`
- `GITHUB_CLIENT_SECRET=...`

### Mode Docker

Le frontend est exposé sur `:8080`, donc le callback public est plutôt :

- `http://localhost:8080/api/auth/callback/google`
- `http://localhost:8080/api/auth/callback/github`

## 9) Pourquoi le projet a été pensé ainsi

Le choix de NextAuth + provider unique est très utile parce qu’il permet :

- d’avoir un seul système de session
- de mélanger comptes email et OAuth sans duplication
- de sécuriser correctement les comptes désactivés
- de gérer le même middleware d’accès aux routes protégées
- de relier automatiquement des comptes tiers à un même utilisateur si l’email correspond

## Conclusion

La connexion de ce projet a été conçue comme un système unifié de session NextAuth, avec :

- `CredentialsProvider` pour le login classique
- `GitHubProvider` pour GitHub OAuth
- `GoogleProvider` pour Google OAuth
- callbacks de sécurité (`jwt`, `session`, `signIn`, `createUser`)
- adapter Prisma pour stocker les comptes et les liens OAuth

C’est une architecture claire, cohérente et extensible, et c’est exactement ce qu’on veut pour un dashboard avec plusieurs modes de connexion.
