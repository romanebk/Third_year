import type { ServiceInfo } from "@/types";

export const weatherService: ServiceInfo = {
  name: "weather",
  description: "Weather : météo actuelle et prévisions (aucun compte requis).",
  auth: "none",
  widgets: [
    {
      name: "weather_city_current",
      description: "Température et conditions actuelles d'une ville.",
      params: [
        { name: "city", type: "string" },
        { name: "unit", type: "string" },
      ],
    },
    {
      name: "weather_city_forecast",
      description: "Prévisions sur plusieurs jours pour une ville.",
      params: [
        { name: "city", type: "string" },
        { name: "days", type: "integer" },
        { name: "unit", type: "string" },
      ],
    },
  ],
};