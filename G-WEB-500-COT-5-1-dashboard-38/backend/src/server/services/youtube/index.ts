import type { ServiceInfo } from "@/types";

// Service YouTube : données publiques uniquement (statistiques de chaîne,
// dernières vidéos, tendances), via une clé API serveur (YOUTUBE_API_KEY) —
// aucun compte YouTube à lier. "apikey" comme Steam : l'utilisateur souscrit
// au service depuis /services, la clé reste côté serveur.
export const youtubeService: ServiceInfo = {
  name: "youtube",
  description: "YouTube : statistiques d'une chaîne, ses dernières vidéos, tendances par pays.",
  auth: "apikey",
  widgets: [
    {
      name: "youtube_channel_stats",
      description: "Abonnés, vues totales et nombre de vidéos d'une chaîne.",
      params: [{ name: "channel", type: "string" }],
    },
    {
      name: "youtube_latest_videos",
      description: "Dernières vidéos publiées par une chaîne.",
      params: [
        { name: "channel", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
    {
      name: "youtube_trending",
      description: "Vidéos tendance dans un pays.",
      params: [
        { name: "region", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
  ],
};
