import type { ServiceInfo } from "@/types";

// Universités via Hipolabs — API publique, sans clé, sans quota connu.
// http://universities.hipolabs.com/search?country=France
export const universitiesService: ServiceInfo = {
  name: "universities",
  description: "Universités : recherche mondiale par pays/nom (Hipolabs).",
  auth: "none",
  widgets: [
    {
      name: "unis_by_country",
      description: "Liste des universités d'un pays.",
      params: [
        { name: "country", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
    {
      name: "unis_search",
      description: "Recherche universités par nom (optionnel : filtrer par pays).",
      params: [
        { name: "name", type: "string" },
        { name: "country", type: "string" },
        { name: "max_items", type: "integer" },
      ],
    },
  ],
};
