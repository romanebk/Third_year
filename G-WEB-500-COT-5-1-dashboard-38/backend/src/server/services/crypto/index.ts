import type { ServiceInfo } from "@/types";

// API publique CoinGecko, aucune clé requise (contrairement à Steam) — 5e
// service du projet, "auth: none" comme weather/rss : utilisable sans
// démarche préalable, cf. l'exigence du sujet d'au moins un service sans
// souscription.
export const cryptoService: ServiceInfo = {
  name: "crypto",
  description: "Crypto : cours en temps réel et classement des principales cryptomonnaies.",
  auth: "none",
  widgets: [
    {
      name: "crypto_price",
      description: "Cours actuel d'une cryptomonnaie et sa variation sur 24h.",
      params: [
        { name: "coin", type: "string" },
        { name: "currency", type: "string" },
      ],
    },
    {
      name: "crypto_top_coins",
      description: "Classement des principales cryptomonnaies par capitalisation.",
      params: [
        { name: "currency", type: "string" },
        { name: "limit", type: "integer" },
      ],
    },
  ],
};
