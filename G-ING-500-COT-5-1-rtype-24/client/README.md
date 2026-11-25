# Client R-Type (`r-type_client`)

Partie D (Alexis) : fenêtre, affichage des sprites, clavier, sons et musique, menus, salle
d'attente, interpolation. Tout le code est dans `client/` (et la page `docs/documentation_du_projet/accessibility.md`).

> Le sujet demande une documentation en anglais : ce README devra être traduit avant le rendu.

---

## 1. Installer et compiler

### Ce qu'il faut sur la machine (Linux)

Un compilateur C++20, CMake 3.20 ou plus, Git, et les bibliothèques graphiques du système dont SFML
a besoin :

```sh
sudo apt install libx11-dev libxrandr-dev libxcursor-dev libxi-dev libudev-dev libgl1-mesa-dev
```

SFML 3.0.2 n'est **pas** à installer : CMake le télécharge tout seul (gestionnaire CPM,
fichier `cmake/Dependencies.cmake`).

### Compiler

Depuis la racine du dépôt :

```sh
cmake --preset debug               # préparation (la 1re fois : quelques minutes, SFML se télécharge)
cmake --build --preset debug       # compilation
```

Astuce : `export CPM_SOURCE_CACHE=~/.cache/CPM` avant la première commande évite de retélécharger
SFML à chaque nouveau dossier de build.

L'exécutable est créé ici : `build/debug/client/r-type_client`. À chaque compilation, CMake copie
à côté de lui `client/assets/` (sons, musiques, police) et les planches du dossier `sprites/` de la
racine du dépôt : il n'y a rien à copier à la main.

### Sur Windows

Prérequis : **Visual Studio 2022** avec la charge de travail « Développement Desktop en C++ » (elle
contient CMake) et Git. Il n'y a pas d'autre bibliothèque à installer.

Dans « Developer PowerShell for VS 2022 », depuis la racine du dépôt :

```powershell
cmake --preset debug
cmake --build --preset debug
.\build\debug\client\Debug\r-type_client.exe
```

Visual Studio range l'exécutable dans un sous-dossier `Debug\` ; les assets y sont copiés aussi. Une
fenêtre de console s'ouvre à côté du jeu : c'est normal, elle affiche les éventuels messages
d'erreur.

Ce qui a été vérifié sur Windows, et la consommation du jeu (processeur, mémoire) : voir la
section 5.

Pour compiler sans le client (serveur seul, sans SFML) :
`cmake --preset debug -DRTYPE_BUILD_CLIENT=OFF`.

---

## 2. Lancer le client

```sh
./build/debug/client/r-type_client                        # ouvre le menu principal
./build/debug/client/r-type_client --help                 # affiche l'aide
./build/debug/client/r-type_client --boss-preview         # affiche les boss sans démarrer de partie
./build/debug/client/r-type_client --name Alexis          # choisit son nom de joueur
./build/debug/client/r-type_client --host 192.168.1.10 --port 4300
                                                          # va directement à l'écran de connexion
./build/debug/client/r-type_client --config autre.cfg     # utilise un autre fichier de réglages
```

| Option | Rôle |
|---|---|
| `--host <adresse>` | adresse du serveur ; ouvre directement l'écran Multiplayer |
| `--port <port>` | port UDP de `r-type_server` (4300 par défaut) |
| `--boss-preview` | affiche les quatre boss et leurs projectiles sans lancer de partie ; flèches gauche/droite pour changer |
| `--name <nom>` | nom du joueur |
| `--config <fichier>` | fichier de réglages (par défaut `client.cfg`, dans le dossier où on lance) |
| `-h`, `--help` | aide |

En cas d'option invalide, le programme s'arrête avec le code 84.

---

## 3. Jouer

### Les écrans

```
Menu principal ─ Solo game ───────────────────────► Salle d'attente ─► Jeu ─► Fin de partie
               ├ Multiplayer ─► Connexion ────────►        ▲                       │
               ├ Settings (volumes, touches)               └──── Play again ◄──────┘
               └ Quit
```

- **Menus** : flèches haut/bas puis Entrée (ou Espace), ou la souris (survol + clic). Échap pour
  revenir en arrière.
- **Solo game** : ouvre la salle d'attente ; choisir **Ready** pour lancer la partie.
- **Multiplayer** : sélectionner une ligne (adresse, port, nom), taper au clavier, Retour arrière pour
  effacer, puis **Connect** : on arrive dans la salle d'attente. **Ready** rejoint la salle du serveur
  et la partie démarre (voir « Jouer en réseau » ci-dessous).
- **Settings** : gauche/droite pour régler le volume de la musique et des sons, et la **difficulté**
  (Easy, Normal, Hard) de la partie solo ; en réseau, c'est le serveur qui choisit. Entrée sur une
  action, puis appuyer sur la nouvelle touche (Échap pour annuler). **Reset keys** remet les
  touches par défaut. Tout est enregistré immédiatement dans `client.cfg`.

### Touches en jeu (par défaut)

| Action | Touche |
|---|---|
| Se déplacer | Flèches |
| Tirer | Espace (tapoter pour des tirs simples, maintenir pour charger le beam : la jauge BEAM se remplit) |
| Pause | Échap (menu Resume / Quit to menu) |
| Résumé (voix) | Tab : la voix dit le score, les vies, la vitesse, la puissance, le niveau ou la vague, le boss |
| Plein écran | F11 (non modifiable) |

En solo, la pause **fige** la partie. En ligne, elle ne peut pas l'arrêter : la partie continue pour les
autres joueurs (le serveur ne s'arrête pas pour un joueur) et ton vaisseau reste sans commande.

À l'écran : score et vies en haut, jauge BEAM en bas, et une étiquette P1 à P4 au-dessus de chaque
vaisseau. Chaque joueur a une couleur de vaisseau différente (une ligne de la planche
`r-typesheet42.gif` par joueur).

Quand le boss arrive, une alarme sonne et une **barre de vie à son nom** s'affiche en haut, avec le
pourcentage écrit à côté. Elle passe au rouge, avec « ENRAGED », quand le boss entre en phase 2 (à
la moitié de sa vie), et disparaît quand il meurt (grosse explosion et « BOSS DESTROYED! »). Le
client utilise les sprites des planches `r-typesheet30.gif` (Dobkeratops), `r-typesheet32.gif`
(Gomander), `r-typesheet37.gif` (Warship) et `r-typesheet38.gif` (Compiler). En campagne, le
niveau 1 montre Dobkeratops et le niveau 2 Gomander ; en mode sans fin, le boss visuel change toutes
les cinq vagues et parcourt les quatre sprites.

Cette sélection est visuelle : le protocole actuel envoie le type générique `Boss`, pas l'identité
du boss. Les projectiles affichés en partie restent ceux reçus du serveur : le serveur crée les
boules des boss comme des `EnemyBullet` (donc elles blessent le vaisseau), et le champ `extra` du
snapshot dit laquelle des quatre boules dessiner (Dobkeratops, Gomander, Warship, Compiler).
Les bonus ont chacun leur sprite et une lettre au-dessus : **P** (Power, arme plus forte) et **S**
(Speed, vaisseau plus rapide), avec un son différent quand on les prend.

Le numéro de **niveau** (ou de **vague** en mode Endless) est écrit sous les scores, et une grande
bannière l'annonce au début de chaque niveau ou vague (« WAVE 4 », en rouge « BOSS WAVE 5 » toutes
les 5 vagues). Le fond de la partie change de couleur à chaque niveau. En Endless, l'écran de fin
affiche « GAME OVER - WAVE N » et le score final. En réseau, le serveur transmet le numéro dans
les snapshots.

**Pour les joueurs aveugles** : une voix lit les menus (la ligne sélectionnée, le nom de l'écran, les
lettres tapées) et les messages du jeu ; la touche Résumé donne l'état de la partie ; un ennemi qui
apparaît fait un bip placé à gauche ou à droite de notre vaisseau, plus aigu s'il est plus haut.
*Settings > Voice* coupe la voix (elle est activée par défaut). Détails :
`docs/documentation_du_projet/accessibility.md`.

**Prédiction** : notre vaisseau bouge dès qu'on appuie sur une touche, sans attendre la réponse du
serveur (`world/Prediction.*`, avec les fonctions de déplacement du serveur). Quand un snapshot
arrive, la position est corrigée doucement à partir de celle du serveur (`ackInputSeq`).

### Jouer en réseau (2 machines ou plus)

1. Sur la machine serveur, lancer la salle de jeu (port UDP 4300 par défaut) :
   `./build/debug/server/r-type_server --port 4300`
   (ajouter `--difficulty easy|normal|hard` pour choisir la difficulté de la salle et `--mode campaign|endless` pour la campagne ou le mode sans fin ; `--room-instance`
   doit rester `1`, la valeur que le client envoie toujours).
2. Trouver l'adresse IP de cette machine sur le réseau local (`ip addr` sous Linux, `ipconfig` sous
   Windows), par exemple `192.168.1.10`. Le pare-feu doit laisser passer le port UDP 4300.
3. Sur chaque machine joueur :
   `./build/debug/client/r-type_client --host 192.168.1.10 --name Alexis`
   (ou **Multiplayer** dans le menu, puis l'adresse et le port 4300), puis **Connect** et **Ready**.

Le serveur crée le vaisseau dès qu'un joueur rejoint : le premier joueur prêt lance la partie, les
suivants la rejoignent en cours de route (4 joueurs maximum). La partie est la campagne complète :
niveau 1 « Bydo outpost », puis niveau 2 « The cavern » ; on gagne à la fin du second. À la fin de la
partie, chaque client quitte la salle ; quand tout le monde l'a quittée, le serveur la remet à zéro et
**Play again** relance une nouvelle partie.

Messages possibles : « No answer from ... » (pas de serveur à cette adresse ou ce port, ou pare-feu),
« The room is full » (déjà 4 joueurs), « Connection lost » (plus rien reçu pendant 5 secondes : on
revient à l'écran de connexion).

---

## 4. Tester

### Tests automatiques

Depuis un clone neuf, une seule ligne compile tout (Release avec les avertissements en erreurs, comme la CI) et lance tous les tests :

```sh
cd "$(git rev-parse --show-toplevel)" && cmake --preset ci && cmake --build --preset ci -j && ctest --preset ci --output-on-failure
```

Elle marche depuis n'importe quel dossier du clone : sa première partie revient à la racine du dépôt (le dossier qui contient `CMakePresets.json`), là où sont les presets.
Résultat attendu : `100% tests passed, 0 tests failed out of 486` (moteur 65, réseau 88, jeu 244, serveur 45, client 37, pong 7).
Les dépendances sont téléchargées au premier build (quelques minutes) ; `CPM_SOURCE_CACHE` permet de les réutiliser.

```sh
ctest --preset debug                          # tous les tests du projet (build debug)
./build/debug/client/tests/client_tests       # seulement ceux du client
```

Ce que vérifient les tests du client :
- `ClientWorld_test.cpp` : ajout et suppression des entités à chaque snapshot, snapshots anciens
  ignorés, interpolation (à mi-chemin entre deux snapshots, l'entité est à mi-chemin, notre vaisseau
  compris), détection de la destruction de notre vaisseau, comptage des tirs et explosions pour les
  sons ;
- `Config_test.cpp` : touches par défaut, échange de touches, sauvegarde puis rechargement du fichier,
  valeurs invalides ignorées ;
- `UdpConnection_test.cpp` : conversion d'un `SNAPSHOT` du serveur ; une partie avec un faux serveur
  sur 127.0.0.1 (`CONNECT` après **Ready**, `ACCEPT` qui lance la partie, `INPUT`, `GAME_END` qui
  termine la partie et envoie `LEAVE`) ; erreur si le serveur ne répond pas ;
- `Assets_test.cpp` : chaque son du jeu se charge avec SFML, chaque bonus a son propre sprite, le
  serveur solo applique la difficulté choisie.

`ClientWorld_test.cpp` vérifie aussi la vie du boss (apparition, coups, phase 2, destruction) et
les bonus pris (ceux qui sortent de l'écran ne comptent pas), et `Config_test.cpp` la sauvegarde de
la difficulté.

### Vérifications à la main

1. Lancer le client, **Solo game**, puis **Ready** : la partie démarre avec la musique.
2. Se déplacer avec les flèches et tirer avec Espace : son de tir, ennemis qui explosent, score qui
   augmente.
3. Se faire toucher : son, une vie en moins, le vaisseau réapparaît.
4. Échap : le menu de pause s'affiche.
5. Dans **Settings**, changer la touche de tir (par exemple X), relancer une partie et vérifier que X
   tire.
6. Fermer et relancer le client : les réglages sont toujours là (`client.cfg`).

---

## 5. Linux, Windows, PC faibles ou puissants

### Résumé des vérifications

| Vérification | Résultat |
|---|---|
| Compilation Linux (GCC), presets `debug` et `ci` (avertissements = erreurs) | OK |
| Tests : `cmake --preset ci`, `cmake --build --preset ci`, `ctest --preset ci` | OK : 486 tests sur 486, dont 37 du client |
| Mise en forme du code (clang-format 18, comme la CI) | OK |
| Parties jouées sur Linux : menus, réglages, partie, pause, fin de partie, *Play again* | OK |
| Compilation pour Windows (`r-type_client.exe`) | OK, mais compilé depuis Linux (voir plus bas) |
| Lancement sur un vrai PC Windows | **Pas encore fait** : à faire avant la soutenance |
| Connexion à `r-type_server` (2 clients sur la même machine) | OK : 2 joueurs, 20 snapshots par seconde, déplacements, départ (`LEAVE`) |
| Partie sur 2 machines en Wi-Fi | **Pas encore fait** : à faire avant la soutenance (section 3) |

### Linux

PC de test : processeur Intel Core i7-1355U (12 cœurs logiques), 14 Go de RAM, carte graphique
intégrée Intel, écran 1920×1200, Ubuntu.

### Windows : ce qui a été testé

Je n'avais pas de PC Windows. J'ai donc utilisé **llvm-mingw**, un compilateur qui tourne sous Linux
mais qui fabrique des programmes Windows (on appelle ça une « compilation croisée »). Résultat :

- `r-type_client.exe` (3,7 Mo) et `client_tests.exe` sont bien créés ;
- le dossier `assets/` est bien copié à côté (sons, musiques, police et les 42 planches de
  `sprites/`) ;
- le code du client n'utilise que SFML et la bibliothèque standard du C++ : aucune fonction propre à
  Linux.

Ce test a trouvé **une vraie erreur** dans `Config.cpp` : des boucles utilisaient un `int` comme
indice d'un tableau, alors que la taille d'un tableau est un `std::size_t` (entier sans signe). GCC
sous Linux laissait passer, mais Clang (et donc la compilation Windows) refusait, car la CI
transforme les avertissements en erreurs. Correction :

```cpp
// avant : un int pour l'indice              -> _keys[i] refusé par Clang
for (int i = 0; i < kActionCount; i++) { ... _keys[i] ... }
// après : un std::size_t, le type attendu par []
for (std::size_t i = 0; i < _keys.size(); i++) { ... _keys[i] ... }
```

Une autre erreur est apparue dans SFML lui-même (`OutputSoundFile.cpp`), mais seulement avec le
compilateur llvm-mingw. Je l'ai contournée pour ce test uniquement ; elle ne concerne pas Visual
Studio, qui est le compilateur utilisé sous Windows.

**Ce qui n'a pas été testé** : la compilation avec Visual Studio (MSVC) et le lancement du jeu sur
Windows. La partie Windows de la CI vérifiera la compilation. Pour le lancement, sur un PC Windows de
l'équipe :

1. compiler avec les commandes de la section 1 (« Sur Windows ») ;
2. lancer `.\build\debug\client\Debug\r-type_client.exe` ;
3. vérifier : la fenêtre s'ouvre au centre, le texte s'affiche, la musique joue, **Solo game** puis
   **Ready** lance une partie, les sprites s'affichent, les touches marchent ;
4. vérifier que `client.cfg` est créé dans le dossier d'où on a lancé le jeu.

### Consommation mesurée

Mesures faites sur le PC de test ci-dessus, pendant une partie solo avec des ennemis à l'écran, en
version **debug** (la plus lente) et **serveur local compris** : le PC fait donc tourner le client et
le jeu en même temps. En réseau, le client aura moins de travail, puisque le serveur fera tourner le
jeu.

| Mesure | Valeur |
|---|---|
| Processeur | environ **15 % d'un seul cœur** (soit à peine plus de 1 % du processeur entier, qui a 12 cœurs logiques) |
| Mémoire vive (RAM) | environ **75 Mo** |
| Images par seconde | 60 (c'est la limite fixée dans le code) |
| Carte graphique | OpenGL de base : une carte graphique intégrée suffit |
| Taille de l'exécutable | 27 Mo sous Linux en debug (infos de débogage comprises), 3,7 Mo pour le `.exe` Windows |
| Taille des assets | 1,4 Mo |

### Pourquoi ça marche sur un PC faible comme sur un PC puissant

- **60 images par seconde maximum** (`setFramerateLimit(60)`) : un PC puissant ne va pas plus vite,
  et le processeur ne tourne pas à 100 % pour rien.
- **Tout dépend du temps écoulé (`dt`)**, jamais du nombre d'images : un PC lent affiche moins
  d'images, mais les étoiles, les animations et l'interpolation vont à la même vitesse.
- **`dt` est limité à 0,1 seconde** : si le PC est vraiment très lent (moins de 10 images par
  seconde), le jeu ralentit au lieu de faire « sauter » les objets d'un coup.
- **Les touches partent 60 fois par seconde** quoi qu'il arrive, même si le PC affiche moins
  d'images. C'est le serveur qui calcule le jeu, donc tous les joueurs ont la même vitesse.
- **Taille de la fenêtre** : 1280×720 au départ, ou 960×540 si l'écran est plus petit que 1360×800.
  La fenêtre s'ouvre au centre de l'écran et **peut être agrandie** : on tire sur un bord, on utilise
  le bouton d'agrandissement, ou on appuie sur **F11** pour le plein écran (F11 de nouveau pour en
  sortir). Le jeu est toujours dessiné en 960×540 puis mis à l'échelle en gardant ses proportions
  16:9 : sur un écran plus large ou plus haut, des bandes noires apparaissent sur les côtés, et on
  voit exactement la même chose sur tous les écrans. La taille minimale est 640×360. La souris
  suit : les menus restent cliquables à toutes les tailles.

Je n'ai pas testé sur un vieux PC : si quelqu'un de l'équipe en a un, c'est un bon test à faire.

### Mesurer soi-même

Sous Linux, pendant que le jeu tourne :

```sh
ps -o %cpu,rss,cmd -C r-type_client     # %CPU = pourcentage d'un cœur, RSS = mémoire en Ko
top -p "$(pgrep -x r-type_client)"      # la même chose, mis à jour en direct (q pour quitter)
```

Sous Windows : Gestionnaire des tâches (Ctrl+Maj+Échap), onglet « Processus », colonnes
« Processeur » et « Mémoire ». Attention : Windows affiche un pourcentage du processeur **entier**, et
non d'un seul cœur, donc le chiffre paraît plus petit.

---

## 6. Comment le code est organisé

```
client/
├── CMakeLists.txt         bibliothèque client_lib + exécutable r-type_client + tests
├── assets/
│   ├── sounds/            effets sonores (.ogg) ; les sprites viennent de sprites/ à la racine
│   ├── voice/             un mot par fichier, lus à la suite par la voix (scripts/make_sounds.sh)
│   ├── music/             musiques du menu et du niveau (.ogg)
│   ├── backgrounds/       menu.jpg : fond des menus (générée par IA, projet scolaire) ;
│   │                      game.jpg : fond de la partie, défile lentement sous les étoiles ;
│   │                      si une image manque, l'écran garde le fond d'étoiles
│   └── fonts/             police Press Start 2P (licence libre OFL)
├── src/
│   ├── main.cpp           lit les options de la ligne de commande et lance le Client
│   ├── Client.*           fenêtre, boucle principale, écran courant, connexion
│   ├── Config.*           réglages + touches, lus et écrits dans client.cfg
│   ├── AssetManager.*     charge textures, polices et sons une seule fois, les retrouve par nom
│   ├── SoundPlayer.*      joue les sons et la musique avec le bon volume
│   ├── render/Background.*    fond étoilé qui défile
│   ├── render/ScrollingBackground.*  image de la partie qui défile (couleur par niveau)
│   ├── ui/Menu.*              liste de choix (clavier + souris), utilisée par tous les menus
│   ├── ui/TextUtils.*         affichage de texte
│   ├── screens/               un fichier par écran (MainMenu, Settings, Connect, Lobby, Game, GameOver)
│   ├── world/ClientWorld.*    entités reçues du serveur, interpolation (sans SFML)
│   ├── world/Prediction.*     prédiction de notre vaisseau (sans SFML)
│   ├── world/Sprites.*        quelle zone de quelle planche pour chaque type d'entité
│   └── network/
│       ├── ServerConnection.hpp   interface « ce que le client attend du serveur »
│       ├── NetworkConnection.cpp  crée la vraie connexion (UdpConnection)
│       ├── UdpConnection.*        connexion UDP à r-type_server (bibliothèque network)
│       └── LocalServer.*          serveur local pour le mode solo
└── tests/                 tests GoogleTest
```

### La boucle principale (`Client::run`)

À chaque image, environ 60 fois par seconde :
1. on lit les événements de la fenêtre (touches, souris, fermeture) et on les donne à l'écran
   courant ;
2. on met à jour la connexion au serveur (le serveur local fait tourner le jeu à ce moment-là) ;
3. l'écran se met à jour (`update(dt)`, où `dt` est le temps écoulé depuis l'image précédente) ;
4. on efface la fenêtre, l'écran se dessine, et on affiche.

Tout dépend de `dt` (le temps écoulé) et jamais du nombre d'images : le jeu va à la même vitesse sur
un PC lent ou rapide, comme le demande le sujet.

### Les écrans

Chaque écran hérite de la classe `Screen` et définit trois fonctions : `handleEvent`, `update` et
`draw`. Pour passer d'un écran à un autre, on appelle `client.changeScreen(...)` ; le changement a
lieu au début de l'image suivante, pour qu'un écran ne se détruise pas pendant qu'il s'exécute.

### Le client et le serveur

Le serveur décide de tout (positions, tirs touchés, morts, score). Le client :
- envoie ses touches 60 fois par seconde (`game::Input`, avec un numéro `seq` qui augmente) ;
- reçoit des « snapshots » (20 par seconde avec `r-type_server`, 30 avec le serveur local), qui
  contiennent la position de toutes les entités ;
- dessine ce que le serveur a envoyé.

Toutes les entités (joueurs, ennemis, tirs, explosions) sont rangées et dessinées de la même façon
dans `ClientWorld`. Le type d'entité (`game::EntityType`) dit simplement quel sprite afficher.

Pour que ce soit fluide :
- **Interpolation** : entre deux snapshots, chaque entité glisse de son ancienne position vers la
  nouvelle, au lieu de sauter. On dessine donc 60 images par seconde avec seulement 20 ou 30
  snapshots (le serveur donne son rythme dans `ACCEPT`).
- **Pas de prédiction pour l'instant** (décision d'équipe avant la défense du 24/10) : notre
  vaisseau est interpolé comme les autres entités. Le serveur décide de tout, le client affiche.
- Les snapshots plus vieux que le dernier reçu sont ignorés (en UDP, les paquets peuvent arriver
  dans le désordre).
- **Événements fiables** : le serveur numérote ses événements (`SPAWN`, `DESTROY`, `GAME_END`) pour
  toute la salle et les renvoie tant qu'ils ne sont pas acquittés ; le client acquitte le plus grand
  numéro reçu. Il n'a pas besoin de les appliquer dans l'ordre : `SPAWN` et `DESTROY` ne servent
  qu'à connaître la vie exacte des entités, et chaque snapshot contient de toute façon l'état complet
  (une entité manquée réapparaît au snapshot suivant).

### SFML reste séparé du reste

SFML (fenêtre, images, sons) n'est utilisé que dans la partie affichage : `Client`, `AssetManager`,
`SoundPlayer`, `screens/`, `ui/`, `render/`. La logique du monde (`world/ClientWorld`) et l'interface
réseau (`network/ServerConnection.hpp`) n'incluent pas SFML. Le code de gameplay (`game/`) ne la
connaît pas du tout. Les assets sont demandés par nom (`getTexture("r-typesheet42.gif")`).

### Les sprites (`world/Sprites.cpp`)

| Entité | Planche | Remarque |
|---|---|---|
| Vaisseau joueur | `r-typesheet42.gif` | 5 images de 33×17 par ligne, une ligne par joueur ; l'image change quand il monte ou descend |
| Bink | `r-typesheet5.gif` | 8 images, animé |
| Patapata | `r-typesheet3.gif` | 12 images |
| Tourelle | `r-typesheet11.gif` | 6 images |
| Carrier | `r-typesheet7.gif` | 6 images |
| Tir joueur / beam chargé | `r-typesheet1.gif` | le beam est le même tir, dessiné 2,5 fois plus grand |
| Tir ennemi | `r-typesheet1.gif` | boule orange ; les quatre boules de boss sont dessinées par forme et couleur selon `extra` |
| Explosion | `r-typesheet44.gif` | 4 images |
| Force | `r-typesheet30a.gif` | 3 images |
| Bonus Power | `r-typesheet12.gif` | 6 images, orbe orange |
| Bonus Speed | `r-typesheet16.gif` | 4 images, capsule verte et orange |
| Boss (Dobkeratops) | `r-typesheet30.gif` | 4 images de 155×203, dessiné à 80 % |

Pour changer un sprite, il suffit de modifier la ligne correspondante dans `getSpriteInfo`.

### Sons et musique

`sprites.zip` ne contient pas de sons. Les fichiers de `assets/sounds/` et `assets/music/` sont des
sons simples que j'ai générés (style 8 bits). On peut les remplacer par n'importe quel fichier `.ogg`
ou `.wav` portant le même nom.

| Fichier | Quand |
|---|---|
| `sounds/shoot.ogg` | un joueur tire |
| `sounds/explosion.ogg` | une explosion apparaît |
| `sounds/player_hit.ogg` | notre vaisseau est détruit |
| `sounds/menu_move.ogg`, `sounds/menu_select.ogg` | navigation dans les menus |
| `sounds/boss_alarm.ogg` | le boss arrive |
| `sounds/boss_hit.ogg` | le boss est touché (au plus un son toutes les 0,15 s) |
| `sounds/boss_enrage.ogg` | le boss passe en phase 2 |
| `sounds/boss_explosion.ogg` | le boss est détruit |
| `sounds/pickup_power.ogg`, `sounds/pickup_speed.ogg` | un bonus Power ou Speed est pris |
| `sounds/enemy.ogg` | un ennemi apparaît (placé à gauche / à droite, plus aigu s'il est plus haut) |
| `sounds/victory.ogg`, `sounds/game_over.ogg` | écran de fin : victoire (notes qui montent), défaite (notes qui descendent) |
| `voice/<mot>.ogg` | la voix qui lit les menus et le jeu (un mot par fichier) |
| `music/menu.ogg`, `music/stage1.ogg` | musique du menu, musique du niveau |

**Licences** : tous les sons et musiques ont été fabriqués pour ce projet (ondes 8 bits simples,
aucun enregistrement venant de quelqu'un d'autre) ; ils sont libres (CC0). La police Press Start 2P
est sous licence SIL Open Font License 1.1 (texte complet dans `assets/fonts/OFL-PressStart2P.txt`).
Les sprites viennent de `sprites.zip`, fourni avec le sujet (R-Type est un jeu d'Irem).
La voix (`assets/voice/`) et les sons `enemy.ogg`, `victory.ogg`, `game_over.ogg` sont générés par
`scripts/make_sounds.sh` : la voix vient de **Flite** (synthèse vocale libre de Carnegie Mellon
University, licence de type BSD), utilisée à travers ffmpeg ; rien n'est téléchargé.

---

## 7. Ce qui reste à faire

- **Partie sur 2 machines** : à tester en vrai avant la soutenance (section 3, « Jouer en réseau »).
- **Lobby TCP (avec Momo)** : le client se connecte directement à la salle UDP. Passer par
  `r-type_lobby` (liste des salles, Ready de tous les joueurs, `ROOM_START` qui donne l'adresse, le
  port, le `lobbyToken` et le `roomInstance`) reste à faire. Il suffira de donner ces valeurs à
  `UdpConnection` au lieu de `kDirectRoomInstance`.
- **Noms des autres joueurs** : le HUD affiche maintenant les scores et les vies de **tous** les
  joueurs (`snapshot.players`), mais le serveur n'envoie pas leurs noms : seuls « P2 », « P3 »…
  s'affichent pour les autres.
- **Salle d'attente** : elle est locale (le client n'envoie `CONNECT` qu'au moment de Ready), elle
  ne montre donc que soi. Il faudra le lobby TCP ou un message du serveur pour voir les autres.
- **Serveur local** : `LocalServer` sert au mode solo. Il ne réécrit pas le jeu : il appelle
  `game::stepGame` (code d'Ariel) et `game::startCampaign`, comme le serveur.
- **CI** : la machine Ubuntu de la CI doit installer les paquets de la section 1, sinon SFML ne
  compile pas (fichier `.github/workflows/ci.yml`, géré par Moïse).
- **Accessibilité** : la réassignation des touches, les volumes et la difficulté (solo) fonctionnent
  déjà. Les besoins par type de handicap et le plan pour la soutenance finale sont dans
  `docs/documentation_du_projet/accessibility.md`.
- **Numéro de stage (avec Momo)** : `Snapshot::stage` existe côté jeu mais n'est pas encore sur le
  fil (proposition : les bits hauts de `flags` dans le bloc `self`). Le client l'affiche déjà en solo
  (`ServerMessage::stage`, `endless`) : en réseau, il suffira de remplir ces deux champs dans
  `snapshotToMessage`.
- **Moteur générique (avec Moïse)** : quand `IAudio` / `IGraphics` existeront dans `engine/`,
  `SoundPlayer` (sons placés, voix mot par mot) et l'affichage deviendront leurs implémentations SFML.
