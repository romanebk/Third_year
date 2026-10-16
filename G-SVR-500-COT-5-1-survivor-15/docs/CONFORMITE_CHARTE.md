# Conformité à la charte graphique — liste des écrans

Vérification par lecture de code (palette Tailwind, police, présence de la marque)
sur les 20 écrans réels de l'application, pas une revue pixel par pixel de chaque
capture. Palette de référence : `--forest:#1B4332` `--forest2:#2D6A4F`
`--lime:#C8E6C0` `--sage:#8FBC8F`, police `Montserrat` (texte) + `Spline Sans Mono`
(labels), nom de marque **GéoEmploi** (jamais "ChomageGo").

| # | Écran | Route | Statut | Détail |
|---|-------|-------|--------|--------|
| 1 | Vitrine (landing) | `/` | ✅ Conforme | |
| 2 | Carte publique | `/carte` | ✅ Conforme | |
| 3 | Détail d'offre (redirection) | `/offres/:id` | ✅ Conforme | redirige vers la carte |
| 4 | Connexion | `/connexion` | ✅ Conforme (corrigé le 2026-09-04) | "L'emploi, à la rue près" trouvé dans le carrousel visuel pendant la capture de la vidéo de présentation : la précision géo a été révisée à commune/arrondissement (voir [docs/SUIVI_CABINET.md](SUIVI_CABINET.md)), texte non aligné. Corrigé le jour même (`AuthShell.tsx`) |
| 5 | Inscription | `/inscription` | ✅ Conforme (corrigé le 2026-09-04) | même carrousel visuel que la connexion (`AuthPanelCarousel.tsx`), même correction appliquée |
| 6 | Mot de passe oublié | `/mot-de-passe-oublie` | ✅ Conforme | |
| 7 | Réinitialisation mot de passe | `/reinitialisation/:token` | ✅ Conforme | |
| 8 | Mentions / données | `/mentions/donnees` | ✅ Conforme | |
| 9 | CGU | `/cgu` | ✅ Conforme | |
| 10 | Dashboard candidat | `/app` | ✅ Conforme | |
| 11 | Carte (candidat connecté) | `/app/carte` | ✅ Conforme | |
| 12 | ~~Réalité augmentée~~ | ~~`/app/ar`~~ | 🗑️ Retiré le 08/09/2026 | Mécanique de capture supprimée sur instruction Florine Pontaillac (retour v1.0), voir docs/JOURNAL_MODIFICATIONS.md |
| 13 | Mes candidatures | `/app/candidatures` | ✅ Conforme | |
| 14 | Notifications | `/app/notifications` | ✅ Conforme | |
| 15 | Profil candidat | `/app/profil` | ✅ Conforme | |
| 16 | ~~Badges~~ | ~~`/app/badges`~~ | 🗑️ Retiré le 08/09/2026 | Idem, voir docs/JOURNAL_MODIFICATIONS.md |
| 17 | Dashboard employeur | `/pro/tableau-de-bord` | ✅ Conforme | |
| 18 | Mes offres (employeur) | `/pro/offres` | ✅ Conforme | |
| 19 | Nouvelle offre | `/pro/offres/nouvelle` | ✅ Conforme | |
| 20 | Candidatures reçues (employeur) | `/pro/candidatures` | ✅ Conforme | |
| 21 | ~~Abonnement~~ | ~~`/pro/abonnement`~~ | 🗑️ Retiré le 08/09/2026 | Publication gratuite désormais, voir docs/JOURNAL_MODIFICATIONS.md |
| 22 | Modération (admin) | `/admin/moderation` | ✅ Conforme | |
| 23 | Utilisateurs (admin) | `/admin/utilisateurs` | ✅ Conforme | |
| 24 | Métriques (admin) | `/admin/metriques` | ✅ Conforme | |

## Notes générales

- **Précision géo dans les textes** : en plus des deux écrans ci-dessus, la même formule "à la rue près" traînait aussi dans `Footer.tsx` (visible en bas de plusieurs pages) et `LandingPage.tsx`. Corrigée en "à la commune près" partout, cohérent avec la décision actée dans [docs/SUIVI_CABINET.md](SUIVI_CABINET.md). Un seul endroit volontairement laissé tel quel : `NewOfferPage.tsx` ("la latitude/longitude du pin est la donnée enregistrée, à la rue près") décrit la précision réelle du géocodage de l'**adresse de l'offre** (donnée professionnelle publique de l'employeur), pas la position du candidat — contexte différent, pas soumis à la même contrainte de confidentialité.

- **Nom de marque** : aucune trace de "ChomageGo" trouvée dans les écrans réels (grep exhaustif sur `features/`, `pages/`, `components/`). Seul le fichier `frontend/charte-chomagego/charte.html` (référence graphique historique, jamais affiché aux utilisateurs) garde encore ce nom dans ses exemples visuels — pas un problème de conformité produit, mais à renommer si ce fichier est un jour partagé tel quel.
- **Couleurs hors palette de base** trouvées dans le code (`#FFC107`, `#FF3D00`, `#4CAF50`, `#1976D2` dans `LoginPage.tsx`) : ce sont les couleurs propres du logo Google, utilisées uniquement pour l'icône "Continuer avec Google" — conformes par nature, on ne recolore pas la marque d'un tiers.
- **Polices** : aucune police hors `Montserrat`/`Spline Sans Mono` trouvée dans le code des écrans.
