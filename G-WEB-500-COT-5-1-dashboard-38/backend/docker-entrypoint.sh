#!/bin/sh
# Démarrage du backend en conteneur.
#
# NEXTAUTH_SECRET (signature des sessions) et TOKEN_ENCRYPTION_KEY (chiffrement
# des tokens OAuth et des clés d'API) ne sont jamais écrits dans le dépôt. S'ils
# ne sont pas fournis par l'environnement (.env), ils sont générés au premier
# démarrage et conservés dans le volume /app/secrets : `docker-compose up`
# fonctionne donc sur un clone neuf, sans étape manuelle et sans secret dans git.
set -e

SECRETS_DIR="${SECRETS_DIR:-/app/secrets}"
mkdir -p "$SECRETS_DIR"

ensure_secret() {
  name="$1"
  eval "current=\${$name:-}"
  if [ -n "$current" ]; then
    return
  fi
  file="$SECRETS_DIR/$name"
  if [ ! -s "$file" ]; then
    (umask 077 && node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))" > "$file")
    echo "[entrypoint] generated $name (stored in the backend-secrets volume)"
  fi
  export "$name=$(cat "$file")"
}

ensure_secret NEXTAUTH_SECRET
ensure_secret TOKEN_ENCRYPTION_KEY

# `docker-compose up` doit marcher sur une base fraîche (volume Postgres vide)
# sans étape manuelle — migrate deploy (pas `migrate dev`) : n'invente pas de
# migration, applique juste celles déjà commitées dans prisma/migrations/.
npx prisma migrate deploy
exec npm run start
