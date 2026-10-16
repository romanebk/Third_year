# ---- Stage 1 : dépendances ----
FROM node:22-alpine AS deps
WORKDIR /app
# Résout le DNS en IPv4 en premier (hôte sans routage IPv6 sortant fiable),
# et retries npm pour supporter les réseaux instables au build.
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY package.json package-lock.json* ./
RUN npm install --fetch-retries=6 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=20000 --fetch-retry-factor=2

# ---- Stage 2 : build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3 : runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Seul conteneur publié sur le host (8080:3000 dans docker-compose.yml) — /api/*
# et /about.json sont proxyés en interne vers le service backend (cf.
# src/app/api/[...path]/route.ts et src/app/about.json/route.ts).
EXPOSE 3000

CMD ["npm", "start"]
