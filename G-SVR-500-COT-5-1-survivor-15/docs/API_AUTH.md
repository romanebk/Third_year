# Module Auth, Contrat API & usage

Responsable : feature/auth. Ce module fournit **l'authentification JWT**, la **gestion des comptes** (`/users/me`) et le **consentement géolocalisation** (RGPD).

- Base URL : `http://localhost:3000` (proxy front → `http://localhost:5173/api`)
- Format erreurs : `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }`
- Codes : `VALIDATION_ERROR` (400) · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `INTERNAL_ERROR` (500)

---

## 1. Authentification

Tous les endpoints `/auth/*` sont **publics**.

### POST /api/auth/register, créer un compte

```bash
# Chercheur, prénom + nom persistés dans le profil
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"camille.durand@exemple.fr","password":"P4ssWord!","role":"JOBSEEKER","firstName":"Camille","lastName":"Durand"}'

# Employeur, nom d'entreprise persisté
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"contact@douka.fr","password":"P4ssWord!","role":"EMPLOYER","companyName":"Douka Studio"}'
```

Réponse `201`, ouverture directe de session :

```json
{
  "accessToken": "eyJb...",
  "refreshToken": "eyJb...",
  "user": { "id": "uuid", "email": "camille.durand@exemple.fr", "role": "JOBSEEKER",
            "geoConsent": false, "firstName": "Camille", "lastName": "Durand" }
}
```

Erreurs : `409` email déjà pris · `400` mot de passe < 8 caractères / email invalide.

### POST /api/auth/login, se connecter

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"camille.durand@exemple.fr","password":"P4ssWord!"}'
```

Réponse `200` : même forme que register. Erreurs : `401` email/mot de passe incorrect, `403` compte suspendu.

### POST /api/auth/refresh, renouveler les tokens

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"eyJb..."}'
```

Réponse `200` : nouveaux `accessToken` + `refreshToken` (**rotation** : l'ancien refresh token est immédiatement révoqué). Erreurs : `401` session expirée/révoquée.

### POST /api/auth/logout, se déconnecter

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"eyJb..."}'
```

Réponse `204` (révoque la session côté serveur).

---

### POST /api/auth/forgot-password, demander un lien de réinitialisation

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@exemple.fr"}'
```

- **Anti-énumération** : renvoie toujours `200 {}` (l'email existe ou non), on ne révèle pas si le compte existe.
- **Dev** : pas d'infra email ; si le compte existe, la réponse contient `{ "resetToken": "..." }` (JWT valable 15 min) à récupérer dans la réponse réseau et à coller dans `/reset-password?token=...`. En prod, ce token serait envoyé par email.

### POST /api/auth/reset-password, réinitialiser le mot de passe

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"eyJ...","password":"NouveauMdp1"}'
```

- Valide le token de reset (15 min), met à jour le hash du mot de passe et **révoque toutes les sessions** actives de l'utilisateur.
- Réponse `200` `{ "message": "Mot de passe réinitialisé" }` ; `401` si le token est invalide/expiré.

---

## 2. Compte utilisateur, routes protégées

Toutes les routes `/users/*` exigent l'en-tête `Authorization: Bearer <accessToken>` (sinon `401`).

### GET /api/users/me, profil du compte connecté

```bash
curl http://localhost:3000/api/users/me \
  -H 'Authorization: Bearer <accessToken>'
```

Réponse `200`, `profile.type` = `JOBSEEKER` | `EMPLOYER` | `NONE` :

```json
{
  "id": "uuid", "email": "camille.durand@exemple.fr", "role": "JOBSEEKER",
  "isSuspended": false, "geoConsent": false, "createdAt": "2026-09-01T00:00:00.000Z",
  "profile": { "type": "JOBSEEKER", "data": { "firstName": "Camille", "lastName": "Durand", ... } }
}
```

### PATCH /api/users/me, modifier email / mot de passe / identité

```bash
curl -X PATCH http://localhost:3000/api/users/me \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{"firstName":"Camille","lastName":"Durand"}'

# Exemples de body : {"email":"nouveau@exemple.fr"} · {"password":"NouveauP4ss"} ·
# {"firstName":"Camille","lastName":"Durand"} · {"companyName":"Douka Studio"}
```

Réponse `200` : même forme que GET /me. Erreurs : `400` aucun champ / champ invalide · `409` email déjà pris.

> Les champs `firstName`/`lastName` créent/mettent à jour le `JobseekerProfile` ; `companyName` fait de même pour le `EmployerProfile`.

### PUT /api/users/me/geo-consent, consentement géolocalisation (RGPD)

```bash
curl -X PUT http://localhost:3000/api/users/me/geo-consent \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{"geoConsent":true}'   # true ou false
```

Réponse `204`. Erreurs : `400` valeur non booléenne.

### DELETE /api/users/me, supprimer son compte (RGPD)

```bash
curl -X DELETE http://localhost:3000/api/users/me \
  -H 'Authorization: Bearer <accessToken>'
```

Réponse `204`. **Soft delete** : compte archivé (`deletedAt`), sessions purgées, candidatures/messages conservés pour l'audit. L'email reste réservé par le compte archivé (`409` à la ré-inscription), à confirmer avec le lead si l'on veut lever cette contrainte.

---

## 3. Pour les modules 2, 3 et 4, protéger vos routes

Le middleware est dans `backend/src/middleware/` et **disponible dès maintenant** sur `develop` via la PR feature/auth.

```ts
import { authenticate, optionalAuth } from '../middleware/auth';
import { requireRoles, requireEmployer, requireJobseeker, requireAdmin } from '../middleware/roles';

// Route protégée : exige un utilisateur connecté
router.get('/candidatures', authenticate, async (req, res) => {
  res.json({ userId: req.user!.id });
});

// Accès réservé à un rôle
router.post('/offres', authenticate, requireEmployer, handler);
router.delete('/utilisateurs/:id', authenticate, requireAdmin, handler);

// Plusieurs rôles à la fois
router.patch('/x', authenticate, requireRoles('EMPLOYER', 'ADMIN'), handler);

// Lecture publique, mais req.user injecté si un token valide est fourni
router.get('/offres', optionalAuth, async (req, res) => { ... });
```

Après `authenticate` / `optionalAuth`, `req.user = { id, email, role }` (types dans `backend/src/types/express.d.ts`).

### Exemple curl avec token (Pour tester une route d'un autre module) :

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"camille.durand@exemple.fr","password":"P4ssWord!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl http://localhost:3000/api/offres -H "Authorization: Bearer $TOKEN"
```

### Règles de bon usage

- **Ne jamais stocker** le mot de passe ; seul `passwordHash` est en base et **n'apparaît jamais** dans une réponse.
- L'`accessToken` expire court (15 min) ; les clients doivent utiliser `/auth/refresh` (rotation) plutôt que de reloginer.
- Un compte suspendu (`isSuspended`) reçoit `403` sur login/refresh.
- En cas de doute sur la migration DB : voir `docs/INSTALLATION.md` (commande `migrate deploy`).