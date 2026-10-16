import type { ServiceInfo } from "@/types";

// Google Calendar via l'API Google Calendar, OAuth requis (scope calendar.readonly).
// Le provider Google OAuth est déjà enregistré dans auth.ts — il faut ajouter le scope
// "https://www.googleapis.com/auth/calendar.readonly" pour que le token d'accès
// permette de lire l'agenda. Le token est stocké chiffré (AES-GCM) dans Account
// et récupéré via accessTokens.google dans le contexte de fetch.
export const googleCalendarService: ServiceInfo = {
  name: "google-calendar",
  description: "Google Agenda : prochains rendez-vous et agenda du jour.",
  auth: "oauth",
  widgets: [
    {
      name: "gcal_upcoming",
      description: "Prochains rendez-vous (jusqu'à N événements à venir).",
      params: [
        { name: "max_items", type: "integer" },
        { name: "days_ahead", type: "integer" },
      ],
    },
    {
      name: "gcal_today",
      description: "Agenda du jour (événements d'aujourd'hui).",
      params: [
        { name: "max_items", type: "integer" },
      ],
    },
  ],
};
