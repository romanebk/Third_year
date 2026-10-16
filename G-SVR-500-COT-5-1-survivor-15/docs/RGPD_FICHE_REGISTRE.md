# Fiche registre de traitement, RGPD

**Traitement** : Gestion des comptes utilisateurs, authentification et consentement géolocalisation, GéoEmploi

**Responsable du traitement** : GéoEmploi (Epitech PGE3-2026)

**Responsable de la rédaction** : Module Auth (`feature/auth`)

**Date** : 2026-09-03

---

## 1. Finalité du traitement

Permettre la création et la gestion des comptes (chercheurs d'emploi et employeurs), l'authentification sécurisée (JWT), la gestion du profil, la suppression du compte et la gestion du **consentement à la géolocalisation** (obligatoire pour proposer des offres à proximité).

## 2. Base légale

- **Art. 6.1.a RGPD (consentement)** : le traitement des données de **localisation** repose sur le consentement explicite et **révocable** de l'utilisateur.
- **Art. 6.1.b RGPD (exécution du contrat)** : la gestion du compte, du profil et des candidatures est nécessaire à l'utilisation du service.
- **Art. 6.1.c RGPD (obligation légale)** : conservation des données d'inscription requise pour répondre à la réglementation (dont obligations de l'employeur).

## 3. Durée de conservation

| Donnée | Durée de conservation |
|---|---|
| Compte utilisateur (email, mot de passe haché, rôle) | Jusqu'à la suppression du compte par l'utilisateur (ou clôture du service) |
| Profil (prénom, nom, entreprise, compétences…) | Jusqu'à suppression du compte |
| **Données de localisation** | Jusqu'à **retrait du consentement** par l'utilisateur (ou suppression du compte) |
| Sessions / refresh tokens | Durée de vie du refresh token (7 jours) ou révocation à la suppression |
| Données supprimées (soft-delete) | Marquées `deletedAt` ; purge définitive selon politique interne (voir §6) |

## 4. Destinataires des données

- **Internes** : équipe de développement GéoEmploi (hébergement 100% local, aucun cloud payant).
- **Aucun destinataire externe** : les données ne sont ni vendues, ni cédées, ni transmises à des tiers.
- L'application tourne 100% en local ; les données restent dans la base PostgreSQL/PostGIS locale.

## 5. Tableau des données collectées, colonne par colonne

Légende destinataire : **I** = interne/équipe · **N/A** = jamais exposé ni partagé.

### Table `User` (compte)

| Colonne | Finalité | Base légale | Conservation | Destinataire |
|---|---|---|---|---|
| `id` | identifiant interne | contrat | compte actif | I |
| `email` | connexion & contact | contrat | compte actif | I |
| `passwordHash` | authentification (hash bcrypt) | contrat | compte actif ; jamais renvoyé | I |
| `role` | type de compte (JOBSEEKER/EMPLOYER/ADMIN) | contrat | compte actif | I |
| `isSuspended` | sécurité / modération | obligation légale | compte actif | I |
| `geoConsent` | **consentement géolocalisation** | **consentement (6.1.a)** | jusqu'au retrait | I |
| `geoConsentUpdatedAt` | preuve de la date du consentement | consentement | conservé après retrait (journalisation) | I |
| `deletedAt` | traçabilité suppression (RGPD) | obligation légale | conservé (marqueur) | I |
| `createdAt` / `updatedAt` | horodatage | contrat / traçabilité | compte actif | I |

### Table `JobseekerProfile` (profil candidat)

| Colonne | Finalité | Base légale | Conservation | Destinataire |
|---|---|---|---|---|
| `id` | identifiant | contrat | compte actif | I |
| `userId` | lien vers le compte | contrat | compte actif | I |
| `firstName`, `lastName` | identification | contrat | compte actif | I |
| `phone` | contact candidat | contrat | compte actif | I |
| `skills` | compétences listées | contrat | compte actif | I |
| `experience` | parcours | contrat | compte actif | I |
| `availability` | disponibilité | contrat | compte actif | I |
| `latitude`, `longitude` | **géolocalisation candidat** | **consentement** | jusqu'au retrait du consentement | I |

### Table `EmployerProfile` (profil employeur)

| Colonne | Finalité | Base légale | Conservation | Destinataire |
|---|---|---|---|---|
| `companyName` | identification employeur | contrat | compte actif | I |
| `siret` | vérification d'activité | obligation légale | compte actif | I |
| `verified` | statut de vérification | obligation légale | compte actif | I |
| `description`, `website` | présentation | contrat | compte actif | I |

## 6. Ce qui n'est **PAS** collecté

GéoEmploi **ne collecte pas** les données suivantes :

- ❌ Données de **santé** (aucune)
- ❌ Données **biométriques** (aucune)
- ❌ Données **financières / bancaires** (aucun paiement, la publication d'une offre est gratuite)
- ❌ **Données de localisation précise en arrière-plan** sans consentement (la géoloc n'est traitée qu'avec l'accord explicite de l'utilisateur)
- ❌ Historique de navigation hors service
- ❌ Données de mineurs ou catégories particulières (art. 9 RGPD)

## 7. Mesures de sécurité

- Mots de passe **hachés** (bcrypt), jamais stockés ni renvoyés en clair.
- **JWT** signés (access 15 min + refresh rotation 7 j avec révocation à chaque refresh).
- Refresh tokens **hachés (sha256)** en base (`Session.refreshToken`).
- Erreurs normalisées sans fuite de données sensibles (anti-énumération sur login/forgot-password).
- Base PostgreSQL locale, accès restreint.

## 8. Droits des personnes (utilisateur)

| Droit | Modalité dans l'app |
|---|---|
| Consentement | Toggle "Localisation" dans le profil, révocable à tout moment, sans perte du compte/profil/candidatures |
| **Accès** | `GET /api/users/me` |
| **Rectification** | `PATCH /api/users/me` |
| **Effacement (suppression du compte)** | `DELETE /api/users/me` (RGPD) |
| Portabilité / opposition | À la demande via l'équipe |

## 9. Procédure de suppression de compte (RGPD)

1. L'utilisateur déclenche `DELETE /api/users/me` depuis son profil.
2. Le backend révoque **toutes les sessions** (`session.deleteMany`) et pose `deletedAt` (suppression logique) → l'accès au compte est immédiatement bloqué (login/register refusés).
3. L'utilisateur peut retirer son consentement géoloc séparément **sans** supprimer son compte.

La suppression immédiate reste un **soft delete** (pose `deletedAt`, révoque les sessions, bloque l'accès), pour permettre une éventuelle réversibilité à très court terme. La **purge définitive** (hard delete en cascade) intervient ensuite via `backend/src/scripts/purge-deleted-accounts.ts` (`npm run purge:accounts`), qui efface irréversiblement les comptes désactivés depuis plus de 30 jours (seuil réglable). Ajoutée le 9 septembre 2026, sans ordonnanceur automatique en place (pas de CI/CD, voir docs/NOTE_DEPLOIEMENT.md) : déclenchement manuel ou tâche planifiée du système hôte, à la discrétion de l'équipe d'exploitation.

## 10. Export de portabilité (RGPD, article 20)

`GET /api/users/me/export` : toute personne connectée peut télécharger l'intégralité de ses données personnelles (compte, profil, candidatures, notifications, signalements) au format JSON structuré. Ne contient jamais le mot de passe, même haché. Ajouté le 9 septembre 2026.
