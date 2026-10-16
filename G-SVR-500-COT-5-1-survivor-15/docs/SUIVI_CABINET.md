# GéoEmploi — Documentation de projet

*Document vivant — à mettre à jour au fil de l'eau par l'équipe.*

> **Note** : ce document corrige/actualise certains points de
> [docs/SYNTHESE_ARBITRAGES.md](SYNTHESE_ARBITRAGES.md) (notamment la précision
> géographique et le positionnement produit). En cas de contradiction entre
> les deux fichiers, celui-ci fait foi (plus récent, confirmé par Florine
> Pontaillac au point 15).

---

## 1. Résumé exécutif

- **Projet** : GéoEmploi, plateforme d'emploi géolocalisée, commanditée (dans le cadre du projet scolaire) par le "Ministère du Job et Bonheur".
- **Nom officiellement retenu** : **GéoEmploi** (confirmé par écrit par M. Sellami, conseiller communication, à deux reprises).
- **Statut** : démonstrateur sur 2 semaines, données fictives, pas de mise en production réelle de notre côté.
- **Point de vigilance majeur** : un document annoté "ChomageGo" et un site en ligne (`chomage-go.job-et-bonheur.fr`) ont circulé en parallèle, présentant des orientations différentes et non validées par les canaux officiels. Ces éléments ne relèvent pas de notre réalisation (confirmé par Mme Pontaillac).

---

## 2. Chronologie des échanges et arbitrages

| # | Émetteur | Sujet | Contenu clé | Statut |
|---|----------|-------|--------------|--------|
| 1 | Direction Numérique et Innovation | Cahier des charges v1.0 | Périmètre fonctionnel initial, contraintes techniques, livrables S1/S2 | Référence de base |
| 2 | Florine Pontaillac (juridique) | RGPD, consentement, RGAA, CGU | Fiche de registre, consentement retirable, accessibilité AA, CGU soumises avant publication | **Non négociable, confirmé à plusieurs reprises** |
| 3 | Thomas Vignal (technique) | Architecture, souveraineté numérique, cartographie, charge | OpenAPI, schéma BDD, `.env.example`, `/health`, pas de cloud US, cache tuiles, test de charge | **Confirmé, exigences fermes** |
| 4 | Thomas Vignal (technique) | Migration IGN | Passage obligatoire à la Géoplateforme IGN + API Adresse, procédure de reprise des offres existantes | **Confirmé** |
| 5 | Document "ChomageGo" annoté (JEB) | Rebranding + nouvelles fonctionnalités | Nom "ChomageGo", géoloc à la rue, AR, gamification prioritaire, remplacement France Travail/Apec, abonnement 400€/mois | **Non validé par les canaux officiels, écarté** |
| 6 | Benjamin Sellami (communication) | Charte graphique, nom, vidéo | Charte obligatoire partout, nom "GéoEmploi" sans variante, vidéo de présentation | **Confirmé** |
| 7 | Florine Pontaillac | Réponse sur positionnement/abonnement/gamification | Renvoie vers les orientations du Ministre, mais rappelle que les obligations légales restent applicables indépendamment | Confirmé (sous réserve légale) |
| 8 | Benjamin Sellami | Confirmation gamification en additionnel | Gamification non prioritaire pour S1, pas de point bloquant | Confirmé |
| 9 | Benjamin Sellami | Recadrage GéoEmploi vs ChomageGo | Base à retenir = GéoEmploi ; demande de centraliser les échanges avec lui uniquement | **Confirmé, règle de communication actée** |
| 10 | Thomas Vignal | Refus d'arbitrer nom du produit | Ne tranche pas entre les deux bases, mais la géoloc reste à la commune/l'arrondissement dans tous les cas, à documenter avec date/auteur | Confirmé (contrainte technique/légale) |
| 11 | Benjamin Sellami | Demande captures presse + accroches | 5 captures presse-ready + 3 phrases d'accroche, suite à la médiatisation | En cours |
| 12 | Signalement équipe → Thomas + Florine | Site `chomage-go.job-et-bonheur.fr` non identifié | Alerte sur collecte de position floue + pubs tierces sur un sous-domaine officiel | Signalé |
| 13 | Florine Pontaillac | GéoEmploi "en production" (appris par le JT) | Demande AIPD, purge 90j, export RGPD art. 20, mention d'information, échéance mardi 12h | Clarifié (voir #15) |
| 14 | ⚠️ Mail marqué "expéditeur externe" | Réponse sur le site ChomageGo | Confirme ajouts faits par le Ministre sans concertation | **Authenticité à vérifier avant d'agir** |
| 15 | Florine Pontaillac (confirmation) | Recadrage du périmètre | Les 4 livrables RGPD doivent être proportionnés à l'échelle réelle du démonstrateur ; le site ChomageGo ne doit pas être documenté comme le nôtre | **Confirmé, fait foi** |

---

## 3. Compromis / décisions finales actées

- **Nom du produit** : GéoEmploi, partout (interface, captures, communication).
- **Géolocalisation** : précision à la commune/l'arrondissement (jamais à la rue), non négociable quel que soit le nom du produit.
- **Abonnement employeur** : 400€/mois, **simulé** en base, sans transaction réelle.
- **Gamification / réalité augmentée** : fonctionnalité additionnelle, non prioritaire pour la semaine 1.
- **Positionnement (complément vs remplacement de France Travail/Apec)** : jamais tranché formellement par un canal validé, à traiter avec prudence dans le discours produit.
- **RGPD/RGAA** : applicables intégralement, indépendamment de toute autre orientation.
- **Livrables RGPD complémentaires (échéance mardi 12h)**, à l'échelle du démonstrateur :
  - AIPD allégée (3 pages)
  - Purge automatisée des historiques de localisation (>90 jours)
  - Export des données personnelles (JSON/CSV, article 20)
  - Mention d'information avant activation de la géolocalisation
- **Site `chomage-go.job-et-bonheur.fr`** : n'est pas notre réalisation, à ne surtout pas documenter comme tel.

---

## 4. Suivi des mises en copie (à compléter par l'équipe)

> Objectif : savoir qui, dans l'équipe, est effectivement en copie de chaque échange avec le cabinet, pour éviter les pertes d'information.

| Date | Interlocuteur | Destinataire principal | Copie équipe ? (oui/non/à vérifier) | Copie(s) |
|------|----------------|------------------------|--------------------------------------|----------|
| | | | | |

---

## 5. Plan d'équipe — qui fait quoi

| Membre | Rôle / responsabilité | Tâches en cours | Statut |
|--------|------------------------|------------------|--------|
| Stella Gbaguidi | Cheffe de groupe, coordination cabinet, Frontend & UI/UX, vidéo & captures presse | Communication avec le cabinet, arbitrages, interface utilisateur, livrables de communication | En cours |
| David Akodande-Agossa | Backend, module Offres & Candidatures | Développement et maintenance de son périmètre backend | En cours |
| Olympe Hounkpevi | Backend | Développement et maintenance de son périmètre backend | En cours |
| Ariel Boko | Backend, module Auth/Users, RGPD & conformité (AIPD, purge, export) | Développement backend de son périmètre + livrables RGPD | En cours |

---

## 6. Statut de la communication avec le cabinet

- **Point de contact centralisé** : Benjamin Sellami (demande explicite du 09), sauf urgence légale (Florine Pontaillac) ou technique/infrastructure (Thomas Vignal).
- **Canal privilégié** : échanges par mail, sur les fils existants (éviter les nouveaux threads isolés, notamment après l'incident du mail "expéditeur externe").
- **En attente de réponse** : livrables RGPD (échéance mardi 12h), captures presse + accroches (échéance vendredi 8h).
- **Vigilance** : vérifier l'authenticité de tout message marqué "expéditeur externe" avant d'y répondre ou d'agir dessus.

---

## 7. Livrables à rassembler / pousser

- [ ] Vidéo de présentation (<2 min, 1080p, sous-titres incrustés) + note d'intention 5 lignes
- [ ] 5 captures d'écran presse-ready (PNG, 1920×1080 min, données fictives crédibles)
- [ ] 3 phrases d'accroche (demandeurs d'emploi / employeurs / collectivités)
- [ ] AIPD allégée (3 pages)
- [ ] Documentation purge des historiques de localisation
- [ ] Documentation export de données personnelles
- [ ] Mention d'information géolocalisation
- [ ] Fiche de registre de traitement (article 30 RGPD)
- [ ] Compte rendu d'accessibilité RGAA (10 critères, 3 écrans)
- [ ] Spécification OpenAPI / Swagger
- [ ] Schéma de base de données
- [ ] `.env.example`
- [ ] Note de déploiement (1 page)
- [ ] Rapport de test de charge
- [ ] Liste des écrans conformes à la charte graphique
