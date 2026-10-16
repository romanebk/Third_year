# Résumé : comment la base de données a été gérée

## Vue d’ensemble

Le projet utilise PostgreSQL avec Prisma comme ORM.

La base de données est centralisée côté backend, et elle sert à stocker :

- les utilisateurs
- les comptes OAuth liés
- les sessions / tokens
- les abonnements aux services
- les instances de widgets
- les préférences utilisateur
- les tokens de confirmation email

Le schéma complet se trouve dans :

- `backend/prisma/schema.prisma`

## Pourquoi Prisma

Prisma a été choisi pour plusieurs raisons :

- gestion simple des modèles et des migrations
- intégration naturelle avec Next.js
- typage fort côté TypeScript
- génération automatique du client Prisma
- gestion claire des migrations de schéma

Cela permet d’avoir une base de données robuste, lisible et facile à faire évoluer.

## Fichier principal de configuration

Le point central est :

- `backend/src/lib/db.ts`

Ce fichier expose le client Prisma singleton, utilisé partout dans le backend pour accéder à la base de données.

Cela évite de créer plusieurs instances Prisma dans l’application et permet un meilleur contrôle de la connexion.

## Schéma principal

Le fichier `schema.prisma` définit plusieurs modèles clés.

### `User`

Représente le compte utilisateur.

Champs importants :
- `email`
- `passwordHash` (si login classique)
- `emailVerified`
- `role` (`USER` ou `ADMIN`)
- `disabled`
- `image`

Ce modèle permet de gérer les comptes locaux et les comptes OAuth liés au même système.

### `Account`

Représente les comptes tiers authentifiés via OAuth.

Il stocke notamment :
- le provider (`github`, `google`, etc.)
- l’identifiant du compte fournisseur
- les tokens d’accès / refresh
- le `userId` qui relie le compte OAuth au `User`

Le projet chiffre les tokens sensibles avant stockage, ce qui est un point de sécurité important.

### `Session`

Le modèle `Session` est requis par le contrat NextAuth, même si le projet utilise la stratégie JWT.

Le projet ne repose pas sur des sessions persistées en base pour l’authentification active, mais le modèle est conservé pour rester compatible avec l’adapter NextAuth.

### `EmailVerificationToken`

Ce modèle stocke les tokens envoyés lors de l’inscription.

Le flux est :

1. l’utilisateur s’inscrit
2. le backend génère un token de vérification
3. le token est envoyé par email
4. l’utilisateur le confirme
5. le compte passe en `emailVerified`

### `ServiceSubscription`

Ce modèle représente l’abonnement d’un utilisateur à un service.

Exemples :
- GitHub
- YouTube
- Steam
- Weather
- etc.

Il permet au système de savoir si l’utilisateur a bien souscrit au service avant d’autoriser l’usage de ses widgets.

### `WidgetInstance`

C’est un modèle très important.

Il représente une instance de widget placée sur le dashboard d’un utilisateur.

Les champs clés sont :
- `service`
- `widget`
- `params` (JSON libre, selon les paramètres du widget)
- `refreshRateSeconds`
- `position`
- `userId`

Cela permet à chaque utilisateur d’avoir des widgets personnalisés, configurés différemment, avec leur propre cadence de rafraîchissement.

### `UserSettings`

Le projet centralise aussi les préférences utilisateur dans un modèle dédié.

Exemples :
- ville par défaut pour la météo
- unité de température
- dépôt GitHub suivi
- flux RSS préféré
- drapeau `defaultsSeeded` pour initialiser les widgets par défaut une seule fois

Cette approche évite de mélanger les préférences utilisateur dans des objets JavaScript volatils et permet de les réappliquer proprement à chaque widget par défaut.

## Pourquoi les `params` sont en JSON libre

Un point important du design :

- chaque widget n’a pas forcément les mêmes paramètres
- certains utilisent des chaînes, d’autres des entiers
- certains sont plus complexes

Au lieu de créer une table pour chaque widget, le projet stocke les paramètres dans un champ JSON :

- `params: Json`

Cela garde le schéma simple et extensible.

Le contrôle de validité est fait côté application, via les règles du service et des widgets, plutôt que via des relations SQL lourdes.

## Migrations

Les migrations Prisma sont gérées dans :

- `backend/prisma/migrations/`

Le projet utilise des migrations versionnées pour faire évoluer le schéma proprement.

Cela permet de :
- préserver la base de données
- documenter les changements
- faire évoluer le modèle sans casser le système

## Sécurité des données

Le projet met un vrai accent sur la sécurité des données sensibles :

- les tokens OAuth sont chiffrés avant stockage
- la clé de chiffrement est séparée de `NEXTAUTH_SECRET`
- les mots de passe sont hachés avec `bcryptjs`
- les clés API tierces sont également protégées dans la logique de stockage/usage

C’est une bonne pratique car les tokens OAuth et les clés API ne doivent pas rester en clair dans la base.

## Rôle de la base dans le dashboard

La base ne sert pas seulement à l’authentification.

Elle est aussi à la base du fonctionnement du dashboard :

- un utilisateur a plusieurs widgets
- chaque widget a des paramètres
- chaque widget a une cadence de refresh
- les données servent à afficher le dashboard personnalisé

La base est donc un pilier central du produit, pas seulement un simple stockage d’utilisateurs.

## Exemple de logique métier

Exemple dans le projet :

- un utilisateur ajoute un widget météo
- le backend crée une ligne dans `WidgetInstance`
- la ligne contient le service, le widget, le paramétrage, la position et le refresh interval
- le timer côté backend repère cette instance et la rafraîchit automatiquement

Sans la base, le système de widgets ne pourrait pas persister entre les sessions et les rechargements.

## Conclusion

La base de données a été pensée comme le cœur du système.

Elle stocke à la fois :
- les comptes et l’authentification
- les préférences utilisateur
- les services et abonnements
- les widget instances du dashboard

Le choix de Prisma + PostgreSQL est cohérent avec le projet :
- simple à maintenir
- bien structuré
- extensible
- sécurisé

C’est une base solide pour un dashboard personnalisé, évolutif et robuste.
