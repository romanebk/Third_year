import type { ServiceInfo } from "@/types";

// Wikipédia via les API publiques Wikimedia, sans clé :
// - "Ce jour-là" : feed onthisday (événements du jour)
// - plus lus : feed featured -> mostread (articles les plus vus hier)
// "auth: none" comme weather/rss/crypto/devises.
export const wikipediaService: ServiceInfo = {
  name: "wikipedia",
  description: "Wikipédia : « Ce jour-là » et articles les plus lus (sans clé).",
  auth: "none",
  widgets: [
    {
      name: "wiki_onthisday",
      description: "« Ce jour-là » : événements historiques du jour.",
      params: [
        { name: "lang", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
    {
      name: "wiki_top_read",
      description: "Articles les plus lus par langue.",
      params: [
        { name: "lang", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
  ],
};
