import type { ServiceInfo } from "@/types";

export const rssService: ServiceInfo = {
  name: "rss",
  description: "RSS : derniers articles d'un ou plusieurs flux.",
  auth: "none",
  widgets: [
    {
      name: "rss_article_list",
      description: "Affiche la liste des derniers articles d'un flux RSS.",
      params: [
        { name: "feed_url", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
    {
      name: "rss_interest_feed",
      description: "Actualités agrégées des centres d'intérêt choisis.",
      params: [
        { name: "interests", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
  ],
};