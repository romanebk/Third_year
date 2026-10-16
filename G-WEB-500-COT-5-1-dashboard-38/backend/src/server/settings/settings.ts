import { prisma } from "@/lib/db";
import {
  DashboardValidationError,
  getWidgetDefinition,
  validateInstanceParams,
} from "@/server/dashboard/validate-params";
import { registerInstanceTimer } from "@/server/timer/register-instance";
import { isValidInterestKey } from "@/server/services/rss/interests";

// Config utilisateur centralisée, côté serveur (remplace les anciens key
// localStorage hubly.weather.city / hubly.github.repository / … du front).
// Les widgets "par défaut" d'un nouveau compte (weather_city_current,
// weather_city_forecast, rss_interest_feed) lisent leurs params depuis cette
// config — un changement ici met à jour les instances par défaut et re-enregistre
// leur timer (cf. registerInstanceTimer, qui remplace proprement l'ancien).

export interface UserSettingsData {
  weatherCity: string;
  weatherUnit: "celsius" | "fahrenheit";
  githubRepository: string;
  rssFeedUrl: string;
  rssInterests: string[];
}

export const DEFAULT_SETTINGS: UserSettingsData = {
  weatherCity: "Paris",
  weatherUnit: "celsius",
  githubRepository: "vercel/next.js",
  rssFeedUrl: "https://hnrss.org/frontpage",
  rssInterests: ["technology", "world", "science"],
};

// Renvoie les réglages de l'utilisateur, en créant la ligne avec les valeurs par
// défaut au premier appel — le front lit GET /api/settings sans devoir passer
// des valeurs, le dashboard se base sur la ligne créée pour semer ses defaults.
export async function getOrCreateSettings(userId: string): Promise<UserSettingsData> {
  const existing = await prisma.userSettings.findFirst({ where: { userId } });
  if (existing) {
    return {
      weatherCity: existing.weatherCity,
      weatherUnit: existing.weatherUnit === "fahrenheit" ? "fahrenheit" : "celsius",
      githubRepository: existing.githubRepository,
      rssFeedUrl: existing.rssFeedUrl,
      rssInterests: existing.rssInterests.split(",").map((key) => key.trim()).filter(Boolean),
    };
  }
  await prisma.userSettings.create({ data: { userId, defaultsSeeded: false } });
  return { ...DEFAULT_SETTINGS };
}

// Valide un PATCH partiel de settings. Retourne un Record<id, UserSettingsData>
// (et non l'objet typé complet) pour rester souple : si on donne juste { city },
// on retourne { city } — mis à jour par spread sur la ligne existante.
export function validateSettingsPatch(input: unknown): Partial<UserSettingsData> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new DashboardValidationError("settings must be an object");
  }
  const raw = input as Record<string, unknown>;
  const result: Partial<UserSettingsData> = {};

  if (raw.weatherCity !== undefined) {
    if (typeof raw.weatherCity !== "string" || !raw.weatherCity.trim()) {
      throw new DashboardValidationError("weatherCity must be a non-empty string");
    }
    result.weatherCity = raw.weatherCity.trim();
  }
  if (raw.weatherUnit !== undefined) {
    if (raw.weatherUnit !== "celsius" && raw.weatherUnit !== "fahrenheit") {
      throw new DashboardValidationError("weatherUnit must be celsius or fahrenheit");
    }
    result.weatherUnit = raw.weatherUnit;
  }
  if (raw.githubRepository !== undefined) {
    if (typeof raw.githubRepository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(raw.githubRepository)) {
      throw new DashboardValidationError("githubRepository must be in the form 'owner/repo'");
    }
    result.githubRepository = raw.githubRepository;
  }
  if (raw.rssFeedUrl !== undefined) {
    if (typeof raw.rssFeedUrl !== "string" || !/^https?:\/\/\S+$/.test(raw.rssFeedUrl.trim())) {
      throw new DashboardValidationError("rssFeedUrl must be an http(s) URL");
    }
    result.rssFeedUrl = raw.rssFeedUrl.trim();
  }
  if (raw.rssInterests !== undefined) {
    if (!Array.isArray(raw.rssInterests)) {
      throw new DashboardValidationError("rssInterests must be an array of interest keys");
    }
    const unknown = raw.rssInterests.filter((key) => typeof key !== "string" || !isValidInterestKey(key));
    if (unknown.length > 0) {
      throw new DashboardValidationError(`unknown interest keys: ${unknown.join(", ")}`);
    }
    // L'ordre saisit est conservé, les doublons retirés — un utilisateur qui
    // tape deux fois la même puce ne doit pas agréger le flux deux fois.
    result.rssInterests = Array.from(new Set(raw.rssInterests as string[]));
  }

  return result;
}

async function upsertSettings(userId: string, input: unknown): Promise<UserSettingsData> {
  const patch = validateSettingsPatch(input);
  // rssInterests est stocké en base sous forme de string CSV (colonne TEXT) :
  // on resérialise le tableau validé avant l'écriture.
  const dbPatch: Record<string, unknown> = { ...patch };
  if (dbPatch.rssInterests !== undefined) {
    dbPatch.rssInterests = (dbPatch.rssInterests as string[]).join(",");
  }
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...dbPatch },
    update: dbPatch,
  });
  return getOrCreateSettings(userId);
}

// Instances par défaut d'un nouveau compte : uniquement des services "auth: none"
// (weather, rss) pour que les données soient réelles sans aucune démarche de
// souscription. GitHub/Steam exigent une souscription côté /services — pas de
// panneau par défaut factice pour eux.
const DEFAULT_WIDGETS: Array<{
  service: string;
  widget: string;
  refreshRateSeconds: number;
  params: (settings: UserSettingsData) => Record<string, string | number>;
}> = [
  {
    service: "weather",
    widget: "weather_city_current",
    refreshRateSeconds: 300,
    params: (settings) => ({ city: settings.weatherCity, unit: settings.weatherUnit }),
  },
  {
    service: "weather",
    widget: "weather_city_forecast",
    refreshRateSeconds: 300,
    params: (settings) => ({ city: settings.weatherCity, days: 7, unit: settings.weatherUnit }),
  },
  {
    service: "rss",
    widget: "rss_interest_feed",
    refreshRateSeconds: 600,
    params: (settings) => ({ interests: settings.rssInterests.join(","), max_items: 8 }),
  },
];

// Semble les instances par défaut du compte (une seule fois) : marquées isDefault
// pour que PATCH /api/settings puisse ensuite mettre à jour leurs params + timer.
// Retourne true si le seeding a réellement eu lieu sur cet appel — c'est le signal
// "premier chargement d'un compte neuf" qui déclenche l'auto-détection de la
// localisation côté front (le weather démoise pointe sur Paris par défaut).
export async function seedDefaultInstances(userId: string): Promise<boolean> {
  const settings = await getOrCreateSettings(userId);

  // Claim atomique plutôt qu'un simple find-puis-check : deux appels
  // concurrents (ex. deux onglets ouvrant /dashboard en même temps sur un
  // compte tout juste créé) peuvent tous les deux passer un
  // findUnique().defaultsSeeded === false avant qu'aucun n'ait écrit le flag,
  // et créer chacun leur propre jeu d'instances par défaut en double. Un
  // UPDATE conditionné sur defaultsSeeded: false est atomique au niveau de la
  // ligne : un seul appel concurrent peut réellement le faire passer à true
  // (count === 1) ; tout autre voit count === 0 et sait qu'un autre appel a
  // déjà gagné la course, donc ne crée rien.
  const claimed = await prisma.userSettings.updateMany({
    where: { userId, defaultsSeeded: false },
    data: { defaultsSeeded: true },
  });
  if (claimed.count === 0) return false;

  let position = 0;
  for (const template of DEFAULT_WIDGETS) {
    const definition = getWidgetDefinition(template.service, template.widget);
    const params = validateInstanceParams(definition, template.params(settings));
    const instance = await prisma.widgetInstance.create({
      data: {
        userId,
        service: template.service,
        widget: template.widget,
        params,
        refreshRateSeconds: template.refreshRateSeconds,
        position,
        isDefault: true,
      },
    });
    registerInstanceTimer({
      id: instance.id,
      userId: instance.userId,
      service: instance.service,
      widget: instance.widget,
      params: instance.params as Record<string, string | number>,
      refreshRateSeconds: instance.refreshRateSeconds,
    });
    position += 1;
  }
  return true;
}

// Mise à jour d'un PATCH /api/settings : applique la nouvelle config aux instances
// par défaut existantes (weather_city_current/forecast, rss_article_list) et
// re-enregistre leur timer pour que le prochain rafraîchissement utilise les
// nouveaux params — c'est le cœur de la "config centralisée dans /settings".
export async function applySettingsToDefaultInstances(
  userId: string,
  settings: UserSettingsData,
): Promise<void> {
  const defaults = await prisma.widgetInstance.findMany({
    where: { userId, isDefault: true },
  });

  for (const instance of defaults) {
    const nextParams = defaultParamsForWidget(instance.service, instance.widget, settings);
    if (!nextParams) continue;

    if (JSON.stringify(nextParams) === JSON.stringify(instance.params)) continue;

    const updated = await prisma.widgetInstance.update({
      where: { id: instance.id },
      data: { params: nextParams },
    });
    registerInstanceTimer({
      id: updated.id,
      userId: updated.userId,
      service: updated.service,
      widget: updated.widget,
      params: updated.params as Record<string, string | number>,
      refreshRateSeconds: updated.refreshRateSeconds,
    });
  }
}

function defaultParamsForWidget(
  service: string,
  widget: string,
  settings: UserSettingsData,
): Record<string, string | number> | null {
  if (service === "weather" && widget === "weather_city_current") {
    return { city: settings.weatherCity, unit: settings.weatherUnit };
  }
  if (service === "weather" && widget === "weather_city_forecast") {
    return { city: settings.weatherCity, days: 7, unit: settings.weatherUnit };
  }
  if (service === "rss" && widget === "rss_article_list") {
    return { feed_url: settings.rssFeedUrl, max_items: 5 };
  }
  if (service === "rss" && widget === "rss_interest_feed") {
    return { interests: settings.rssInterests.join(","), max_items: 8 };
  }
  return null;
}

export { upsertSettings };