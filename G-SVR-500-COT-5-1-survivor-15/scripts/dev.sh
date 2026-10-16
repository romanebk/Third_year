#!/usr/bin/env bash
# Lance le projet complet en local, en un seul script : dépendances, base de
# données (Docker, si utilisée en local), migrations, backend et frontend.
#
# Usage (depuis la racine du dépôt, ou n'importe où) :
#   ./scripts/dev.sh
#
# Détail des étapes manuelles équivalentes : docs/INSTALLATION.md
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { echo -e "\033[1;32m[dev.sh]\033[0m $*"; }
warn() { echo -e "\033[1;33m[dev.sh]\033[0m $*"; }
die() { echo -e "\033[1;31m[dev.sh]\033[0m $*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js introuvable. Installez Node 20+."
command -v npm >/dev/null 2>&1 || die "npm introuvable."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $NODE_MAJOR détecté, 20+ requis."

# 1. Variables d'environnement, à la racine (voir docs/INSTALLATION.md §3)
if [ ! -f "$ROOT_DIR/.env" ]; then
  warn ".env absent, copie de .env.example. Complétez les secrets JWT_* avant de continuer si besoin."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi
# Ne PAS "source" .env : des valeurs comme MAIL_FROM contiennent des
# caractères spéciaux shell (ex. "<") qui cassent un sourcing direct.
# Ce script n'a besoin que de DATABASE_URL et PORT pour sa propre logique ;
# le backend charge le reste lui-même (dotenv) au démarrage.
export DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" | tail -1 | cut -d= -f2-)"
PORT="$(grep -E '^PORT=' "$ROOT_DIR/.env" | tail -1 | cut -d= -f2-)"

# 2. Base de données. Docker uniquement si DATABASE_URL cible localhost
#    (base locale, docs/INSTALLATION.md §4 option B). Ignoré pour une base
#    partagée distante (AlwaysData ou autre), déjà migrée.
if echo "${DATABASE_URL:-}" | grep -qE '(localhost|127\.0\.0\.1)'; then
  if command -v docker >/dev/null 2>&1; then
    log "DATABASE_URL locale détectée, démarrage de PostgreSQL + PostGIS via Docker."
    docker compose up -d || true

    # docker-compose.yml fixe container_name: geoemploi-db. Si un conteneur de
    # CE nom, appartenant à un AUTRE projet Compose (autre clone/dossier sur la
    # même machine), tourne déjà, "up -d" échoue sur un conflit de nom et ne
    # crée rien pour NOUS. Bug réel rencontré : un ancien "docker inspect
    # geoemploi-db" par nom trouvait quand même ce conteneur d'un autre projet,
    # le déclarait "healthy", et migrate échouait plus loin avec une erreur
    # d'authentification confuse contre un serveur sans rapport. Fix : demander
    # à Compose l'ID du conteneur qu'IL a créé pour CE projet ("docker compose
    # ps", scopé par label de projet, jamais par nom global) plutôt que de
    # deviner via un nom qui peut désigner autre chose.
    CID="$(docker compose ps -q db 2>/dev/null)"
    if [ -z "$CID" ]; then
      die "Aucun conteneur de base créé pour ce projet (nom 'geoemploi-db' probablement déjà pris par un autre projet/clone sur cette machine). Solutions : 'docker rm -f geoemploi-db' si c'est un résidu inutile, ou changez le port hôte dans docker-compose.yml (ex. \"5433:5432\") et DATABASE_URL dans .env en conséquence."
    fi

    log "Attente de la base (healthcheck Docker, conteneur $CID)..."
    for _ in $(seq 1 30); do
      status="$(docker inspect --format='{{.State.Health.Status}}' "$CID" 2>/dev/null || echo unknown)"
      [ "$status" = "healthy" ] && break
      sleep 1
    done
    [ "$status" = "healthy" ] || warn "Base pas encore 'healthy' après 30s, on continue quand même."
  else
    warn "DATABASE_URL locale mais Docker introuvable. Assurez-vous qu'un PostgreSQL + PostGIS tourne sur cette URL."
  fi
else
  log "DATABASE_URL distante détectée, pas de Docker local à démarrer."
fi

# 3. Backend : dépendances, client Prisma, migrations
log "Installation des dépendances backend..."
(cd backend && npm install)

log "Génération du client Prisma..."
(cd backend && npm run prisma:generate)

log "Application des migrations (idempotent)..."
(cd backend && npx prisma migrate deploy --schema=../prisma/schema.prisma)

if echo "${DATABASE_URL:-}" | grep -qE '(localhost|127\.0\.0\.1)' && command -v psql >/dev/null 2>&1; then
  log "Activation de PostGIS (idempotent, CREATE EXTENSION IF NOT EXISTS)..."
  psql "$DATABASE_URL" -f "$ROOT_DIR/prisma/scripts/postgis/enable_postgis.sql" || warn "Échec psql, PostGIS peut déjà être activé."
fi

# 4. Frontend : dépendances
log "Installation des dépendances frontend..."
(cd frontend && npm install)

# 5. Lancement des deux serveurs de développement
mkdir -p /tmp/geoemploi-dev-logs
BACKEND_LOG="/tmp/geoemploi-dev-logs/backend.log"
FRONTEND_LOG="/tmp/geoemploi-dev-logs/frontend.log"

log "Démarrage du backend (log : $BACKEND_LOG)..."
(cd backend && npm run dev) > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

log "Démarrage du frontend (log : $FRONTEND_LOG)..."
(cd frontend && npm run dev) > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  log "Arrêt des serveurs..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM

sleep 3
log "----------------------------------------------------------------"
log "Backend   : http://localhost:${PORT:-3000}  (Swagger : /api/docs)"
log "Frontend  : http://localhost:5173"
log "Logs      : $BACKEND_LOG et $FRONTEND_LOG"
log "Ctrl+C pour tout arrêter."
log "----------------------------------------------------------------"

wait "$BACKEND_PID" "$FRONTEND_PID"
