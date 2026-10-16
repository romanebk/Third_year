// Intervalle de rafraîchissement minimum par service. Un seul plancher global
// (5s) laissait chaque widget interroger son API tierce jusqu'à 720 fois par
// heure, alors que ces API gratuites ont des quotas serrés et souvent PARTAGÉS
// entre tous les utilisateurs du serveur (même IP sortante) :
// - GitHub sans compte lié : 60 requêtes/h par IP ; un widget profil en fait
//   2 à 3 par rafraîchissement.
// - Nominatim (maps) : 1 requête/s max selon sa politique d'usage.
// - CoinGecko (crypto) : quelques dizaines de requêtes/min sans clé.
// - Open-Meteo (weather) ne met à jour ses données que toutes les 15 min.
// - YouTube Data API : 10 000 unités/jour pour tout le serveur, 1 à 3 unités
//   par rafraîchissement selon le widget.
// - NASA APOD (DEMO_KEY) : 30 requêtes/jour seulement, quota partagé — un
//   rafraîchissement trop fréquent l'épuise en quelques minutes.
// - Nager.Date (jours fériés), Hipolabs (universités) : données quasi statiques,
//   aucun intérêt à interroger souvent.
// - ipapi.co : 1000 requêtes/jour gratuit.
// - Google Calendar : quota élevé, mais rien ne justifie moins de 5 min.
const DEFAULT_MIN_REFRESH_RATE_SECONDS = 5;

const MIN_REFRESH_RATE_SECONDS_BY_SERVICE: Partial<Record<string, number>> = {
  github: 60,
  steam: 120,
  weather: 60,
  rss: 120,
  crypto: 60,
  maps: 120,
  youtube: 300,
  devises: 60,
  wikipedia: 120,
  "google-calendar": 300,
  nasa: 3600,
  holidays: 3600,
  ipgeo: 300,
  universities: 3600,
};

export function minRefreshRateSeconds(service: string): number {
  return MIN_REFRESH_RATE_SECONDS_BY_SERVICE[service] ?? DEFAULT_MIN_REFRESH_RATE_SECONDS;
}

// Intervalle réellement appliqué par le timer : une instance créée avant ce
// plancher (en base avec 5s, par ex.) est relevée au minimum de son service,
// sans migration de données.
export function effectiveRefreshRateSeconds(service: string, requested: number): number {
  return Math.max(requested, minRefreshRateSeconds(service));
}
