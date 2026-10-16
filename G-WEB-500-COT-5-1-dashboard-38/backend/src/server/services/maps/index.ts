import type { ServiceInfo } from "@/types";

// OpenStreetMap (Nominatim + OSRM), aucune clé requise — même choix que crypto :
// pas de compte Google Cloud/facturation à activer pour un widget carte.
// 6e service du projet, au-delà du minimum imposé (5).
export const mapsService: ServiceInfo = {
  name: "maps",
  description: "Maps : carte centrée sur une adresse, distance routière entre deux adresses.",
  auth: "none",
  widgets: [
    {
      name: "map_location",
      description: "Petite carte centrée sur une adresse.",
      params: [
        { name: "address", type: "string" },
        { name: "zoom", type: "integer" },
      ],
    },
    {
      name: "map_distance",
      description: "Distance et durée du trajet routier entre deux adresses.",
      params: [
        { name: "origin", type: "string" },
        { name: "destination", type: "string" },
      ],
    },
  ],
};
