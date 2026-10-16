# ---- Stage 1 : dépendances ----
FROM node:22-alpine AS deps
WORKDIR /app
# Résout le DNS en IPv4 en premier (hôte sans routage IPv6 sortant fiable),
# et retries npm pour supporter les réseaux instables au build.
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY package.json package-lock.json* ./
RUN npm install --fetch-retries=6 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=20000 --fetch-retry-factor=2

# ---- Stage 2 : build (typescript + prisma client) ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Stage 3 : runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Même raisonnement qu'au stage deps (IPv6 sortant peu fiable sur l'hôte) :
# ENV n'est pas hérité entre stages Docker, donc à redéclarer ici pour que le
# fetch() des services externes en production utilise aussi l'IPv4 en priorité.
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Jamais publié sur le host — uniquement reachable via le réseau interne
# docker-compose, à l'adresse http://backend:3002 (cf. le proxy du frontend).
EXPOSE 3002

# Génère au besoin les secrets internes, applique les migrations puis démarre
# (cf. docker-entrypoint.sh).
CMD ["sh", "./docker-entrypoint.sh"]
