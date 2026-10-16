import type { ServiceInfo } from "@/types";

export const githubService: ServiceInfo = {
  name: "github",
  description: "GitHub : commits récents, profils, alertes de sécurité.",
  auth: "oauth",
  widgets: [
    {
      name: "github_recent_commits",
      description: "Derniers commits et leurs auteurs pour un dépôt.",
      params: [
        { name: "repository", type: "string" },
        { name: "max_commits", type: "integer" },
      ],
    },
    {
      name: "github_user_profile",
      description: "Affiche le profil public d'un utilisateur GitHub.",
      params: [{ name: "username", type: "string" }],
    },
    {
      name: "github_security_alerts",
      description: "Alertes de sécurité ouvertes pour un dépôt.",
      params: [{ name: "repository", type: "string" }],
    },
  ],
};