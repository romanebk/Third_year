# Livrables Florine, RGAA sur les 3 écrans exigés (carte, candidature, dashboard employeur)

*GéoEmploi, 04/09/2026 (carte, candidature) puis 10/09/2026 (dashboard
employeur, signalé manquant par Ariel : l'audit initial ("module 2") ne
couvrait que 2 des 3 écrans explicitement exigés au cahier des charges).*

> **Mise à jour du 10/09/2026** : `CatchModal.tsx`, référencé plus bas comme
> composant du formulaire de candidature, a été renommé `ApplicationModal.tsx`
> lors du retrait de la mécanique de capture (retour v1.0, 8 septembre). Le
> point "bouton désactivé sans explication liée" (§1.2) concernait le verrou
> de proximité à 300m, retiré avec le reste de la gamification : **ce point
> n'a plus lieu d'être**, il n'y a plus de bouton conditionnellement désactivé
> pour cette raison dans `ApplicationModal.tsx` actuel (seul état désactivé
> restant : pendant l'envoi du formulaire, `disabled={mut.isPending}`, avec le
> texte du bouton qui change en "Envoi…", un cas standard, pas un défaut RGAA).

---

## 1. Audit RGAA, carte & formulaire de candidature

Audit basé sur lecture de code (`frontend/src/components/map/JobMap.tsx`,
`frontend/src/features/candidate/CatchModal.tsx`,
`frontend/src/components/ui/Input.tsx`), niveau AA visé.

### 1.1 Carte (`JobMap.tsx`)

| Critère | État | Détail |
|---|---|---|
| Bouton "Me localiser" | ✅ Conforme | Vrai `<button>`, texte visible, SVG décoratif en `aria-hidden` |
| Focus visible | ✅ Conforme | `:focus-visible` global avec contour 2px |
| Zoom (contrôle Leaflet) | ✅ Conforme | Contrôle par défaut Leaflet, `aria-label` natif |
| Navigation clavier de la carte | ✅ Conforme | `keyboard` activé sur `MapContainer` (pan/zoom au clavier), sélection d'offre au clavier corrigée ci-dessous |
| **Sélection d'une offre au clavier** | ✅ Corrigé le 04/09 | Chaque marqueur a `tabindex="0"`, `role="button"` et `aria-label`, Entrée/Espace ouvre l'offre comme un clic |
| **Marqueurs sans alternative textuelle** | ✅ Corrigé le 04/09 | `aria-label` posé sur chaque marqueur (titre, entreprise, état) |
| **Distinction sélectionné/nouveau par couleur seule** | ✅ Corrigé le 04/09 | Badge visuel ajouté sur "nouveau", bordure en pointillés sur "sélectionné", coche sur "postulée", en plus de la couleur |
| Carte sans description globale | ✅ Corrigé le 04/09 | `role="application"` + `aria-label` posés sur le conteneur, renvoie vers la liste latérale comme alternative |

### 1.2 Formulaire de candidature (`CatchModal.tsx`)

| Critère | État | Détail |
|---|---|---|
| Labels associés aux champs | ✅ Conforme | Vrai `<label htmlFor>` via le composant `FieldShell` partagé |
| Erreurs associées au champ | ✅ Conforme | `aria-describedby` + `aria-invalid` + `role="alert"` sur le message d'erreur |
| Focus visible | ✅ Conforme | Style global `:focus-visible` |
| Raison de blocage annoncée | ✅ Conforme | Message de contrainte de proximité en `aria-live="polite"` |
| **Bouton désactivé sans explication liée** | ⚠️ Partiel | Le bouton "Postuler" peut être désactivé (hors zone GPS) mais n'a pas d'`aria-describedby` pointant vers le message expliquant pourquoi, un utilisateur qui va directement au bouton au clavier ne sait pas pourquoi il est bloqué sans être passé par le texte au-dessus |
| Champs obligatoires marqués | ➖ Non applicable | Seul champ du formulaire (message) est optionnel, rien à marquer |

### 1.3 Synthèse pour Florine

- **Conforme** : structure des labels/erreurs du formulaire, focus visible partout, bouton de géolocalisation
- **Corrigé le 04/09** :
  1. Marqueurs de carte accessibles au clavier avec alternative textuelle
  2. Distinction visuelle "nouveau"/"sélectionné" ne reposant plus uniquement sur la couleur
  3. Carte avec description ARIA globale
- **À améliorer** : lier le message de blocage du bouton "Postuler" via `aria-describedby`, non traité

Les trois points non conformes relevés le 03/09 ont été corrigés le lendemain,
uniquement dans le code du module 2 (`JobMap.tsx`, `index.css`). Le point
"bouton désactivé" reste ouvert.

---

## 2. Tableau de comportements, consentement de géolocalisation

Comportement observé dans le code (`store/consent.ts`, `GeoConsentBanner.tsx`,
`useGeolocation.ts`, `MapPages.tsx`), à valider par capture d'écran.

| Situation | Position accepté | Position refusé |
|---|---|---|
| **Bannière de consentement** | S'affiche une fois, disparaît après clic "Accepter" | S'affiche une fois, disparaît après clic "Refuser" |
| **Centrage de la carte** | Centrée sur la position GPS réelle, mise à jour en continu (`watchPosition`) | Centrée sur une position de repli fixe (Paris 11e, codée en dur) |
| **Filtre "près de moi"** | Fonctionne, calcule la vraie distance à l'utilisateur | Fonctionne mais calcule la distance depuis Paris 11e, pas la vraie position de l'utilisateur, **résultat trompeur si l'utilisateur n'est pas à Paris** |
| **Message à l'utilisateur** | Aucun message persistant (juste la disparition de la bannière) | ✅ Corrigé le 04/09 : message permanent affiché sur la carte ("position non partagée, centrée sur Paris 11e") |
| **Recherche manuelle par ville** | Non applicable | ✅ Corrigé le 04/09 : champ de recherche par ville ajouté (`CitySearchFallback.tsx`), branché sur l'API Adresse |
| **Modification ultérieure du choix** | Page profil : bouton pour repasser à "refusé" | Page profil : bouton pour repasser à "accepté" |

### Point de vigilance RGPD, corrigé

Le refus de géolocalisation était bien respecté techniquement (aucune donnée
de position réelle utilisée), mais l'expérience utilisateur se dégradait
silencieusement : l'utilisateur qui refusait voyait des résultats basés sur
Paris sans le savoir. Corrigé le 04/09 par un message explicite et une
recherche manuelle par ville, sur la carte elle-même.

### Captures, faites le 10/09/2026

Les 4 captures listées ci-dessous existent désormais, sur l'application qui tourne (pas
une maquette) : voir `docs/RGPD_TABLEAU_CONSENTEMENT.md` §5, qui les intègre directement.

1. ✅ Bannière de consentement au premier chargement
2. ✅ Carte juste après "Accepter", position réelle, offres triées par distance
3. ✅ Carte juste après "Refuser", repli sur Paris avec message explicite et recherche
   manuelle par ville
4. ✅ Page profil montrant le statut "accepté" / "refusé" avec les boutons de bascule
5. Non fait séparément : le filtre "près de moi" n'a pas été capturé isolément dans les
   deux états, mais les captures 2 et 5 du document ci-dessus montrent déjà des résultats
   différents (offres triées par distance réelle vs liste de repli).

---

## 3. Audit RGAA, dashboard employeur (`frontend/src/features/employer/DashboardPage.tsx`)

Ajouté le 10/09/2026, 3e écran explicitement exigé, manquant de l'audit initial.
Testé en direct (pas seulement lu) : navigation au clavier réelle (Tab, 19 arrêts),
via un script automatisé sur l'application qui tourne, pas une inspection visuelle.

| Critère | État | Détail |
|---|---|---|
| Ordre de tabulation logique | ✅ Conforme | Menu latéral → contenu (offres/candidatures/publier) → bannière de consentement, ordre cohérent avec l'affichage visuel |
| Focus visible sur chaque élément atteint | ✅ Conforme | Contour ou ombre visible sur les 19 éléments testés (liens du menu, boutons, cartes d'action), aucune exception trouvée |
| Logo/lien d'accueil sans texte propre | ✅ Conforme | `Brand.tsx` : le lien enveloppe une image avec `alt="GéoEmploi"`, qui sert de nom accessible au lien (pas de nom accessible vide, correction faite après un premier test automatisé qui vérifiait `textContent` seul et donnait un faux positif, corrigé avant de conclure) |
| Images sans texte alternatif | ✅ Conforme | 0 trouvée (icônes décoratives des cartes de statistiques en SVG inline, `aria-hidden` par défaut sur les composants d'icônes du projet) |
| Boutons/liens sans nom accessible | ✅ Conforme | 0 trouvé après correction du test (voir ci-dessus) |
| Bannière de consentement géoloc affichée sur le dashboard employeur | ⚠️ À vérifier | La bannière "Votre position, uniquement pour la carte" s'affiche aussi sur `/pro/tableau-de-bord`, un écran qui n'utilise pas la géolocalisation. Pas un défaut RGAA à proprement parler (la bannière elle-même est accessible), mais une question de pertinence fonctionnelle à trancher : elle ne devrait probablement s'afficher que sur les écrans qui en ont l'usage |

### Ce qui n'a pas été testé sur cet écran

Contraste des couleurs (pas d'outil dédié utilisé, type axe/Wave), navigation réelle
au lecteur d'écran (le test ci-dessus mesure la présence d'un nom accessible, pas le
rendu effectif par un lecteur d'écran), et le formulaire "Nouvelle offre" (écran
séparé, non couvert par cet audit).

---

## 4. Ce que je ne peux pas garantir depuis le code seul

Cet audit est fait par lecture de code, pas par test réel au clavier/lecteur
d'écran ni par mesure de contraste avec un outil dédié (type axe ou Wave). Les
lignes marquées ✅ sont probables mais pas vérifiées à l'outil, à confirmer
avant de les livrer à Florine comme définitivement conformes.
