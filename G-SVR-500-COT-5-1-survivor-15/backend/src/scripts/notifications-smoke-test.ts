/**
 * Test fonctionnel des notifications, sur l'API réelle, pas une simulation.
 * Documenté dans le forum #test.
 *
 * Lancer (backend déjà démarré, ex. npm run dev depuis backend/) :
 *   npx tsx src/scripts/notifications-smoke-test.ts
 *
 * Variable d'environnement optionnelle :
 *   BASE_URL   origine du backend (défaut http://localhost:3010/api)
 */
export {}; // force la portée module (sinon collision de noms entre scripts sans import/export)
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3010/api';

let passed = 0;
let failed = 0;
let known = 0;

function check(label: string, ok: boolean, detail = ''): void {
  console.log((ok ? 'OK  ' : 'FAIL') + ' | ' + label + (detail ? ' :: ' + detail : ''));
  if (ok) passed++;
  else failed++;
}

function knownGap(label: string, detail: string): void {
  console.log('GAP  | ' + label + ' :: ' + detail);
  known++;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: string;
}

async function main(): Promise<void> {
  const ts = Date.now();
  const empReg = (await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `notif-smoke-emp-${ts}@test.fr`, password: 'Passw0rd1', role: 'EMPLOYER', companyName: 'Notif Smoke SARL' }),
  }).then((r) => r.json())) as { accessToken: string };

  const offer = (await fetch(`${BASE_URL}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empReg.accessToken}` },
    body: JSON.stringify({ title: 'Offre smoke test notifications', description: 'Description assez longue pour la validation Zod.', address: 'Lyon', radiusKm: 10 }),
  }).then((r) => r.json())) as { offer: { id: string } };

  const candReg = (await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `notif-smoke-cand-${ts}@test.fr`, password: 'Passw0rd1', role: 'JOBSEEKER', firstName: 'Notif', lastName: 'Smoke' }),
  }).then((r) => r.json())) as { accessToken: string };

  // 1. Candidature -> notification employeur.
  const application = (await fetch(`${BASE_URL}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${candReg.accessToken}` },
    body: JSON.stringify({ offerId: offer.offer.id, message: 'Motivé' }),
  }).then((r) => r.json())) as { application: { id: string } };

  const empNotifs = (await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${empReg.accessToken}` },
  }).then((r) => r.json())) as Notification[];
  const receivedNotif = empNotifs.find((n) => n.type === 'application_received');
  check('Employeur notifié à la réception d\'une candidature', Boolean(receivedNotif), receivedNotif?.message);

  // 2. Changement de statut -> notification candidat.
  await fetch(`${BASE_URL}/pro/applications/${application.application.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empReg.accessToken}` },
    body: JSON.stringify({ status: 'interview' }),
  });
  const candNotifs = (await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${candReg.accessToken}` },
  }).then((r) => r.json())) as Notification[];
  const statusNotif = candNotifs.find((n) => n.type === 'application_status');
  check('Candidat notifié au changement de statut', Boolean(statusNotif), statusNotif?.message);
  check('Message en français, pas l\'enum brut', statusNotif?.message.includes('entretien proposé') ?? false, statusNotif?.message);

  // 3. Marquer lue / tout marquer lu.
  if (statusNotif) {
    const patchRes = await fetch(`${BASE_URL}/notifications/${statusNotif.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${candReg.accessToken}` },
    });
    check('PATCH /notifications/:id (marquer lue)', patchRes.status === 204);
  }
  const readAllRes = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${empReg.accessToken}` },
  });
  check('PATCH /notifications/read-all', readAllRes.status === 204);
  const empNotifsAfter = (await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${empReg.accessToken}` },
  }).then((r) => r.json())) as Notification[];
  check('Toutes les notifications employeur sont lues', empNotifsAfter.every((n) => n.read));

  // 4. Type "alert" (nouvelle offre à proximité) : recherche d'un cas où il serait créé.
  // Connu absent : aucun createNotification() du code ne passe type: 'alert'. Le toast
  // "Nouvelle offre à proximité" existe (WebSocket, useRealtime.ts) mais n'est jamais
  // persisté en notification, donc invisible si le candidat n'est pas connecté au moment
  // de la création de l'offre.
  const anyAlert = candNotifs.some((n) => n.type === 'alert') || empNotifs.some((n) => n.type === 'alert');
  if (!anyAlert) {
    knownGap(
      'Notification de type "alert" (nouvelle offre à proximité)',
      'Jamais créée par le backend, aucun createNotification({ type: "alert" }) dans le code. La case "Alertes nouvelles offres" du profil candidat ne fait rien côté serveur.',
    );
  } else {
    check('Notification de type "alert" trouvée (inattendu, à ré-auditer)', true);
  }

  console.log(`\n--- Résumé : ${passed}/${passed + failed} OK, ${known} lacune(s) connue(s) ---`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Le test notifications a échoué :', err);
  process.exitCode = 1;
});
