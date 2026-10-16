# GéoEmploi API, documentation API

Version `0.1.0`. API REST de mise en relation emploi géolocalisée. 42 endpoints documentés.

> Régénéré automatiquement depuis le swagger vivant (`/api/docs`, JSDoc @openapi dans chaque *.routes.ts) le 2026-09-10 via `npx tsx src/scripts/generate-api-md.ts`.
> Ne pas éditer ce fichier à la main, régénérer depuis le serveur qui tourne pour rester curl-vérifié.
> Interface interactive : **https://13.140.150.236:5173/api/docs/** (Try it out fonctionne directement).

## Sommaire

- [Auth](#auth)
- [Users](#users)
- [Offers](#offers)
- [Applications](#applications)
- [Notifications](#notifications)
- [Pro](#pro)
- [Admin](#admin)

## Auth

### `POST /auth/register`

Inscription (demandeur ou employeur)

**Réponse `201`** : Compte créé, tokens retournés, exemple réel, capturé le 2026-09-03
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 15 min)",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 7 jours)",
  "user": {
    "id": "cc466915-33df-479a-aaae-1ff6ef7e82e1",
    "email": "arch-cand-1788469862@test.fr",
    "role": "JOBSEEKER",
    "geoConsent": false,
    "firstName": "Ariane",
    "lastName": "Docs"
  }
}
```

---

### `POST /auth/login`

Connexion

**Réponse `200`** : Tokens retournés, exemple réel, capturé le 2026-09-03
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 15 min)",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 7 jours)",
  "user": {
    "id": "cc466915-33df-479a-aaae-1ff6ef7e82e1",
    "email": "arch-cand-1788469862@test.fr",
    "role": "JOBSEEKER",
    "geoConsent": false,
    "firstName": "Ariane",
    "lastName": "Docs"
  }
}
```

---

### `POST /auth/refresh`

Renouveler les tokens via refresh token

**Réponse `200`** : Nouveaux tokens (rotation, l'ancien refresh token est invalidé), exemple réel, capturé le 2026-09-03
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 15 min)",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(nouveau JWT, 7 jours)",
  "user": {
    "id": "cc466915-33df-479a-aaae-1ff6ef7e82e1",
    "email": "arch-cand-1788469862@test.fr",
    "role": "JOBSEEKER",
    "geoConsent": false,
    "firstName": "Ariane",
    "lastName": "Docs"
  }
}
```

---

### `POST /auth/logout`

Déconnexion, révoque la session

**Réponse `204`** : Session révoquée, vérifié réel (204 sans corps, capturé le 2026-09-03)

---

### `POST /auth/forgot-password`

Demander un lien de réinitialisation de mot de passe

Anti-énumération, la réponse est identique que le compte existe ou non. Le lien de réinitialisation est envoyé par e-mail (SMTP réel si configuré, sinon écrit dans backend/mail-outbox/ en .eml), jamais retourné dans la réponse API.

**Réponse `200`** : Traité, corps vide, vérifié réel (e-mail reçu via SMTP), capturé le 2026-09-10
```json
{}
```

---

### `POST /auth/reset-password`

Réinitialiser le mot de passe avec un token

**Réponse `200`** : Mot de passe réinitialisé, sessions révoquées, exemple réel, capturé le 2026-09-03
```json
{
  "message": "Mot de passe réinitialisé"
}
```

---

## Users

### `GET /users/me`

Profil du user connecté

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Informations du compte et profil, exemple réel, capturé le 2026-09-03
```json
{
  "id": "cc466915-33df-479a-aaae-1ff6ef7e82e1",
  "email": "arch-cand-1788469862@test.fr",
  "role": "JOBSEEKER",
  "isSuspended": false,
  "geoConsent": false,
  "geoConsentUpdatedAt": null,
  "createdAt": "2026-09-03T21:11:02.385Z",
  "profile": {
    "type": "JOBSEEKER",
    "data": {
      "firstName": "Ariane",
      "lastName": "Docs",
      "phone": null,
      "skills": [],
      "experience": null,
      "availability": null,
      "cvOriginalName": null,
      "cvUploadedAt": null,
      "hasCv": false
    }
  }
}
```

---

### `PATCH /users/me`

Modifier email et/ou mot de passe

**Authentification requise** (Bearer JWT)

**Requête** (`application/json`) :
```json
{
  "phone": "0655443322",
  "skills": [
    "Accueil",
    "Caisse"
  ]
}
```

**Réponse `200`** : Profil mis à jour, exemple réel (PATCH phone+skills), capturé le 2026-09-03
```json
{
  "id": "cc466915-33df-479a-aaae-1ff6ef7e82e1",
  "email": "arch-cand-1788469862@test.fr",
  "role": "JOBSEEKER",
  "profile": {
    "type": "JOBSEEKER",
    "data": {
      "firstName": "Ariane",
      "lastName": "Docs",
      "phone": "0655443322",
      "skills": [
        "Accueil",
        "Caisse"
      ],
      "hasCv": false
    }
  }
}
```

---

### `DELETE /users/me`

Supprimer son compte (RGPD)

**Authentification requise** (Bearer JWT)

**Réponse `204`** : Compte archivé (soft-delete : deletedAt posé, sessions révoquées). L'email est anonymisé pour rester réutilisable, vérifié réel (suppression puis réinscription même email → 201), capturé le 2026-09-03.

---

### `PUT /users/me/geo-consent`

Donner/retirer le consentement géolocalisation (RGPD)

**Authentification requise** (Bearer JWT)

**Réponse `204`** : Consentement mis à jour, vérifié réel (204 sans corps), capturé le 2026-09-03

---

### `POST /users/me/cv`

Envoyer/remplacer son CV (demandeur, PDF, 5 Mo max)

**Authentification requise** (Bearer JWT)

**Réponse `204`** : CV enregistré (stockage disque local, jamais un service objet managé), vérifié réel, capturé le 2026-09-03

**Réponse `400`** : Fichier manquant ou non-PDF

---

### `GET /users/me/cv`

Télécharger son propre CV

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Fichier PDF (Content-Disposition: attachment), vérifié réel : `attachment; filename="arch-cv.pdf"`, capturé le 2026-09-03

**Réponse `404`** : Aucun CV enregistré

---

### `DELETE /users/me/cv`

Supprimer son CV

**Authentification requise** (Bearer JWT)

**Réponse `204`** : CV supprimé

**Réponse `404`** : Aucun CV enregistré

---

### `GET /users/me/export`

Export de portabilité (RGPD, article 20), toutes les données personnelles du compte

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Fichier JSON téléchargeable

---

## Offers

### `GET /offers`

Liste des offres actives, filtrable (carte candidat)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `lat` | query | non |  |
| `lng` | query | non |  |
| `radius` | query | non |  |
| `bbox` | query | non | 4.80,45.74,4.86,45.78 |
| `q` | query | non |  |
| `contract` | query | non |  |
| `sector` | query | non |  |
| `new` | query | non |  |

**Réponse `200`** : Tableau d'offres (pas d'enveloppe), forme frontend directe

---

### `POST /offers`

Publier une offre géolocalisée (employeur)

Les coordonnées sont dérivées de l'adresse via l'API Adresse (BAN) cote serveur, le client n'envoie PAS de lat/lng.

**Authentification requise** (Bearer JWT)

**Requête** (`application/json`) :
```json
{
  "title": "Serveur en salle",
  "description": "Service en salle, restaurant gastronomique.",
  "address": "1 Place Bellecour, 69002 Lyon",
  "radiusKm": 15,
  "sector": "Restauration",
  "contractType": "CDI",
  "salaryMin": 1800,
  "salaryMax": 2100,
  "salaryKind": "brut",
  "workTime": "35h/semaine"
}
```

**Réponse `201`** : Offre créée (coordonnées géocodées), exemple réel, capturé le 2026-09-04
```json
{
  "offer": {
    "id": "bf754b6d-a81d-445b-adf9-07525c062760",
    "employerId": "95a2eb2b-13b9-4c73-be0d-38964058fd35",
    "title": "Serveur en salle",
    "description": "Service en salle, restaurant gastronomique.",
    "latitude": 45.7464,
    "longitude": 4.8265,
    "address": "Lyon",
    "commune": "Lyon",
    "radiusKm": 15,
    "viewCount": 0,
    "status": "ACTIVE",
    "sector": "Restauration",
    "contractType": "CDI",
    "salaryMin": 1800,
    "salaryMax": 2100,
    "salaryKind": "brut",
    "workTime": "35h/semaine",
    "geocodeSource": "api-adresse",
    "geocodeScore": 0.9673672727272726,
    "geocodeCitycode": "69382",
    "geocodedAt": "2026-09-08T13:46:16.274Z",
    "geocodePrecision": "commune",
    "publishedAt": "2026-09-08T13:46:16.279Z",
    "expiresAt": "2026-10-08T13:46:16.276Z",
    "createdAt": "2026-09-08T13:46:16.279Z"
  },
  "geocoding": {
    "label": "Lyon",
    "score": 0.9673672727272726,
    "source": "api-adresse"
  }
}
```

**Réponse `422`** : Adresse introuvable via l'API Adresse

---

### `GET /offers/nearby`

Offres actives dans un rayon (PostGIS ST_DWithin)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `lat` | query | oui | 45.764 |
| `lng` | query | oui | 4.8357 |
| `radiusKm` | query | non | 20 |

**Réponse `200`** : Offres triées par distance (mètres), exemple réel, capturé le 2026-09-03 (docs/module3-capture-2026-09-03.txt)
```json
{
  "offers": [
    {
      "id": "bf754b6d-a81d-445b-adf9-07525c062760",
      "title": "Serveur en salle",
      "description": "Service en salle, restaurant gastronomique.",
      "employerId": "95a2eb2b-13b9-4c73-be0d-38964058fd35",
      "commune": "Lyon",
      "address": "Lyon",
      "latitude": 45.7464,
      "longitude": 4.8265,
      "radiusKm": 15,
      "viewCount": 0,
      "sector": "Restauration",
      "contractType": "CDI",
      "salaryMin": 1800,
      "salaryMax": 2100,
      "salaryKind": "brut",
      "workTime": "35h/semaine",
      "expiresAt": "2026-10-04T06:11:07.294Z",
      "createdAt": "2026-09-04T06:11:07.296Z",
      "companyName": "Swagger Secteur SARL",
      "distance_m": 680
    }
  ]
}
```

---

### `GET /offers/mine`

Mes offres (employeur) avec nombre de candidatures

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Liste des offres de l'employeur, exemple réel, capturé le 2026-09-03
```json
{
  "offers": [
    {
      "id": "bf754b6d-a81d-445b-adf9-07525c062760",
      "employerId": "95a2eb2b-13b9-4c73-be0d-38964058fd35",
      "title": "Serveur en salle",
      "description": "Service en salle, restaurant gastronomique.",
      "latitude": 45.7464,
      "longitude": 4.8265,
      "address": "Lyon",
      "commune": "Lyon",
      "radiusKm": 15,
      "viewCount": 0,
      "status": "ACTIVE",
      "sector": "Restauration",
      "contractType": "CDI",
      "salaryMin": 1800,
      "salaryMax": 2100,
      "salaryKind": "brut",
      "workTime": "35h/semaine",
      "expiresAt": "2026-10-04T06:11:07.294Z",
      "createdAt": "2026-09-04T06:11:07.296Z",
      "applicationCount": 0
    }
  ],
  "count": 1
}
```

---

### `GET /offers/dashboard`

Tableau de bord employeur (vues, candidatures, par offre)

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Totaux + détail par offre, exemple réel, capturé le 2026-09-03
```json
{
  "totals": {
    "offers": 1,
    "active": 1,
    "views": 0,
    "applications": 0
  },
  "offers": [
    {
      "id": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
      "title": "Développeur Full-Stack",
      "status": "ACTIVE",
      "views": 0,
      "applications": 0,
      "expiresAt": "2026-10-03T19:21:24.925Z"
    }
  ]
}
```

---

### `GET /offers/{id}`

Détail d'une offre (incrémente le compteur de vues)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui | 4a78c625-bba5-441b-8e5c-3a3a75ec817a |

**Réponse `200`** : Offre, exemple réel, capturé le 2026-09-03 (viewCount incrémenté par l'appel)
```json
{
  "offer": {
    "id": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
    "title": "Développeur Full-Stack",
    "address": "Lyon",
    "commune": "Lyon",
    "latitude": 45.7464,
    "longitude": 4.8265,
    "radiusKm": 20,
    "viewCount": 1,
    "status": "ACTIVE",
    "expiresAt": "2026-10-03T19:21:24.925Z"
  }
}
```

**Réponse `404`** : Introuvable

---

### `PATCH /offers/{id}`

Modifier une de mes offres, ou modérer une offre (admin)

Un employeur ne peut modifier que ses propres offres. Un compte ADMIN peut modifier le statut de n'importe quelle offre via cette même route (pas de route /admin dédiée), c'est ainsi que la modération se conclut après un signalement : status "unpublished" ou "published" en body, en tant qu'admin, sur l'offre visée par GET /admin/reports.

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui | 4a78c625-bba5-441b-8e5c-3a3a75ec817a |

**Requête** (`application/json`) :
```json
{
  "radiusKm": 25
}
```

**Réponse `200`** : Offre mise à jour. Premier exemple (employeur), capturé le 2026-09-03. Second exemple (admin, moderation), capturé le 2026-09-10.

```json
{
  "offer": {
    "id": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
    "title": "Développeur Full-Stack",
    "radiusKm": 25,
    "status": "ACTIVE",
    "viewCount": 1,
    "updatedAt": "2026-09-03T19:21:25.576Z"
  }
}
```

**Réponse `403`** : Offre d'un autre employeur

---

### `DELETE /offers/{id}`

Supprimer une de mes offres

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui |  |

**Réponse `204`** : Supprimée

---

### `POST /offers/{offerId}/report`

Signaler une offre (feature/admin). Passe l'offre en statut "reported" et l'entrée en file de modération.

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `offerId` | path | oui |  |

**Requête** (`application/json`) :
```json
{
  "reason": "Offre trompeuse",
  "comment": "Rien à voir avec l'annonce."
}
```

**Réponse `201`** : Signalement enregistré

**Réponse `404`** : Offre introuvable

**Réponse `409`** : Déjà signalée par ce compte

---

### `GET /offers/{id}/export.pdf`

Fiche PDF imprimable d'une de mes offres (employeur)

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui |  |

**Réponse `200`** : Fichier PDF

**Réponse `403`** : Offre d'un autre employeur

**Réponse `404`** : Offre introuvable

---

## Applications

### `POST /applications`

Postuler à une offre (demandeur authentifié)

**Authentification requise** (Bearer JWT)

**Requête** (`application/json`) :
```json
{
  "offerId": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
  "message": "Disponible immédiatement, très motivée."
}
```

**Réponse `201`** : Candidature transmise (employeur notifié), exemple réel, capturé le 2026-09-03
```json
{
  "application": {
    "id": "8d34f235-998e-413e-9bab-13a8a1f0e784",
    "offerId": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
    "userId": "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2",
    "status": "PENDING",
    "message": "Disponible immédiatement, très motivée.",
    "createdAt": "2026-09-03T19:21:36.173Z"
  }
}
```

**Réponse `404`** : Offre indisponible

**Réponse `409`** : Déjà postulé

---

### `GET /applications/mine`

Mes candidatures (demandeur) avec statut et offre

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Suivi des candidatures, exemple réel, capturé le 2026-09-03
```json
{
  "applications": [
    {
      "id": "8d34f235-998e-413e-9bab-13a8a1f0e784",
      "offerId": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
      "userId": "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2",
      "status": "PENDING",
      "message": "Disponible immédiatement, très motivée.",
      "createdAt": "2026-09-03T19:21:36.173Z",
      "offer": {
        "id": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
        "title": "Développeur Full-Stack",
        "commune": "Lyon",
        "status": "ACTIVE",
        "employer": {
          "companyName": "Swagger Demo SARL"
        }
      }
    }
  ],
  "count": 1
}
```

---

### `GET /applications/offer/{offerId}`

Candidatures reçues pour une de mes offres (employeur)

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `offerId` | path | oui | 4a78c625-bba5-441b-8e5c-3a3a75ec817a |
| `status` | query | non |  |

**Réponse `200`** : Candidatures + coordonnées du candidat, exemple réel, capturé le 2026-09-03
```json
{
  "applications": [
    {
      "id": "8d34f235-998e-413e-9bab-13a8a1f0e784",
      "offerId": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
      "userId": "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2",
      "status": "PENDING",
      "message": "Disponible immédiatement, très motivée.",
      "createdAt": "2026-09-03T19:21:36.173Z",
      "user": {
        "id": "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2",
        "email": "swagger-cand-demo@test.fr",
        "jobseekerProfile": {
          "firstName": "Camille",
          "lastName": "Swagger",
          "phone": null,
          "skills": [],
          "experience": null,
          "availability": null
        }
      }
    }
  ],
  "count": 1
}
```

**Réponse `403`** : Offre d'un autre employeur

---

### `GET /applications/offer/{offerId}/export.csv`

Export CSV des candidatures reçues pour une de mes offres (employeur)

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `offerId` | path | oui |  |

**Réponse `200`** : Fichier CSV

**Réponse `403`** : Offre d'un autre employeur

**Réponse `404`** : Offre introuvable

---

### `GET /applications/{id}/cv`

Télécharger le CV du candidat pour une de mes candidatures reçues (employeur)

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui |  |

**Réponse `200`** : Fichier PDF

**Réponse `403`** : Candidature d'un autre employeur

**Réponse `404`** : Candidature ou CV introuvable

---

### `PATCH /applications/{id}`

Changer le statut d'une candidature (employeur)

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui | 8d34f235-998e-413e-9bab-13a8a1f0e784 |

**Requête** (`application/json`) :
```json
{
  "status": "ACCEPTED"
}
```

**Réponse `200`** : Statut mis à jour (demandeur notifié), exemple réel, capturé le 2026-09-03
```json
{
  "application": {
    "id": "8d34f235-998e-413e-9bab-13a8a1f0e784",
    "offerId": "4a78c625-bba5-441b-8e5c-3a3a75ec817a",
    "userId": "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2",
    "status": "ACCEPTED",
    "message": "Disponible immédiatement, très motivée.",
    "updatedAt": "2026-09-03T19:21:36.680Z"
  }
}
```

**Réponse `403`** : Candidature d'un autre employeur

---

## Notifications

### `GET /notifications`

Mes notifications, les plus récentes en premier

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Tableau de notifications (pas d'enveloppe)

---

### `PATCH /notifications/read-all`

Marquer toutes mes notifications comme lues

**Authentification requise** (Bearer JWT)

**Réponse `204`** : OK

---

### `PATCH /notifications/{id}`

Marquer une notification comme lue

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui |  |

**Réponse `204`** : OK

**Réponse `404`** : Introuvable

---

## Pro

### `GET /pro/stats`

Statistiques employeur (vues, candidatures)

**Authentification requise** (Bearer JWT)

**Réponse `200`** : views, approaches (toujours 0, pas de concept backend), applications, peakHours (toujours [], pas de données)

---

### `GET /pro/offers`

Mes offres, forme frontend directe (dashboard, liste employeur)

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Tableau d'offres (pas d'enveloppe)

---

### `GET /pro/applications`

Candidatures reçues, agrégées sur toutes mes offres

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Tableau de candidatures (pas d'enveloppe)

---

### `PATCH /pro/applications/{id}`

Changer le statut d'une candidature (alias frontend de PATCH /api/applications/:id)

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Candidature mise à jour

---

## Admin

### `GET /admin/users`

Liste des comptes (modération)

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Tableau d'utilisateurs (pas d'enveloppe), exemple réel, capturé le 2026-09-10
```json
[
  {
    "id": "2d99e283-4a88-45ae-b7b4-161154bbafa4",
    "email": "employeur@exemple.fr",
    "role": "employer",
    "status": "pending",
    "firstName": null,
    "lastName": null,
    "companyName": "Exemple SARL",
    "siret": null
  }
]
```

---

### `PATCH /admin/users/{id}`

Suspendre / réactiver / activer un compte

status "active" sur un compte employeur non vérifié le passe aussi verified=true (sinon "pending" indéfiniment), couvre à la fois "activer" et "réactiver".

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `id` | path | oui |  |

**Requête** (`application/json`) :
```json
{
  "status": "suspended"
}
```

**Réponse `204`** : Compte mis à jour

**Réponse `404`** : Introuvable

---

### `GET /admin/offers`

Offres filtrables par statut (file de modération)

Chaque offre inclut lambert93 (EPSG:2154), calculé à la lecture, exigence T. Vignal. La modération elle-même (changer le statut) se fait via PATCH /api/offers/{id}, pas ici.

**Authentification requise** (Bearer JWT)

**Paramètres** :

| Nom | Emplacement | Requis | Exemple |
|---|---|---|---|
| `status` | query | non |  |

**Réponse `200`** : Tableau d'offres (pas d'enveloppe), forme frontend directe, exemple réel avec status=reported, capturé le 2026-09-10
```json
[
  {
    "id": "18b8b72b-1f09-4348-9e58-e40631c4f5a3",
    "title": "Offre signalée",
    "status": "reported",
    "company": "Exemple SARL",
    "address": "Lyon",
    "lambert93": {
      "x": 842635.52,
      "y": 6519257.16
    }
  }
]
```

---

### `GET /admin/reports`

Signalements ouverts (file de modération)

Un signalement se ferme implicitement quand l'offre change de statut via PATCH /api/offers/{id} (pas de route dédiée /admin/reports/{id}/resolve).

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Tableau de signalements (pas d'enveloppe), exemple réel, capturé le 2026-09-10
```json
[
  {
    "id": "429339c8-984c-45a6-ab3a-99be23c2d762",
    "offerId": "18b8b72b-1f09-4348-9e58-e40631c4f5a3",
    "offerTitle": "Offre signalée",
    "reason": "Offre trompeuse : Rien à voir avec l'annonce.",
    "reporterId": "c8ecdbc3-c95d-4ffb-908e-19c35a1ebb79",
    "status": "open"
  }
]
```

---

### `GET /admin/metrics`

Métriques nationales (tableau de bord admin)

**Authentification requise** (Bearer JWT)

**Réponse `200`** : Compteurs agrégés, exemple réel, capturé le 2026-09-10
```json
{
  "activeOffers": 539,
  "publishedToday": 0,
  "candidates": 29,
  "employers": 39,
  "applicationsToday": 0,
  "reportsOpen": 0,
  "weeklyActivity": [
    {
      "label": "Ven",
      "applications": 7,
      "offers": 39
    },
    {
      "label": "Sam",
      "applications": 0,
      "offers": 0
    }
  ]
}
```

---
