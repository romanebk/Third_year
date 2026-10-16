import type { ServiceInfo } from "@/types";

export const steamService: ServiceInfo = {
  name: "steam",
  description: "Steam : jeux les plus joués, actualités d'un jeu.",
  auth: "apikey",
  widgets: [
    {
      name: "steam_most_played",
      description: "Jeux les plus joués pour un utilisateur sur une période.",
      params: [
        { name: "steam_id", type: "string" },
        { name: "period_days", type: "integer" },
      ],
    },
    {
      name: "steam_game_news",
      description: "Flux d'actualités pour un jeu Steam.",
      params: [
        { name: "app_id", type: "integer" },
        { name: "max_items", type: "integer" },
      ],
    },
  ],
};