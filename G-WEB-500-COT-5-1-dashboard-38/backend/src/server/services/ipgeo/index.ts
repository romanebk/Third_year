import type { ServiceInfo } from "@/types";

// Géolocalisation IP via ipapi.co — API publique, sans clé (1000 req/jour gratuit).
// https://ipapi.co/json/ ou https://ipapi.co/{ip}/json/
export const ipgeoService: ServiceInfo = {
  name: "ipgeo",
  description: "Géolocalisation IP : ville, pays, fuseau, ISP du visiteur (ipapi.co).",
  auth: "none",
  widgets: [
    {
      name: "ipgeo_current",
      description: "Votre localisation actuelle (basée sur votre IP).",
      params: [],
    },
    {
      name: "ipgeo_lookup",
      description: "Localiser une IP spécifique.",
      params: [
        { name: "ip", type: "string" },
      ],
    },
  ],
};
