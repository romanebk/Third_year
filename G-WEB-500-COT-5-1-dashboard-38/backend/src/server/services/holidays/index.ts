import type { ServiceInfo } from "@/types";

// Jours fériés via Nager.Date — API publique, sans clé, sans quota connu.
// https://date.nager.at/api/v3/PublicHolidays/2026/FR
export const holidaysService: ServiceInfo = {
  name: "holidays",
  description: "Jours fériés : calendrier officiel par pays et région (Nager.Date).",
  auth: "none",
  widgets: [
    {
      name: "holidays_upcoming",
      description: "Prochains jours fériés pour un pays (et région optionnelle).",
      params: [
        { name: "country", type: "string" },
        { name: "region", type: "string", optional: true },
        { name: "max_items", type: "integer" },
      ],
    },
    {
      name: "holidays_year",
      description: "Tous les jours fériés d'une année pour un pays.",
      params: [
        { name: "country", type: "string" },
        { name: "year", type: "integer" },
      ],
    },
  ],
};
