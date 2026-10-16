# MY_PGP

Outil en ligne de commande de chiffrement/déchiffrement implémentant 6 systèmes
cryptographiques — **XOR**, **AES** (128/192/256), **RSA**, **PGP-xor**, **PGP-aes** et
**ElGamal** — codés entièrement à la main en **C99 strict**, sans aucune dépendance externe
(pas d'OpenSSL, pas de GMP, pas de libsodium). Projet pédagogique Epitech
(`G-CNA-500-COT-5-1-mypgp-27`).

## Sommaire

- [État d'avancement](#état-davancement)
- [Compilation](#compilation)
- [Utilisation](#utilisation)
- [Les systèmes cryptographiques](#les-systèmes-cryptographiques)
- [Bonus](#bonus)
- [Tests](#tests)
- [Architecture](#architecture)
- [Documentation complémentaire](#documentation-complémentaire)
- [Limites connues](#limites-connues)
- [Équipe](#équipe)

## État d'avancement

| `CRYPTO_SYSTEM` | Statut | Responsable |
|---|---|---|
| `xor` | ✅ Fait (mode bloc et stream) | Kenneth |
| `aes` | ✅ Fait (128/192/256, mode bloc et stream) | Kenneth |
| `rsa` | ✅ Fait (`-g`, `-c`, `-d`), optimisé pour les grandes clés | Ariel + Kenneth |
| `pgp-xor` | ✅ Fait (mode bloc et stream) | Ariel |
| `pgp-aes` | ✅ Fait (mode bloc et stream) | Ariel + Kenneth |
| `elgamal` | ✅ Fait (2e cryptosystème asymétrique : `-g`, `-c`, `-d`) | Kenneth |

Tous les systèmes sont câblés dans `main.c` et couverts par 179 tests unitaires Criterion
(95 % des lignes), 765 tests fonctionnels et 178 tests shell (voir [Tests](#tests)).

## Compilation

```bash
make          # compile le binaire my_pgp
make re       # recompile tout depuis zéro
make clean    # retire les fichiers objets
make fclean   # + retire le binaire et unit_tests
make tests_run          # compile et lance les tests unitaires Criterion (couverture)
make functional_tests   # lance tests/functional_tests.sh sur le binaire
```

Le binaire est compilé avec `gcc -g3 -Wall -Wextra -O2` (aucun warning, pas de relink) ; les
tests unitaires sont compilés sans optimisation et avec `--coverage`.

## Utilisation

```
USAGE
	./my_pgp CRYPTO_SYSTEM MODE [OPTIONS] [key]

DESCRIPTION
Cipher or decipher MESSAGE using a given CRYPTO_SYSTEM. The MESSAGE is read from the standard input.

   CRYPTO_SYSTEM
	"xor"		computation using XOR algorithm
	"aes"		computation using AES algorithm
	"rsa"		computation using RSA algorithm
	"pgp-xor"	computation using both RSA and XOR algorithm
	"pgp-aes"	computation using both RSA and AES algorithm

   MODE
	-c		MESSAGE is clear and we want to cipher it
	-d		MESSAGE is ciphered and we want to decipher it
	-g P Q		RSA only: don't read a MESSAGE, but instead generate a public and private key
	pair from the prime number P and Q

   OPTIONS
	-b		for XOR, AES and PGP, only works on one block. The MESSAGE and the symmetric
	key must be the same size

   key			Key used to cipher/decipher MESSAGE (incompatible with -g MODE)

   ELGAMAL (second asymmetric cryptosystem)
	"elgamal"	computation using ElGamal algorithm (generator 2)
	-g P X		generate a key pair from the prime number P and the private key X
	-c Y-P		cipher MESSAGE with the public key Y-P
	-d X-P		decipher a C1-C2 pair with the private key X-P

NOTES
	Numbers and keys are hexadecimal, little endian (lowest byte first).
	MODE, OPTIONS and key may be given in any order after CRYPTO_SYSTEM.
	pgp-xor and pgp-aes keys: SYMMETRIC_KEY:RSA_KEY, RSA keys: EXPONENT-MODULUS.
	On error, a message is written on stderr and the program exits with 84.
```

Le texte de `-h` reprend mot pour mot celui du sujet, puis documente `elgamal` (second
cryptosystème asymétrique) et les règles communes. Le binaire bonus (`./bonus/my_pgp -h`)
ajoute une section `BONUS` (voir [Bonus](#bonus)).

Le message à chiffrer/déchiffrer est toujours lu sur `stdin`, jamais passé en argument. Toutes
les clés et tous les nombres sont en **hexadécimal little-endian** (le premier octet écrit est
l'octet de poids faible). Après le `CRYPTO_SYSTEM`, le `MODE`, `-b` et la clé peuvent être
donnés dans n'importe quel ordre (`xor -b -c KEY` ≡ `xor -c KEY -b` ≡ `xor -c -b KEY`). Les
nombres chiffrés lus sur `stdin` tolèrent espaces, majuscules et fins de ligne `\r\n`.

Toute erreur (argument manquant ou en trop, double `MODE`, clé ou hexadécimal invalide, tailles
incompatibles en `-b`, message trop grand pour la clé...) écrit un message sur la sortie
d'erreur et quitte avec le code **84**.

## Les systèmes cryptographiques

### XOR

```bash
echo "You know nothing, Jon Snow" | ./my_pgp xor -c -b 576861742069732064656164206d6179206e6576657220646965
# → 20070f2700071c6a4449060a490515164e4e12190b190011063c
```
Chiffrement de Vernam (masque jetable). En mode bloc (`-b`), la clé doit faire exactement la
même taille que le message. En mode stream (par défaut), le message est découpé en blocs de la
taille de la clé, le dernier étant complété par des zéros.

### AES

```bash
echo "All men must die" | ./my_pgp aes -c -b 57696e74657220697320636f6d696e67
# → 744ce22c385958348f0df26eceb62eef
```
AES-128/192/256 (clé de 16/24/32 octets), conforme FIPS-197. En mode `-b`, le message doit
faire exactement un bloc (16 octets), quelle que soit la taille de la clé.

### RSA

```bash
# Génération de clés à partir de deux nombres premiers
./my_pgp rsa -g d3 e3
# → public key: 0101-19bb
# → private key: 9d5b-19bb

# Chiffrement avec la clé publique
echo "WF" | ./my_pgp rsa -c 0101-19bb
# → 8f84

# Déchiffrement avec la clé privée
echo "8f84" | ./my_pgp rsa -d 9d5b-19bb
# → WF
```
Exposant public choisi comme le plus grand nombre premier de Fermat compatible
(`3, 5, 17, 257, 65537`), exposant privé dérivé via l'inverse modulaire (algorithme d'Euclide
étendu) sur la fonction de Carmichael `λ(n) = ppcm(P-1, Q-1)`. Comme l'autorise le sujet
(p.6), `P` et `Q` sont supposés premiers sans vérification. RSA lit toujours une seule ligne
sur `stdin`, `-b` n'a pas d'effet sur lui.

Performances (binaire `-O2`) : une clé de 8192 bits est générée en quelques millisecondes et
un déchiffrement 8192 bits prend environ 0,2 s, grâce à :
- la division longue de Knuth (algorithme D, un limb du quotient par étape) pour `mod`, `gcd`
  et l'inverse modulaire ;
- l'exponentiation modulaire en représentation de Montgomery (CIOS) sur des limbs de 64 bits,
  avec une fenêtre glissante de 5 bits.

### PGP-xor / PGP-aes

```bash
echo "All men must die" | ./my_pgp pgp-aes -c -b 57696e74657220697320636f6d696e67:010001-c9f9...2fb3
# → 97f2af4c...9d41d          (clé symétrique chiffrée par RSA)
# → 744ce22c385958348f0df26eceb62eef   (message chiffré par AES)

echo "744ce22c385958348f0df26eceb62eef" | ./my_pgp pgp-aes -d -b 97f2af4c...9d41d:81b08f4e...2fb3
# → All men must die
```
Cryptosystème hybride : la clé passée en argument a la forme `SYMMETRIC_KEY:RSA_KEY`. Au
chiffrement, la clé symétrique est chiffrée avec la clé publique RSA (première ligne) et le
message avec la clé symétrique (seconde ligne). Au déchiffrement, la clé symétrique chiffrée et
la clé privée RSA sont passées en argument, le message chiffré est lu sur `stdin`. Les octets
nuls de poids fort de la clé symétrique, perdus par le passage en nombre RSA, sont restitués
(taille AES valide pour `pgp-aes`, taille du message pour `pgp-xor`).

### ElGamal (2e cryptosystème asymétrique)

```bash
./my_pgp elgamal -g e3 05          # P premier, X clé privée dans [1, P-2]
# → public key: 20-e3              (Y-P avec Y = 2^X mod P)
# → private key: 05-e3             (X-P)

echo "A" | ./my_pgp elgamal -c 20-e3 | ./my_pgp elgamal -d 05-e3
# → A
```
ElGamal sur le groupe multiplicatif `Z/pZ`, générateur `G = 2`. Le chiffrement tire une clé
éphémère `K` dans `/dev/urandom` et affiche la paire `C1-C2` avec `C1 = G^K mod P` et
`C2 = M·Y^K mod P` ; deux chiffrements du même message diffèrent donc (contrairement à RSA
« textbook »). Le déchiffrement calcule `M = C2·C1^(P-1-X) mod P` (petit théorème de Fermat).

## Bonus

Les bonus vivent dans `bonus/` (règle du sujet p.1), avec leur propre Makefile. Ils
produisent un binaire séparé, `bonus/my_pgp`, qui contient tout le programme obligatoire
plus deux améliorations proposées par la partie « Going further » du sujet (p.10). Le binaire
principal n'est pas modifié.

```bash
make bonus          # compile bonus/my_pgp
make bonus_tests    # tests des bonus + suite fonctionnelle obligatoire sur le binaire bonus
```

### Bonus 1 — clés RSA à partir de nombres premiers aléatoires

```bash
./bonus/my_pgp rsa -g          # clé de 2048 bits
./bonus/my_pgp rsa -g 1024     # taille en bits (décimal, de 64 à 8192)
# → public key: 010001-…
# → private key: …-…
# → prime P: …
# → prime Q: …
```
Deux premiers de taille moitié sont tirés dans `/dev/urandom` : on part d'un nombre impair
aléatoire dont les deux bits de poids fort sont à 1 (le produit a ainsi exactement la taille
demandée), puis on avance de 2 en 2 jusqu'à trouver un premier. Les candidats passent d'abord
un crible (division par les premiers inférieurs à 2000), puis le test de Miller-Rabin de
`bigint.c`. P − 1 et Q − 1 ne sont jamais multiples de 65 537, si bien que e = 65 537. Les
deux premiers sont affichés après les clés : `./my_pgp rsa -g P Q` redonne exactement les mêmes
clés. Ces formes de `-g` sont des erreurs dans le programme obligatoire, aucune commande du
sujet ne change de sens.

### Bonus 2 — padding PKCS#7 pour XOR et AES (`-p`)

```bash
echo "hello" | ./bonus/my_pgp aes -c -p 57696e74657220697320636f6d696e67 \
    | ./bonus/my_pgp aes -d -p 57696e74657220697320636f6d696e67
# → hello        (sans aucun octet nul en trop)
```
En mode flux, le dernier bloc est complété par N octets valant N (au lieu de zéros), avec un
bloc entier de padding quand le message est déjà aligné. Au déchiffrement, le padding est
vérifié puis retiré exactement : le message retrouvé est identique à l'original, même s'il se
termine par des octets nuls, et un mauvais padding (clé ou message faux) donne une erreur 84.
Le bloc mesure 16 octets pour AES et la taille de la clé (1 à 255 octets) pour XOR. `-p` est
refusé avec `-b` et avec les autres systèmes ; sans `-p`, rien ne change.

## Tests

```bash
make tests_run && gcovr --exclude tests/   # 179 tests unitaires Criterion + couverture
sh tests/functional_tests.sh               # 765 tests fonctionnels (boîte noire)
VALGRIND=1 sh tests/functional_tests.sh    # les mêmes sous valgrind (mode rapide)
sh tests/run_all.sh                        # 178 tests shell historiques
```

**Tests unitaires (Criterion)** — `tests/my_tests.c` (hex, buffer, io, ligne de commande,
usage, erreurs), `tests/unit_symmetric.c` (XOR, AES avec les vecteurs FIPS-197),
`tests/unit_asymmetric.c` (RSA, PGP-XOR, PGP-AES, ElGamal), `tests/unit_my_put.c` (fonctions
d'affichage) et `tests/test_bigint.c` (grands nombres). Couverture des lignes : 95 %.

**Tests fonctionnels** — `tests/functional_tests.sh` lance le binaire sous `timeout`, distingue
crash (signal), timeout et mauvaise sortie, et compare chaque résultat à un modèle Python
indépendant : formules RSA et `pow()`, convention XOR du sujet, AES recoupé avec
`openssl enc -aes-*-ecb`. Il couvre la génération de clés de 8 à 4096 bits par premier,
les messages vides, binaires, nuls ou de plusieurs Mo, les clés de session terminées par
`00`, et toutes les erreurs (code 84, rien sur stdout).

**Tests shell historiques** :

| Suite | Tests | Contenu |
|---|---|---|
| `test_cli.sh` | 32 | usage, codes retour, stderr, ordre libre des arguments |
| `test_xor.sh` | 24 | vecteur du sujet, stream, CRLF, erreurs, valgrind |
| `test_aes.sh` | 39 | vecteurs du sujet et NIST, stream, 192/256 bits, erreurs, valgrind |
| `test_rsa.sh` | 20 | vecteurs du sujet, P == Q, entrées limites, erreurs |
| `test_pgp_xor.sh` | 22 | vecteur, roundtrips, clé terminée par `00`, erreurs, valgrind |
| `test_pgp_aes.sh` | 18 | vecteur du sujet, roundtrips, erreurs, valgrind |
| `test_elgamal.sh` | 15 | génération, vecteur fixe, roundtrips aléatoires, erreurs |
| `test_perf.sh` | 8 | RSA `-g`/`-c`/`-d` sur clés 4096 et 8192 bits sous `timeout 2` |

Tous verts, sans fuite (valgrind) ni erreur mémoire ou comportement indéfini
(build `-fsanitize=address,undefined`).

## Architecture

```
src/            implémentation (.c)
include/        déclarations (.h)
tests/          tests unitaires Criterion, tests fonctionnels et scripts shell
bonus/          bonus (Makefile, sources et tests séparés)
docs/           documentation du projet (sujet, planning, benchmark, risques légaux...)
```

| Module | Rôle | Auteur |
|---|---|---|
| `error` | `my_pgp_die()` — stderr + exit 84 | Ariel |
| `my_put` | `my_putstr`, `my_putline`, `my_puterr`… : tout l'affichage du programme | Kenneth |
| `usage` | Texte de `-h` | Ariel |
| `buffer` | Buffer d'octets dynamique | Ariel |
| `hex` | Conversion hexadécimal ↔ octets | Ariel |
| `cli` | Parsing de la ligne de commande | Ariel + Kenneth |
| `io` | Lecture de `stdin` (ligne/flux, décodage hex) | Ariel (base) + Kenneth (extension) |
| `bigint` | Entiers en précision arbitraire (Knuth D, Montgomery 64 bits) | Ariel + Kenneth |
| `rsa` | Cryptosystème RSA | Ariel |
| `xor` | Cryptosystème XOR | Kenneth |
| `aes` | Cryptosystème AES-128/192/256 | Kenneth |
| `pgp_xor` | Cryptosystème hybride RSA + XOR | Ariel |
| `pgp_aes` | Cryptosystème hybride RSA + AES | Ariel + Kenneth |
| `elgamal` | Cryptosystème ElGamal | Kenneth |
| `main` | Point d'entrée, dispatch vers chaque module | Ariel + Kenneth |

## Documentation complémentaire

Dans `docs/` :
- `G-CNA-500-my_pgp.pdf` — le sujet original.
- `planification_my_pgp_C.pdf` — planning du projet (répartition, jalons).
- `plan-business-et-risques.pdf` — plan business, risques légaux, politique de confidentialité.
- `BENCHMARK.pdf` — mesures de performance et justification du choix du langage C.
- `avis-et-complements.md` — avis personnel sur RSA/AES/XOR, différences AES-128/192/256,
  limites réelles du XOR, PGP vs GPG, déroulé des tours AES.

## Limites connues

Volontairement assumées et documentées plutôt que cachées :
- RSA "textbook", sans padding (OAEP/PKCS#1) — chiffrement déterministe.
- Exposant public `e` limité aux 5 nombres premiers de Fermat (exigence du sujet).
- `P` et `Q` ne sont pas testés : avec `P == Q` ou un nombre composé, la clé produite suit la
  formule mais n'est pas une clé RSA valide.
- Pas d'exécution à temps constant (`powmod`/`divmod`) — vulnérable en théorie à une attaque
  par mesure de temps.
- Pas d'effacement sécurisé de la clé privée en mémoire.
- En mode stream, `pgp-xor` ne peut pas toujours retrouver la taille d'une clé symétrique
  terminée par plusieurs octets nuls (la taille du message chiffré n'en est qu'un multiple) ;
  en mode `-b`, elle est toujours restituée.
- ElGamal utilise le générateur fixe `G = 2`, sans vérifier qu'il engendre un grand
  sous-groupe de `Z/pZ*`.

## Équipe

- **Ariel** — RSA, PGP-xor, PGP-aes, fondations (`cli`, `error`, `buffer`, `hex`, `bigint`,
  base de `io`).
- **Kenneth** — XOR, AES, ElGamal, optimisation RSA (`bigint`), extension de `io` et `cli`.
