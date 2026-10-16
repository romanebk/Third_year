# Avis personnel et compléments — MY_PGP

Réponses aux derniers points de la checklist de révision : notre avis sur les 3 algos
implémentés, et les 4 sujets à approfondir (types d'AES, limites réelles du XOR, PGP vs GPG,
déroulement des tours AES).

---

## 1. Notre avis personnel sur RSA, AES, XOR

### XOR

Excellent point d'entrée pédagogique, mais c'est presque un piège : sa sécurité théorique
parfaite (le masque jetable, prouvée par Shannon) donne une fausse impression de simplicité.
En pratique, les deux conditions qui la rendent sûre (clé aussi longue que le message, usage
unique) sont extrêmement difficiles à respecter — et notre propre implémentation le montre :
le mode stream du sujet réutilise la même clé sur plusieurs blocs, ce qui casse déjà la
condition d'usage unique. Notre avis : un algo qu'on comprend en 5 minutes mais qu'on a presque
toujours envie d'utiliser *mal* en pratique, ce qui en fait un très bon cas d'école pour
comprendre pourquoi la théorie et la pratique divergent en crypto.

### AES

Le plus impressionnant à implémenter des trois, pas en difficulté algorithmique brute (le code
est mécanique une fois qu'on a compris la structure) mais en densité mathématique : voir
l'arithmétique de `GF(2^8)` (le corps de Galois) transformer quelques opérations bit à bit en
un chiffrement résistant à des décennies de cryptanalyse mondiale force le respect. Notre avis :
c'est le bon compromis entre sécurité et performance pour un usage réel aujourd'hui — on
comprend bien pourquoi c'est le standard mondial après l'avoir codé à la main plutôt qu'en
l'utilisant comme une boîte noire.

### RSA

Le plus "élégant" mathématiquement (toute la sécurité repose sur un seul problème dur : la
factorisation), mais aussi celui qui nous a donné la leçon la plus concrète du projet : une
implémentation naïve est catastrophiquement lente à l'échelle réelle (2048 bits), et il a fallu
une vraie optimisation (suppression d'allocation dans `biguint_divmod`, -37%) pour la rendre
praticable. Le bug de primalité qu'on vient de corriger (`P`/`Q` jamais vérifiés premiers)
montre aussi à quel point il est facile de laisser une hypothèse de sécurité fondamentale
non-vérifiée dans le code sans s'en rendre compte. Notre avis : RSA est beau sur le papier,
lourd en pratique — on comprend bien, après l'avoir implémenté, pourquoi personne ne l'utilise
pour chiffrer de gros messages directement (d'où PGP).

---

## 2. Différence entre chaque type d'AES (128 / 192 / 256)

| | AES-128 | AES-192 | AES-256 |
|---|---|---|---|
| Taille de clé | 16 octets (128 bits) | 24 octets (192 bits) | 32 octets (256 bits) |
| Nombre de rounds (`Nr`) | 10 | 12 | 14 |
| Taille de la clé expansée | 176 octets (11×16) | 208 octets (13×16) | 240 octets (15×16) |
| Résistance au quantique (Grover) | ~64 bits effectifs — faible | ~96 bits effectifs | ~128 bits effectifs — solide |

**Ce qui ne change JAMAIS entre les trois** : la taille de bloc (toujours 16 octets), et les 4
opérations de chaque round (`SubBytes`, `ShiftRows`, `MixColumns`, `AddRoundKey`). Seuls la
taille de clé et le nombre de rounds changent — plus de rounds = plus de "mélange" du message
avec la clé, donc plus de marge de sécurité, au prix d'un coût de calcul plus élevé
(`AES-256` fait 40% de rounds en plus qu'`AES-128`).

**Dans notre code** : `aes_key_schedule` déduit automatiquement `Nr` à partir de `key_len`
(`ctx->rounds = nk + 6`, où `nk = key_len / 4`) — un seul code gère les 3 variantes, pas de
duplication.

---

## 3. Limites réelles du XOR (au-delà de la théorie)

- **Réutilisation de clé = catastrophe pratique.** Si un attaquant intercepte deux messages
  chiffrés avec la **même** clé (ce qui arrive justement dans notre propre mode stream, qui
  réutilise la clé sur chaque bloc), il peut calculer `c1 ⊕ c2 = m1 ⊕ m2` — la clé disparaît
  complètement de l'équation. À partir de là, avec des techniques d'analyse de fréquence ou de
  "crib-dragging" (deviner des mots probables), on peut souvent reconstruire les deux messages
  en clair **sans jamais connaître la clé**. Cas réel historique : le projet **Venona**
  (USA/UK, années 1940-80) a partiellement cassé des communications soviétiques chiffrées par
  masque jetable, justement parce que l'URSS avait réutilisé certaines clés par erreur.
- **Aucune intégrité/authentification.** XOR protège la confidentialité, mais pas l'intégrité :
  un attaquant qui intercepte un chiffré peut en modifier un bit précis sans connaître la clé —
  ça modifie le bit correspondant du message déchiffré de façon prévisible (attaque par
  "bit-flipping"), sans que rien ne le détecte côté réception.
- **Le problème de partage de clé reste entier** (déjà vu) : XOR ne résout jamais comment
  transmettre la clé secrètement au départ.

---

## 4. Différence entre PGP et GPG

- **PGP** (*Pretty Good Privacy*) : le nom du logiciel original créé par **Phil Zimmermann en
  1991**. Le protocole qu'il a défini est ensuite devenu un standard ouvert, **OpenPGP**
  (RFC 4880, IETF). Aujourd'hui, "PGP" en tant que produit commercial appartient à des sociétés
  successives (actuellement dans le giron Broadcom/Symantec) — un logiciel propriétaire payant.
- **GPG** (*GNU Privacy Guard*, souvent "GnuPG") : une **réimplémentation libre et gratuite**
  du standard OpenPGP, créée par **Werner Koch à partir de 1997**, justement pour offrir une
  alternative libre au PGP original (qui utilisait RSA sous brevet à l'époque, et posait des
  problèmes de licence/export). GPG est aujourd'hui l'implémentation la **plus utilisée en
  pratique** dans l'écosystème libre (signature de commits Git, vérification de paquets Debian,
  etc.) — bien plus répandue que le PGP commercial.

**En résumé** : PGP est le nom historique du protocole/produit d'origine (aujourd'hui surtout
commercial), GPG est l'implémentation open-source dominante du même standard ouvert
(OpenPGP). Notre projet (`pgp-xor`/`pgp-aes`) s'inspire du **principe** PGP (hybride
asymétrique + symétrique), pas d'une implémentation particulière.

---

## 5. Comment fonctionnent les tours de l'AES (déroulé complet)

**Chiffrement d'un bloc** :
```
AddRoundKey (round initial, avec round_key[0])
Répéter (Nr - 1) fois :
    SubBytes
    ShiftRows
    MixColumns
    AddRoundKey (avec round_key[i])
Dernier round (sans MixColumns) :
    SubBytes
    ShiftRows
    AddRoundKey (avec round_key[Nr])
```

**Le rôle de chaque étape** :
- **`SubBytes`** (substitution, via la table `sbox`) : apporte la **confusion** — casse toute
  relation algébrique simple entre le message et le chiffré, la seule étape non-linéaire du
  chiffrement.
- **`ShiftRows`** (décalage des lignes) + **`MixColumns`** (mélange des colonnes via
  `GF(2^8)`) : apportent la **diffusion** — un seul bit changé dans le message d'entrée doit
  finir par affecter (presque) tous les bits du bloc chiffré après quelques rounds ("effet
  avalanche").
- **`AddRoundKey`** : la seule étape qui mélange réellement la **clé secrète** dans les
  données — sans elle, tout le reste ne serait qu'une permutation fixe et publique, cassable
  trivialement.

**Pourquoi le dernier round saute `MixColumns`** : l'omettre au dernier round ne change rien à
la sécurité (le déchiffrement ferait juste l'inverse une étape plus tôt ou plus tard, aucune
importance), mais ça simplifie légèrement l'implémentation du déchiffrement — c'est une
convention du standard FIPS-197, pas une optimisation qu'on a inventée.

**Déchiffrement** : exactement l'inverse, dans l'ordre inverse, en commençant par la
**dernière** sous-clé (puisque c'est là que le chiffrement s'est arrêté) — `InvShiftRows` →
`InvSubBytes` → `AddRoundKey` → `InvMixColumns`, répété à l'envers.
