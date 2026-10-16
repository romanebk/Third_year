/**
 * Seed de volume pour le test de charge (module 3, exigence Thomas Vignal) :
 * au moins 500 offres réparties sur au moins 50 communes.
 *
 * Séparé de seed.ts (qui reste dédié à la reprise cartographique IGN, module 2,
 * ne pas fusionner, deux besoins différents).
 *
 * Lancer depuis backend/ :
 *   DATABASE_URL=... npx tsx ../prisma/seed-load-test.ts
 */
import { PrismaClient, OfferStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD_HASH = '$2b$10$eSj7tx8CYfw0EHmtWEFzD.64cV0B00s969Nn.bnX92KIBhBlg3nu2'; // "Employer2026!"

// 56 communes réelles, réparties sur toute la France (pas un cluster autour de Paris).
const COMMUNES: { name: string; lat: number; lng: number }[] = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { name: 'Lyon', lat: 45.764, lng: 4.8357 },
  { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  { name: 'Nice', lat: 43.7102, lng: 7.262 },
  { name: 'Nantes', lat: 47.2184, lng: -1.5536 },
  { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  { name: 'Montpellier', lat: 43.6108, lng: 3.8767 },
  { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  { name: 'Lille', lat: 50.6292, lng: 3.0573 },
  { name: 'Rennes', lat: 48.1173, lng: -1.6778 },
  { name: 'Reims', lat: 49.2583, lng: 4.0317 },
  { name: 'Le Havre', lat: 49.4944, lng: 0.1079 },
  { name: 'Saint-Étienne', lat: 45.4397, lng: 4.3872 },
  { name: 'Toulon', lat: 43.1242, lng: 5.928 },
  { name: 'Grenoble', lat: 45.1885, lng: 5.7245 },
  { name: 'Dijon', lat: 47.322, lng: 5.0415 },
  { name: 'Angers', lat: 47.4784, lng: -0.5632 },
  { name: 'Nîmes', lat: 43.8367, lng: 4.3601 },
  { name: 'Clermont-Ferrand', lat: 45.7772, lng: 3.087 },
  { name: 'Le Mans', lat: 48.0061, lng: 0.1996 },
  { name: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474 },
  { name: 'Brest', lat: 48.3904, lng: -4.4861 },
  { name: 'Tours', lat: 47.3941, lng: 0.6848 },
  { name: 'Amiens', lat: 49.8941, lng: 2.2957 },
  { name: 'Limoges', lat: 45.8336, lng: 1.2611 },
  { name: 'Annecy', lat: 45.8992, lng: 6.1294 },
  { name: 'Perpignan', lat: 42.6886, lng: 2.8948 },
  { name: 'Besançon', lat: 47.2378, lng: 6.0241 },
  { name: 'Metz', lat: 49.1193, lng: 6.1757 },
  { name: 'Orléans', lat: 47.9029, lng: 1.9093 },
  { name: 'Mulhouse', lat: 47.7508, lng: 7.3359 },
  { name: 'Rouen', lat: 49.4431, lng: 1.0993 },
  { name: 'Caen', lat: 49.1829, lng: -0.3707 },
  { name: 'Nancy', lat: 48.6921, lng: 6.1844 },
  { name: 'Saint-Denis', lat: 48.9362, lng: 2.3574 },
  { name: 'Argenteuil', lat: 48.9479, lng: 2.2469 },
  { name: 'Montreuil', lat: 48.8638, lng: 2.4485 },
  { name: 'Roubaix', lat: 50.6942, lng: 3.1746 },
  { name: 'Tourcoing', lat: 50.7236, lng: 3.1611 },
  { name: 'Avignon', lat: 43.9493, lng: 4.8055 },
  { name: 'Poitiers', lat: 46.5802, lng: 0.3404 },
  { name: 'Versailles', lat: 48.8014, lng: 2.1301 },
  { name: 'Pau', lat: 43.2951, lng: -0.3708 },
  { name: 'La Rochelle', lat: 46.1603, lng: -1.1511 },
  { name: 'Cannes', lat: 43.5528, lng: 7.0174 },
  { name: 'Antibes', lat: 43.5804, lng: 7.1251 },
  { name: 'Béziers', lat: 43.3442, lng: 3.2158 },
  { name: 'Colmar', lat: 48.0794, lng: 7.3585 },
  { name: 'Valence', lat: 44.9334, lng: 4.8924 },
  { name: 'Chambéry', lat: 45.5646, lng: 5.9178 },
  { name: 'Niort', lat: 46.3234, lng: -0.4587 },
  { name: 'Troyes', lat: 48.2973, lng: 4.0744 },
  { name: 'Quimper', lat: 47.9961, lng: -4.1024 },
  { name: 'Vannes', lat: 47.6582, lng: -2.7603 },
  { name: 'Angoulême', lat: 45.6486, lng: 0.1558 },
];

// Titre + secteur + compétences + fourchette de salaire brut mensuel (cohérents entre eux,
// pour que les offres de démo exercent vraiment les champs sector/contractType/salaire/
// experienceLevel/requiredSkills, sinon ces champs restent nuls sur toute la base de démo.
const JOB_TITLES: { title: string; sector: string; skills: string[]; salary: [number, number] }[] = [
  { title: 'Chef de rang', sector: 'Restauration', skills: ['Service', 'Anglais'], salary: [1700, 2000] },
  { title: 'Serveur en salle', sector: 'Restauration', skills: ['Service', 'Encaissement'], salary: [1600, 1850] },
  { title: 'Commis de cuisine', sector: 'Restauration', skills: ['Cuisine', 'HACCP'], salary: [1550, 1750] },
  { title: 'Plongeur', sector: 'Restauration', skills: ['Rapidité'], salary: [1500, 1650] },
  { title: 'Pizzaiolo', sector: 'Restauration', skills: ['Cuisine italienne'], salary: [1650, 1950] },
  { title: 'Préparateur de commandes', sector: 'Logistique', skills: ['CACES', 'Rigueur'], salary: [1600, 1850] },
  { title: 'Cariste CACES', sector: 'Logistique', skills: ['CACES 3', 'CACES 5'], salary: [1700, 2000] },
  { title: 'Magasinier', sector: 'Logistique', skills: ['Gestion de stock'], salary: [1650, 1900] },
  { title: 'Chauffeur-livreur', sector: 'Logistique', skills: ['Permis B', 'Sens de l\'orientation'], salary: [1700, 1950] },
  { title: 'Agent logistique', sector: 'Logistique', skills: ['Excel', 'Organisation'], salary: [1650, 1900] },
  { title: 'Aide-soignant', sector: 'Santé', skills: ['Diplôme AS', 'Écoute'], salary: [1800, 2100] },
  { title: 'Infirmier de nuit', sector: 'Santé', skills: ['Diplôme IDE', 'Autonomie'], salary: [2200, 2700] },
  { title: 'Auxiliaire de vie', sector: 'Santé', skills: ['Patience', 'Mobilité'], salary: [1650, 1900] },
  { title: 'Secrétaire médical', sector: 'Santé', skills: ['Frappe rapide', 'Terminologie médicale'], salary: [1700, 1950] },
  { title: 'Ambulancier', sector: 'Santé', skills: ['Permis B', 'Diplôme DEA'], salary: [1800, 2100] },
  { title: 'Vendeur en boutique', sector: 'Commerce', skills: ['Relation client'], salary: [1550, 1800] },
  { title: 'Conseiller de vente', sector: 'Commerce', skills: ['Relation client', 'Anglais'], salary: [1600, 1900] },
  { title: 'Hôte de caisse', sector: 'Commerce', skills: ['Encaissement'], salary: [1550, 1750] },
  { title: 'Responsable de rayon', sector: 'Commerce', skills: ['Management', 'Gestion de stock'], salary: [2000, 2400] },
  { title: 'Merchandiser', sector: 'Commerce', skills: ['Sens esthétique'], salary: [1650, 1900] },
  { title: 'Maçon', sector: 'Bâtiment', skills: ['Lecture de plan'], salary: [1800, 2200] },
  { title: 'Électricien du bâtiment', sector: 'Bâtiment', skills: ['Habilitation électrique'], salary: [1900, 2300] },
  { title: 'Plombier', sector: 'Bâtiment', skills: ['Dépannage'], salary: [1850, 2250] },
  { title: 'Peintre en bâtiment', sector: 'Bâtiment', skills: ['Finitions'], salary: [1750, 2050] },
  { title: 'Chef de chantier', sector: 'Bâtiment', skills: ['Management', 'Lecture de plan'], salary: [2400, 2900] },
  { title: 'Développeur back-end', sector: 'Tech', skills: ['Node.js', 'PostgreSQL'], salary: [2800, 3600] },
  { title: 'Développeur front-end', sector: 'Tech', skills: ['React', 'TypeScript'], salary: [2700, 3500] },
  { title: 'DevOps', sector: 'Tech', skills: ['Docker', 'CI/CD'], salary: [3000, 3900] },
  { title: 'Data analyst', sector: 'Tech', skills: ['SQL', 'Python'], salary: [2600, 3400] },
  { title: 'UX designer', sector: 'Tech', skills: ['Figma', 'Recherche utilisateur'], salary: [2600, 3300] },
  { title: 'Community manager', sector: 'Services', skills: ['Réseaux sociaux', 'Rédaction'], salary: [1900, 2300] },
  { title: 'Chargé de clientèle', sector: 'Services', skills: ['Relation client', 'CRM'], salary: [1800, 2200] },
  { title: 'Assistant commercial', sector: 'Services', skills: ['Excel', 'Relation client'], salary: [1850, 2200] },
  { title: 'Comptable', sector: 'Services', skills: ['Comptabilité générale'], salary: [2100, 2600] },
  { title: 'Gestionnaire de paie', sector: 'Services', skills: ['Droit social', 'Paie'], salary: [2200, 2700] },
  { title: 'Agent d\'entretien', sector: 'Services', skills: ['Rigueur'], salary: [1500, 1650] },
  { title: 'Femme de ménage', sector: 'Services', skills: ['Rigueur'], salary: [1500, 1650] },
  { title: 'Agent de sécurité', sector: 'Services', skills: ['SSIAP'], salary: [1700, 1950] },
  { title: 'Réceptionniste', sector: 'Services', skills: ['Accueil', 'Anglais'], salary: [1600, 1850] },
  { title: 'Concierge', sector: 'Services', skills: ['Polyvalence'], salary: [1650, 1900] },
];

const CONTRACTS = ['CDI', 'CDD', 'Intérim', 'Extra', 'Alternance', 'Stage'];
const EXPERIENCE_LEVELS = ['Débutant accepté', '1-3 ans', '3-5 ans', '5 ans et plus'];

function jitter(base: number, spreadDeg: number) {
  return base + (Math.random() - 0.5) * spreadDeg;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function main() {
  const NB_EMPLOYERS = 14;
  const NB_OFFERS = 520;

  console.log('[seed-load-test] création des employeurs…');
  const employerIds: string[] = [];
  for (let i = 0; i < NB_EMPLOYERS; i++) {
    const email = `load-test-employeur-${i}@geoemploi.fr`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: DEMO_PASSWORD_HASH,
        role: 'EMPLOYER',
        employerProfile: {
          create: { companyName: `Entreprise Démo ${i + 1}`, verified: i % 3 !== 0 },
        },
      },
      include: { employerProfile: true },
    });
    employerIds.push(user.employerProfile!.id);
  }
  console.log(`[seed-load-test] ${employerIds.length} employeurs prêts.`);

  console.log('[seed-load-test] purge des anciennes offres de charge…');
  await prisma.offer.deleteMany({ where: { employerId: { in: employerIds } } });

  console.log(`[seed-load-test] génération de ${NB_OFFERS} offres sur ${COMMUNES.length} communes…`);
  const now = Date.now();
  const data = Array.from({ length: NB_OFFERS }, () => {
    const commune = pick(COMMUNES);
    const job = pick(JOB_TITLES);
    const contract = pick(CONTRACTS);
    const createdAt = new Date(now - Math.floor(Math.random() * 25) * 24 * 60 * 60 * 1000);
    return {
      employerId: pick(employerIds),
      title: job.title,
      description: `${job.title} recherché(e) en ${contract}, poste basé à ${commune.name}.`,
      latitude: jitter(commune.lat, 0.08), // ~± quelques km autour du centre-ville
      longitude: jitter(commune.lng, 0.08),
      address: `Centre-ville, ${commune.name}`,
      commune: commune.name,
      radiusKm: [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)],
      status: OfferStatus.ACTIVE,
      sector: job.sector,
      contractType: contract,
      salaryMin: job.salary[0],
      salaryMax: job.salary[1],
      salaryKind: 'brut',
      workTime: pick(['35h/semaine', '39h/semaine', 'Temps partiel']),
      experienceLevel: pick(EXPERIENCE_LEVELS),
      requiredSkills: job.skills,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    };
  });

  await prisma.offer.createMany({ data });

  const total = await prisma.offer.count();
  const communesCount = new Set(data.map((o) => o.commune)).size;
  console.log(`[seed-load-test] terminé : ${data.length} offres créées (${communesCount} communes distinctes).`);
  console.log(`[seed-load-test] total offres en base (toutes origines confondues) : ${total}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
