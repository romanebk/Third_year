# Summary: how authentication was implemented

## Overview

The application handles authentication with a single system based on NextAuth.js, covering:

- email/password authentication
- GitHub OAuth authentication
- Google OAuth authentication

The important point is that all these methods share the same NextAuth session and the same security logic, avoiding multiple disconnected auth systems.

## Key files

- `backend/src/server/auth/auth.ts`: global configuration of providers and NextAuth callbacks
- `backend/src/lib/db.ts`: Prisma database access
- `backend/src/server/auth/encrypted-adapter.ts`: Prisma adapter with encrypted OAuth tokens
- `frontend/src/components/ui/login-16.tsx`: login screen on the frontend
- `frontend/src/app/api/[...path]/route.ts`: frontend-to-backend proxy, necessary to maintain a single public entry point

## 1) Email/password authentication

Email/password login is declared in `auth.ts` using `CredentialsProvider`.

The flow is as follows:

1. the user enters an email and password
2. the frontend calls `signIn("credentials", { email, password, callbackUrl: "/dashboard" })`
3. the `authorize()` method checks:
   - whether the email exists in the database
   - whether the account has a `passwordHash`
   - whether the password matches via `bcrypt.compare()`
   - whether the account has been confirmed (`emailVerified`)
   - whether the account is not disabled (`disabled`)
4. if everything is valid, the user is connected through the NextAuth session

The errors are standardized to avoid leaking too much information:

- `InvalidCredentials`
- `EmailNotVerified`
- `AccountDisabled`

## 2) GitHub OAuth

GitHub is enabled conditionally if the following variables are present:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

In `auth.ts`:

```ts
if (githubClientId && githubClientSecret) {
  providers.push(
    GitHubProvider({ ... })
  );
}
```

### What it does

- redirects the user to the GitHub authorization page
- retrieves the GitHub profile
- automatically links the GitHub account to an existing account with the same email
- creates the NextAuth session on the backend

### GitHub email handling

This is an important point: some GitHub accounts do not expose a public email directly.

To fix this, the code:

- requests the scope `read:user user:email security_events`
- then calls `https://api.github.com/user/emails`
- looks for a verified primary email

This avoids a bug where a GitHub user without a public email could not create an account properly.

### OAuth and security

The project uses `allowDangerousEmailAccountLinking: true` for GitHub and Google to automatically link the OAuth account to an existing user with the same email.

This is intentional and justified in the code: the providers verify the emails they expose, so the risk is considered acceptable.

## 3) Google OAuth

Google follows the same pattern: it is enabled only if:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The code is in `auth.ts`:

```ts
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({ ... })
  );
}
```

### Special points

Google normally returns a verified email through the default scope (`openid email profile`), so no extra workaround is needed like in the GitHub case.

The provider is also configured with `allowDangerousEmailAccountLinking: true` to allow automatic linking to an existing account that uses the same email.

## 4) NextAuth session

The project uses:

```ts
session: { strategy: "jwt" }
```

This means the session is managed via JWTs signed on the backend, with validation in the `jwt()` callback.

### Why this matters

In `jwt()`, the app performs a database check for:

- the user role (`role`)
- the disabled status (`disabled`)

So even after login, if an account is disabled, the session is invalidated on the next request.

### `session()` callback

The `session()` callback also adds:

- `session.user.id`
- `session.user.role`
- `session.user.email`
- `session.user.name`
- `session.user.image`

This allows the API routes to know which user is connected without the frontend needing to resend extra state.

## 5) OAuth accounts created automatically

Accounts created through GitHub or Google pass through the Prisma adapter and are later marked with:

```ts
emailVerified: new Date()
```

The `createUser` event is used to correct the fact that NextAuth sometimes forces `emailVerified` to `null` when creating an OAuth account.

This makes the behavior consistent with traditional email/password accounts.

## 6) Disabled account handling

The system checks disabled accounts at two levels:

- during `signIn()`
- in the `jwt()` callback on each request

If an account is disabled, the session is neutralized and the user can no longer access protected pages.

## 7) OAuth buttons in the frontend

In `frontend/src/components/ui/login-16.tsx`, OAuth buttons are triggered via `next-auth/react`:

- `signIn("github", { callbackUrl: "/dashboard" })`
- `signIn("google", { callbackUrl: "/dashboard" })`

The component also displays a useful message if a provider is not configured:

- `GITHUB_CLIENT_ID/SECRET`
- `GOOGLE_CLIENT_ID/SECRET`

## 8) Required configuration

Providers are enabled only if the environment variables are correctly set.

### Local mode

The local backend typically expects:

- `NEXTAUTH_URL="http://localhost:3001"`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GITHUB_CLIENT_ID=...`
- `GITHUB_CLIENT_SECRET=...`

### Docker mode

Because the frontend is exposed on port `:8080`, the public callback URLs are instead:

- `http://localhost:8080/api/auth/callback/google`
- `http://localhost:8080/api/auth/callback/github`

## 9) Why the project was designed this way

The choice of NextAuth + a single provider system is useful because it allows:

- one consistent session system
- mixing email accounts and OAuth accounts without duplication
- proper security checks for disabled accounts
- one common middleware for protected routes
- automatic linking of third-party accounts when the email matches

## Conclusion

The login system of this project was designed as a unified NextAuth session system with:

- `CredentialsProvider` for classic email/password login
- `GitHubProvider` for GitHub OAuth
- `GoogleProvider` for Google OAuth
- security callbacks (`jwt`, `session`, `signIn`, `createUser`)
- Prisma adapter for storing accounts and OAuth links

This is a clear, consistent, and extensible architecture, and it is exactly what you want for a dashboard with multiple authentication modes.
