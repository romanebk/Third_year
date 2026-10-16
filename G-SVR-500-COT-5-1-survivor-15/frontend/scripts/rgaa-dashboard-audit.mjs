import puppeteer from 'puppeteer-core';

/**
 * Audit RGAA du dashboard employeur, par navigation clavier reelle (pas une
 * lecture de code). Documente dans docs/RGAA-AUDIT-3-ECRANS.md §3.
 *
 * Lancer (backend + frontend deja demarres en local) :
 *   node frontend/scripts/rgaa-dashboard-audit.mjs
 *
 * Variables d'environnement optionnelles :
 *   CHROME_PATH   chemin de l'executable Chrome/Chromium (defaut ci-dessous)
 *   BASE_URL      origine du frontend (defaut https://localhost:5173)
 *   BRIDGE_URL    origine du pont d'integration local (defaut http://localhost:4000)
 */
const CHROME_PATH =
  process.env.CHROME_PATH ??
  '/home/ctf/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome';
const BASE_URL = process.env.BASE_URL ?? 'https://localhost:5173';
const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:4000';

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const ts = Date.now();
const empEmail = `rgaa-emp-${ts}@test.fr`;
await fetch(`${BRIDGE_URL}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: empEmail, password: 'Passw0rd1', role: 'employer', companyName: 'RGAA Check SARL' }),
});

await page.goto(`${BASE_URL}/connexion`, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForSelector('#email', { timeout: 10000 });
await page.type('#email', empEmail, { delay: 5 });
await page.type('#password', 'Passw0rd1', { delay: 5 });
await page.$eval('#acceptTerms', (el) => el.click());
await Promise.all([
  page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 15000 }),
  page.$eval('button[type="submit"]', (el) => el.click()),
]);
await new Promise((r) => setTimeout(r, 1500));

console.log('=== Navigation clavier (Tab) sur le dashboard employeur ===');
const focusLog = [];
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    const hasVisibleOutline = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    // Nom accessible : aria-label, sinon texte, sinon alt d'une image enfant unique
    // (cas du logo, <a><img alt="..."></a>, sans quoi on obtient un faux positif).
    const ariaLabel = el.getAttribute('aria-label');
    const text = el.textContent?.trim();
    const onlyImg = el.children.length === 1 && el.children[0].tagName === 'IMG' ? el.children[0].getAttribute('alt') : null;
    const accessibleName = ariaLabel || text || onlyImg || null;
    return { tag: el.tagName, accessibleName, hasVisibleOutline };
  });
  if (info) focusLog.push(info);
}
focusLog.forEach((f, i) => console.log(` ${i + 1}.`, JSON.stringify(f)));
const noFocusOutline = focusLog.filter((f) => !f.hasVisibleOutline).length;
const noAccessibleName = focusLog.filter((f) => !f.accessibleName).length;

console.log('\n=== Images sans attribut alt ===');
const badImages = await page.evaluate(() => document.querySelectorAll('img:not([alt])').length);
console.log('images sans alt:', badImages);

console.log('\n=== Résumé ===');
console.log(`Arrêts de tabulation testés : ${focusLog.length}`);
console.log(`Sans focus visible : ${noFocusOutline}`);
console.log(`Sans nom accessible : ${noAccessibleName}`);
console.log(`Images sans alt : ${badImages}`);

await browser.close();
console.log('\nNettoyage : compte de test', empEmail, 'à supprimer si besoin (deleteMany sur ce préfixe).');
