/**
 * Test fonctionnel du module admin (users, modération, reports, metrics),
 * sur l'API réelle, pas une simulation. Documenté dans le forum #test.
 *
 * Lancer (backend déjà démarré, ex. npm run dev depuis backend/) :
 *   npx tsx src/scripts/admin-smoke-test.ts
 *
 * Variables d'environnement optionnelles :
 *   BASE_URL        origine du backend (défaut http://localhost:3010/api)
 *   ADMIN_EMAIL      compte admin à utiliser (défaut admin@geoemploi.fr)
 *   ADMIN_PASSWORD   (défaut Admin2026!, seed réel)
 */
export {}; // force la portée module (sinon collision de noms entre scripts sans import/export)
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3010/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@geoemploi.fr';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin2026!';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = ''): void {
  console.log((ok ? 'OK  ' : 'FAIL') + ' | ' + label + (detail ? ' :: ' + detail : ''));
  if (ok) passed++;
  else failed++;
}

async function main(): Promise<void> {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const login = (await loginRes.json()) as { accessToken?: string };
  check('Login admin', loginRes.status === 200 && Boolean(login.accessToken));
  const token = login.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  // Accès refusé à un rôle non-admin.
  const ts = Date.now();
  const candReg = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin-smoke-${ts}@test.fr`, password: 'Passw0rd1', role: 'JOBSEEKER', firstName: 'A', lastName: 'B' }),
  }).then((r) => r.json() as Promise<{ accessToken: string }>);
  const deniedRes = await fetch(`${BASE_URL}/admin/users`, { headers: { Authorization: `Bearer ${candReg.accessToken}` } });
  check('Accès /admin/users refusé à un compte candidat', deniedRes.status === 403, `HTTP ${deniedRes.status}`);

  // Liste des utilisateurs.
  const usersRes = await fetch(`${BASE_URL}/admin/users`, { headers: auth });
  const users = (await usersRes.json()) as Array<{ id: string; email: string }>;
  check('GET /admin/users', usersRes.status === 200 && Array.isArray(users) && users.length > 0, `${users.length} comptes`);

  // Métriques.
  const metricsRes = await fetch(`${BASE_URL}/admin/metrics`, { headers: auth });
  const metrics = (await metricsRes.json()) as { activeOffers: number; weeklyActivity?: unknown[] };
  check('GET /admin/metrics', metricsRes.status === 200 && typeof metrics.activeOffers === 'number', `${metrics.activeOffers} offres actives`);
  check('metrics.weeklyActivity présent', Array.isArray(metrics.weeklyActivity) && metrics.weeklyActivity.length === 7);

  // Flux de modération complet : créer une offre, la signaler, vérifier qu'elle sort de la liste
  // publique, la voir dans /admin/reports et /admin/offers?status=reported, la rétablir, vérifier
  // que le signalement se referme et que l'offre redevient visible.
  const empReg = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin-smoke-emp-${ts}@test.fr`, password: 'Passw0rd1', role: 'EMPLOYER', companyName: 'Admin Smoke SARL' }),
  }).then((r) => r.json() as Promise<{ accessToken: string }>);
  const offerRes = await fetch(`${BASE_URL}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empReg.accessToken}` },
    body: JSON.stringify({ title: 'Offre smoke test admin', description: 'Description assez longue pour la validation Zod.', address: 'Lyon', radiusKm: 10 }),
  }).then((r) => r.json() as Promise<{ offer: { id: string } }>);
  const offerId = offerRes.offer.id;

  const reportRes = await fetch(`${BASE_URL}/offers/${offerId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${candReg.accessToken}` },
    body: JSON.stringify({ reason: 'Test smoke admin' }),
  });
  check('POST /offers/:id/report', reportRes.status === 201);

  const reportedRes = await fetch(`${BASE_URL}/admin/offers?status=reported`, { headers: auth });
  const reported = (await reportedRes.json()) as Array<{ id: string }>;
  check('Offre signalée visible dans /admin/offers?status=reported', reported.some((o) => o.id === offerId));

  const reportsRes = await fetch(`${BASE_URL}/admin/reports`, { headers: auth });
  const reports = (await reportsRes.json()) as Array<{ offerId: string }>;
  check('Signalement visible dans /admin/reports', reports.some((r) => r.offerId === offerId));

  const moderateRes = await fetch(`${BASE_URL}/offers/${offerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ status: 'published' }),
  });
  check('PATCH /offers/:id (admin, rétablir)', moderateRes.status === 200);

  const reportsAfterRes = await fetch(`${BASE_URL}/admin/reports`, { headers: auth });
  const reportsAfter = (await reportsAfterRes.json()) as Array<{ offerId: string }>;
  check('Signalement refermé après modération', !reportsAfter.some((r) => r.offerId === offerId));

  console.log(`\n--- Résumé : ${passed}/${passed + failed} OK ---`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Le test admin a échoué :', err);
  process.exitCode = 1;
});
