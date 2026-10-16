import type { ServiceInfo } from "@/types";

// NASA APOD (Astronomy Picture of the Day) — API publique, sans clé.
// https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY (DEMO_KEY = 30 req/jour, suffit)
// Si besoin d'un quota plus élevé : générer sa propre clé gratuite sur api.nasa.gov
export const nasaService: ServiceInfo = {
  name: "nasa",
  description: "NASA : image astronomique du jour (APOD) et archives.",
  auth: "none",
  widgets: [
    {
      name: "nasa_apod",
      description: "Image du jour NASA avec explication.",
      params: [
        { name: "date", type: "string" },
        { name: "hd", type: "integer" },
      ],
    },
    {
      name: "nasa_apod_random",
      description: "Image NASA aléatoire (date au hasard dans les archives).",
      params: [],
    },
  ],
};
