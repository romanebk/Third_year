# GéoEmploi, Synthèse des arbitrages (mails reçus), version corrigée

> ⚠️ **Décisions révisées depuis** : voir [docs/SUIVI_CABINET.md](SUIVI_CABINET.md)
> (confirmé par Florine Pontaillac). En particulier, la précision géo est
> revenue à **commune/arrondissement** (pas "à la rue"), et le positionnement
> "remplace France Travail" n'a en réalité **jamais été tranché** par un canal
> validé. Le tableau "État final, décisions produit" ci-dessous est périmé
> sur ces deux points précis.
>
> ⚠️ **Nouvelle révision, 8 septembre 2026** : retour intégral à la version
> 1.0 du cahier des charges sur instruction de Florine Pontaillac (accord
> Thomas Vignal et Benjamin Sellami). Précision géo à la commune (pas à la
> rue), abonnement et gamification entièrement retirés, pas seulement
> "simulés" ou "additionnels". Voir docs/JOURNAL_MODIFICATIONS.md pour le
> détail des retraits.

## 1. CDC original (v1.0), base de référence
- Positionnement : complète France Travail/Apec
- Précision géo : arrondissement/commune
- Pas d'abonnement mentionné
- Cartographie : Leaflet + OpenStreetMap

## 2. Version annotée du Ministre (v1.1), divergences proposées
- Positionnement : remplace France Travail
- Précision géo : à la rue
- Gamification, abonnement 400€/mois, carte temps réel
- Suppression RGPD proposée (jamais retenue)

## 3. Mail Florine, 1ère intervention
- 🔴 **RGPD et RGAA non négociables**
- Consentement géoloc révocable, sans perte d'usage
- **🔴 4 livrables légaux dus vendredi 12h :**
  1. **Fiche de registre de traitement** (1 page, finalité, base légale, durée de conservation, destinataires ; table/colonne exacte pour chaque donnée ; liste de ce qui n'est PAS collecté)
  2. **Audit RGAA** niveau AA (10 critères justifiés, testés sur 3 écrans : carte, formulaire candidature, dashboard employeur, + parcours clavier seul)
  3. **Tableau de comportements** écran par écran (position acceptée/refusée) + captures des deux parcours sur l'app qui tourne
  4. **Projet de CGU**, annoté clause par clause "existant" ou "intention"

## 4. Mail Thomas, contraintes techniques
- 🔴 Stripe interdit, tout service tiers payant interdit → abonnement simulé
- App 100% locale, aucun cloud payant
- 🔴 Schéma BDD à jour dû **vendredi 17h**
- Swagger/OpenAPI, `.env.example`, endpoint `/health`, cache tuiles mesuré
- WebSockets + repli polling obligatoire
- 🔴 Test de charge avant la revue technique (50 utilisateurs/3min, ≥500 offres/50 communes)

## 5. Mail Benjamin, charte et communication
- Charte graphique obligatoire partout, nom "GéoEmploi" toujours
- 🔴 **Vidéo de présentation** < 2min + note d'intention, due **vendredi 12h**

## 6. Votre mail d'arbitrage (envoyé aux 3)
5 points soulevés : positionnement, précision géo, RGPD/RGAA, abonnement, gamification

## 7. 1ère réponse Florine, partielle
Positionnement/abonnement/gamification renvoyés, précision géo sous réserve, RGPD/RGAA confirmés

## 8. Mail "quarantaine", 🔴 signal de phishing
Lien suspect, ne jamais cliquer, vérifier via canal officiel

## 9. Mail Benjamin, demande de synthèse ciblée
Répondu

## 10. Mail Thomas, migration cartographique IGN, 🔴 urgent + vérification requise
- 🔴 **Vérifier l'authenticité de l'expéditeur avant d'agir** (bandeau "expéditeur externe")
- OpenStreetMap interdit → Géoplateforme IGN (WMTS) + Leaflet conservé
- Géocodage exclusivement via API Adresse
- Traçabilité à stocker : source, score, date
- Coordonnées admin/export en Lambert-93 (EPSG:2154) en plus du WGS84
- 🔴 **Script de reprise des offres existantes** (idempotent, résilient, statut "à vérifier", relevé d'écarts), **"va coûter la journée" selon Thomas**
- 🔴 Livrables : note de migration (2 pages), sortie de commande, captures avant/après, **dus avant jeudi (démo)**

## 11. Réponse Benjamin, confirmation finale
Gamification confirmée additionnelle, non prioritaire

## 12. Réponse Florine, arbitrage final
Positionnement (remplace), abonnement (simulé), gamification (additionnelle) tous confirmés ; RGPD/RGAA rappelés une nouvelle fois

---

## 🔴 Récapitulatif des échéances urgentes

| Livrable | Deadline | Responsable suggéré |
|---|---|---|
| 🔴 Migration cartographie IGN + script de reprise | **Avant jeudi (démo)** | Module 2 + Module 3 |
| 🔴 Note de migration (2 pages) + captures avant/après | Avant jeudi | Module 2 |
| 🔴 Test de charge | Avant revue technique | Transverse |
| 🔴 Fiche de registre de traitement RGPD | **Vendredi 12h** | Transverse (lié au module 1 - consentement) |
| 🔴 Audit RGAA | Vendredi 12h | Transverse |
| 🔴 Tableau consentement + captures | Vendredi 12h | Module 1 + Module 2 |
| 🔴 Projet de CGU | Vendredi 12h | Transverse |
| 🔴 Vidéo de présentation + note d'intention | Vendredi 12h | Transverse (com) |
| Schéma BDD à jour | Vendredi 17h | Transverse |

---

## État final, décisions produit

| Sujet | Décision définitive |
|---|---|
| Positionnement | Remplace France Travail |
| Précision géo | À la rue, garanties renforcées |
| Cartographie | Géoplateforme IGN + Leaflet |
| Géocodage | API Adresse, avec traçabilité |
| Coordonnées | WGS84 + Lambert-93 |
| Abonnement | 400€/mois, simulé |
| Gamification | Confirmée, additionnelle |
| RGPD / RGAA | Non négociables |
| Hébergement | 100% local |
| Temps réel | WebSockets + repli polling |

Le point le plus critique en termes de délai, c'est clairement le **bloc n°10 (migration IGN)** : il touche à la fois le code (module 2/3) et un livrable due avant jeudi, donc avant les 4 livrables légaux de vendredi. Tu veux qu'on priorise la répartition des tâches en fonction de cet ordre d'échéances (jeudi d'abord, vendredi ensuite) ? .
