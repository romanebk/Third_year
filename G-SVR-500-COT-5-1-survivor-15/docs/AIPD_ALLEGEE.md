# GéoEmploi, Analyse d'Impact relative à la Protection des Données (allégée)

Rédigée le 10 septembre 2026. Document autonome, distinct de la fiche de registre de
traitement (`docs/RGPD_FICHE_REGISTRE.md`) : annoncée à Florine Pontaillac le 8 septembre
comme manquante, avec livraison visée au 10 septembre. Méthodologie simplifiée (3 risques
CNIL : accès illégitime, modification non désirée, disparition des données), à jour du
retour à la version 1.0 (retrait gamification/abonnement, précision commune).

---

## 1. Description du traitement

**Finalité.** Mettre en relation des demandeurs d'emploi et des employeurs autour d'offres
géolocalisées à la précision de la commune. La géolocalisation sert uniquement au calcul
de distance pendant que la carte est ouverte.

**Données traitées** (détail colonne par colonne : `docs/RGPD_FICHE_REGISTRE.md` §5) :
identifiants de compte (e-mail, mot de passe haché), profil candidat (nom, compétences,
CV) ou employeur (raison sociale, SIRET), position de l'appareil (jamais persistée en
historique, voir §2), contenu des offres et candidatures, notifications, signalements.

**Base légale.** Exécution du contrat (mise en relation) pour les données de compte et de
candidature ; consentement explicite, spécifique et révocable pour la géolocalisation.

**Durées de conservation.** Compte actif : tant que le compte existe. Compte supprimé :
30 jours en état désactivé (réversibilité courte), puis effacement définitif automatisable
(`npm run purge:accounts`). Position géographique : aucune conservation au-delà de la
session de consultation de la carte, voir §2.

**Acteurs.** Un seul traitement, un seul responsable (l'éditeur du service), un seul
sous-traitant technique (hébergement local, aucun service tiers payant).

## 2. Un point à clarifier avant d'aller plus loin

Le cahier des charges initial évoquait une purge des « historiques de localisation de
plus de 90 jours ». Vérifié dans le code (`prisma/schema.prisma`, aucune table ni colonne
d'historique de position) : **il n'existe aucun historique de position à purger**, parce
qu'aucun n'est jamais enregistré. `JobseekerProfile.latitude/longitude` sont écrasés à
chaque mise à jour de position, sans journal des valeurs précédentes. Ce document analyse
donc les risques du traitement tel qu'il existe réellement, pas celui, plus large,
initialement redouté.

## 3. Principes fondamentaux, proportionnalité

- La position exacte du candidat n'est jamais stockée en base (seul le dernier point connu
  l'est, sur le profil, et seulement si la géolocalisation a été consentie).
- La position d'une offre est résolue au **centroïde de la commune**, jamais à l'adresse
  exacte, depuis le retour à la version 1.0 (8 septembre 2026, instruction Florine
  Pontaillac, point 3.2 du cahier des charges) : réduit mécaniquement la précision de
  toute donnée de localisation exposée publiquement, y compris pour les offres.
- Le consentement à la géolocalisation est dissociable du compte : le refuser ne prive
  d'aucune fonctionnalité (recherche par ville en repli).
- Aucune donnée n'est transmise à un tiers commercial : géocodage et cartographie
  reposent uniquement sur des services publics gratuits de l'État (API Adresse, IGN
  Géoplateforme), pas de profilage publicitaire, pas de revente de données.

## 4. Risque 1, accès illégitime aux données

**Menaces.** Vol d'identifiants, interception d'un jeton d'authentification, accès direct
à la base de données, fuite du CV stocké sur disque.

**Mesures existantes.** Mots de passe hachés (bcrypt, jamais en clair, jamais retournés
par l'API, vérifié explicitement y compris dans l'export de portabilité). Authentification
par jeton à courte durée de vie (15 minutes) plus jeton de rafraîchissement stocké haché
en base, révocable à la déconnexion ou à la suppression de compte. CV stocké sur disque
local (pas d'objet cloud managé), jamais exposé par une URL publique directe, uniquement
téléchargeable par son propriétaire ou l'employeur ayant reçu la candidature correspondante
(vérifié : la route refuse l'accès au CV d'une candidature reçue par un autre employeur).
Rôles vérifiés à chaque route sensible (`requireAdmin`, `requireEmployer`, etc.).

**Mesures absentes, assumées.** Pas de chiffrement au repos de la base de données
elle-même (dépend de l'hébergement, hors périmètre applicatif). Pas d'authentification à
deux facteurs.

**Gravité résiduelle.** Limitée : les données les plus sensibles (mot de passe) sont
hachées, la donnée de géolocalisation la plus précise possible (position candidat au
moment de la consultation) n'est jamais journalisée.

## 5. Risque 2, modification non désirée des données

**Menaces.** Une personne modifie ou supprime des données qui ne lui appartiennent pas
(profil, offre, candidature d'un autre compte).

**Mesures existantes.** Toute modification passe par une route authentifiée qui vérifie
la propriété de la ressource avant d'agir (offre : uniquement son employeur propriétaire
ou un administrateur en modération ; candidature : uniquement l'employeur de l'offre
concernée ; profil : uniquement son titulaire). Le changement de statut d'une candidature
notifie systématiquement le candidat concerné, pour qu'une modification reste visible par
la personne concernée plutôt que silencieuse.

**Gravité résiduelle.** Faible : aucune route de modification en masse ouverte sans
contrôle de propriété identifiée à ce jour.

## 6. Risque 3, disparition des données

**Menaces.** Panne, erreur humaine (suppression accidentelle), purge mal calibrée.

**Mesures existantes.** La suppression de compte est un processus en deux temps
(désactivation immédiate réversible, puis effacement définitif après 30 jours), pas une
suppression instantanée irréversible. La purge définitive est un script explicite,
disponible en mode simulation (`--dry-run`) avant toute exécution réelle. Aucune
suppression en masse automatique en dehors de l'archivage des offres expirées (30 jours,
un simple changement de statut, pas un effacement) et de cette purge de comptes.

**Mesures absentes, assumées.** Pas de sauvegarde automatisée de la base de données
documentée à ce jour (dépend de l'hébergement, hors périmètre applicatif de ce
démonstrateur).

**Gravité résiduelle.** Faible pour une perte accidentelle immédiate (délai de
réversibilité de 30 jours), plus élevée en cas d'incident d'hébergement sans sauvegarde,
point à traiter au niveau infrastructure plutôt qu'applicatif.

## 7. Conclusion

Les deux risques les plus significatifs identifiés (accès illégitime en cas de fuite de
jeton, disparition en l'absence de sauvegarde documentée) sont chacun atténués par une
mesure existante (jeton court + révocable ; délai de réversibilité de 30 jours), sans être
totalement supprimés : c'est attendu pour un démonstrateur technique qui ne dispose pas
d'une infrastructure de production complète (pas de sauvegarde automatisée, pas de
chiffrement au repos documenté). Aucun risque résiduel jugé disproportionné au regard de
la nature des données traitées (pas de données de santé, pas de données financières, la
donnée la plus sensible étant le mot de passe, systématiquement haché).

---

Rédigée par David Akodande-Agossa, 10 septembre 2026. Vérifications techniques : lecture
du code, requêtes sur la base de données réelle, tests directs des routes citées.
