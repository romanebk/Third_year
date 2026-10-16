import type { ServiceInfo } from "@/types";

// Devises via Frankfurter (Banque centrale européenne, sans clé) :
// https://frankfurter.dev — taux de référence quotidiens, ~30 devises.
// "auth: none" comme weather/rss/crypto : utilisable sans démarche.
export const devisesService: ServiceInfo = {
  name: "devises",
  description: "Devises : taux de change et historique (données BCE, sans clé).",
  auth: "none",
  widgets: [
    {
      name: "devise_rate",
      description: "Taux de change actuel d'une paire de devises.",
      params: [
        { name: "base", type: "string" },
        { name: "target", type: "string" },
      ],
    },
    {
      name: "devise_history",
      description: "Historique du taux sur N jours.",
      params: [
        { name: "base", type: "string" },
        { name: "target", type: "string" },
        { name: "days", type: "integer" },
      ],
    },
  ],
};
