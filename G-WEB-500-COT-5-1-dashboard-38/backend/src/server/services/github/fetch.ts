import { WidgetRateLimitError, WidgetValidationError } from "@/server/widgets/errors";

const GITHUB_API = "https://api.github.com";

// "owner/repo" -> chemin encodé segment par segment (jamais la chaîne entière,
// qui encoderait aussi le "/" séparateur). Un `repository` contenant "?"/"&"/"#"
// corromprait sinon la query string construite plus bas.
function encodeRepositoryPath(repository: string): string {
  return repository.split("/").map(encodeURIComponent).join("/");
}

// Appel générique à l'API GitHub : ajoute le token si présent (widgets qui n'en
// ont pas forcément besoin, ex: commits/profil publics), détecte le rate-limit
// explicitement plutôt que de laisser un 403 générique remonter tel quel — le
// sujet et le planning demandent cette gestion précise, pas juste "ça marche".
//
// allowAnonymousFallback : si le token fourni est rejeté (401 — expiré, révoqué),
// on retente une fois sans lui plutôt que d'échouer, pour les widgets dont
// l'auth est seulement optionnelle (commits/profil publics). Un token cassé ne
// doit jamais rendre indisponible ce qui marcherait très bien anonymement — sans
// ça, un compte GitHub lié dont le token a expiré casse silencieusement ces
// widgets avec un message "configuration invalide" qui n'a rien à voir avec la
// vraie cause. Pas appliqué à github_security_alerts, qui exige vraiment un
// token (pas de repli anonyme possible pour des alertes privées).
async function githubGet(
  path: string,
  accessToken?: string,
  allowAnonymousFallback = false,
): Promise<Response> {
  const request = async (token?: string): Promise<Response> => {
    try {
      return await fetch(`${GITHUB_API}${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Sans timeout, un fetch qui ne reçoit jamais de réponse (réseau
        // capricieux) bloque indéfiniment la requête entrante avec lui.
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new WidgetValidationError("could not reach GitHub");
    }
  };

  let response = await request(accessToken);

  if (response.status === 401 && accessToken && allowAnonymousFallback) {
    response = await request(undefined);
  }

  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    const resetHeader = response.headers.get("x-ratelimit-reset");
    const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toISOString() : "unknown";
    throw new WidgetRateLimitError(`GitHub API rate limit exceeded, resets at ${resetAt}`);
  }

  return response;
}

export interface RecentCommitsParams {
  repository: string;
  maxCommits?: number;
  accessToken?: string;
}

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export async function fetchRecentCommits({
  repository,
  maxCommits,
  accessToken,
}: RecentCommitsParams): Promise<CommitSummary[]> {
  if (!repository?.includes("/")) {
    throw new WidgetValidationError("repository must be in the form 'owner/repo'");
  }
  // Borné (1-30) : GitHub plafonne per_page à 100, mais un widget de "derniers
  // commits" n'a pas de sens au-delà d'une poignée d'entrées affichables.
  const perPage = Math.min(Math.max(Math.trunc(maxCommits ?? 5), 1), 30);

  const response = await githubGet(
    `/repos/${encodeRepositoryPath(repository)}/commits?per_page=${perPage}`,
    accessToken,
    true,
  );

  if (response.status === 404) {
    throw new WidgetValidationError(`repository not found: ${repository}`);
  }
  if (!response.ok) {
    throw new WidgetValidationError(`GitHub API responded with status ${response.status}`);
  }

  const commits = (await response.json()) as {
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
  }[];

  return commits.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
  }));
}

export interface UserProfileParams {
  username: string;
  accessToken?: string;
}

// Heatmap d'activité : la grille de contributions du profil (les petits carrés
// verts de GitHub). Deux sources, par ordre de préférence :
// - avec un compte GitHub lié : l'API GraphQL (contributionCalendar), la même
//   donnée que le profil GitHub vu par son propriétaire — contributions aux
//   dépôts privés comprises quand on consulte son propre profil ;
// - sinon (ou en cas d'échec) : le HTML public de la grille, qui ne compte que
//   les contributions visibles anonymement (écart constaté : 154 vs 167 sur un
//   compte avec des dépôts d'école privés).
export interface ContributionDay {
  date: string;
  level: number; // 0-4, le niveau d'intensité de la case (data-level)
  count: number;
}

export interface ContributionSummary {
  total: number;
  days: ContributionDay[];
}

export interface UserProfileResult {
  username: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  // Dépôts privés possédés — renseigné seulement quand le compte lié EST le
  // profil affiché (GET /user), null sinon : GitHub ne l'expose jamais pour
  // le profil de quelqu'un d'autre.
  privateRepos: number | null;
  followers: number;
  // null si la heatmap n'a pas pu être récupérée (réseau, HTML changé) : le
  // profil reste affichable sans elle, ce n'est pas une erreur fatale.
  contributions: ContributionSummary | null;
}

const CONTRIBUTION_CELL_RE =
  /data-date="([\d-]+)" id="contribution-day-component-([\d-]+)" data-level="([0-9])"/g;
// "contributions?" : un jour à une seule contribution s'écrit au singulier
// ("1 contribution on March 3rd") — sans le "s" optionnel, ces jours
// retombaient à 0 dans l'infobulle alors que leur case était colorée.
const CONTRIBUTION_TIP_RE =
  /for="contribution-day-component-([\d-]+)"[^>]*>([\d,]+|No) contributions?\b/g;

const CONTRIBUTION_LEVELS: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const CONTRIBUTIONS_QUERY = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

async function fetchContributionsGraphql(
  username: string,
  accessToken: string,
): Promise<ContributionSummary> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}/graphql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { login: username } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new WidgetValidationError("could not reach GitHub");
  }
  if (!response.ok) {
    throw new WidgetValidationError(`GitHub GraphQL API responded with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      user?: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number; contributionLevel: string }[] }[];
          };
        };
      } | null;
    };
  };
  const calendar = payload.data?.user?.contributionsCollection.contributionCalendar;
  if (!calendar) throw new WidgetValidationError("unexpected response from GitHub GraphQL API");

  return {
    total: calendar.totalContributions,
    days: calendar.weeks.flatMap((week) =>
      week.contributionDays.map((day) => ({
        date: day.date,
        level: CONTRIBUTION_LEVELS[day.contributionLevel] ?? 0,
        count: day.contributionCount,
      })),
    ),
  };
}

// GraphQL d'abord si un token est disponible, HTML public sinon — ou si
// GraphQL échoue (token révoqué, panne) : mieux vaut la heatmap publique que
// pas de heatmap du tout.
async function fetchUserContributions(username: string, accessToken?: string): Promise<ContributionSummary> {
  if (accessToken) {
    try {
      return await fetchContributionsGraphql(username, accessToken);
    } catch (error) {
      console.error(`[github] GraphQL contributions failed for ${username}, falling back to HTML:`, error);
    }
  }
  return fetchPublicContributions(username);
}

async function fetchPublicContributions(username: string): Promise<ContributionSummary> {
  let response: Response;
  try {
    response = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new WidgetValidationError("could not reach GitHub");
  }
  if (!response.ok) {
    throw new WidgetValidationError(`GitHub responded with status ${response.status}`);
  }

  const html = await response.text();

  // Comptes exacts par jour : chaque tooltip est lié à sa case par la même id
  // "contribution-day-component-ligne-semaine" que le td. "No contributions"
  // vaut 0 ; les cases sans tooltip (rare) retombent aussi sur 0/level 0.
  const counts = new Map<string, number>();
  for (const tip of html.matchAll(CONTRIBUTION_TIP_RE)) {
    counts.set(tip[1], tip[2] === "No" ? 0 : Number(tip[2].replace(/,/g, "")));
  }

  const days: ContributionDay[] = [];
  for (const cell of html.matchAll(CONTRIBUTION_CELL_RE)) {
    days.push({ date: cell[1], level: Number(cell[3]), count: counts.get(cell[2]) ?? 0 });
  }

  const totalMatch = html.match(/id="js-contribution-activity-description"[^>]*>\s*([\d,]+)\s*contributions/);

  return {
    total: totalMatch
      ? Number(totalMatch[1].replace(/,/g, ""))
      : days.reduce((sum, day) => sum + day.count, 0),
    days,
  };
}

export async function fetchUserProfile({
  username,
  accessToken,
}: UserProfileParams): Promise<UserProfileResult> {
  if (!username?.trim()) throw new WidgetValidationError("username is required");

  const [response, contributions, privateRepos] = await Promise.all([
    githubGet(`/users/${encodeURIComponent(username)}`, accessToken, true),
    // Best-effort : une heatmap en échec ne doit jamais faire planter le profil.
    // Elle tombe alors à null et le widget affiche juste le profil.
    fetchUserContributions(username, accessToken).catch(() => null),
    fetchOwnPrivateRepoCount(username, accessToken),
  ]);

  if (response.status === 404) {
    throw new WidgetValidationError(`user not found: ${username}`);
  }
  if (!response.ok) {
    throw new WidgetValidationError(`GitHub API responded with status ${response.status}`);
  }

  const profile = (await response.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
    public_repos: number;
    followers: number;
  };

  return {
    username: profile.login,
    name: profile.name,
    avatarUrl: profile.avatar_url,
    publicRepos: profile.public_repos,
    privateRepos,
    followers: profile.followers,
    contributions,
  };
}

// GET /user décrit le compte du token (pas n'importe quel profil) : n'a de
// sens que si ce compte est celui affiché. Best-effort, null en cas d'échec.
async function fetchOwnPrivateRepoCount(username: string, accessToken?: string): Promise<number | null> {
  if (!accessToken) return null;
  try {
    const response = await githubGet("/user", accessToken);
    if (!response.ok) return null;
    const viewer = (await response.json()) as { login: string; owned_private_repos?: number };
    if (viewer.login.toLowerCase() !== username.trim().toLowerCase()) return null;
    return viewer.owned_private_repos ?? null;
  } catch {
    return null;
  }
}

export interface SecurityAlertsParams {
  repository: string;
  accessToken?: string;
}

export interface SecurityAlert {
  summary: string;
  severity: string;
  state: string;
}

export async function fetchSecurityAlerts({
  repository,
  accessToken,
}: SecurityAlertsParams): Promise<SecurityAlert[]> {
  if (!repository?.includes("/")) {
    throw new WidgetValidationError("repository must be in the form 'owner/repo'");
  }
  // Contrairement aux commits/profil, cet endpoint exige toujours un token avec les
  // bons droits (Dependabot alerts) — pas d'usage anonyme possible sur GitHub.
  if (!accessToken) {
    throw new WidgetValidationError("this widget requires a linked GitHub account");
  }

  const response = await githubGet(
    `/repos/${encodeRepositoryPath(repository)}/dependabot/alerts?state=open`,
    accessToken,
  );

  if (response.status === 404) {
    throw new WidgetValidationError(`repository not found or Dependabot alerts not enabled: ${repository}`);
  }
  if (response.status === 403) {
    throw new WidgetValidationError(
      `insufficient permissions to read security alerts for ${repository}`,
    );
  }
  if (!response.ok) {
    throw new WidgetValidationError(`GitHub API responded with status ${response.status}`);
  }

  const alerts = (await response.json()) as {
    security_advisory: { summary: string; severity: string };
    state: string;
  }[];

  return alerts.map((a) => ({
    summary: a.security_advisory.summary,
    severity: a.security_advisory.severity,
    state: a.state,
  }));
}
