/**
 * Seed d'offres, module 3 (Employeur & candidatures).
 * Fournit un jeu de données pour la reprise cartographique IGN (feature/job-seeker) :
 *   - offres NORMALES  : adresse résoluble + coordonnées correctes  -> pas d'écart
 *   - offres LEGACY     : adresse résoluble mais coordonnées « d'avant » fausses -> écart, à vérifier
 *   - offres INSOLUBLES : adresse non géocodable par l'API Adresse   -> non résolu dans le relevé
 *
 * Lancer :  DATABASE_URL=... npx tsx prisma/seed.ts   (depuis backend/, ajuster le chemin)
 */
import { PrismaClient, OfferStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Hash bcrypt pré-calculé de "Employer2026!" (évite une dépendance bcrypt
// depuis prisma/ ; l'employeur de démo reste connectable via le module auth).
const DEMO_PASSWORD_HASH = '$2b$10$eSj7tx8CYfw0EHmtWEFzD.64cV0B00s969Nn.bnX92KIBhBlg3nu2';

// Hash bcrypt pré-calculé de "Admin2026!". Signalé par Ariel (09/09/2026) :
// aucun compte admin réel en base (le README n'en donne un que côté mocks MSW,
// avec en plus un email différent : admin@geoemploi.fr dans mocks/data.ts).
const ADMIN_PASSWORD_HASH = '$2b$10$3EAy/vT6qzmOJlh0o45cbeM4Spfg4dhXpFM.M7QkvqJYig0py6JIS';

type SeedOffer = {
  title: string;
  address: string;
  commune: string;
  latitude: number;
  longitude: number;
  group: 'normal' | 'legacy' | 'insoluble';
  sector: string;
  contractType: string;
  salaryMin: number;
  salaryMax: number;
  experienceLevel: string;
  requiredSkills: string[];
  workTime: string;
};

// Champs métier (sector/contractType/salaire/experience/compétences) ajoutés le
// 2026-09-04 : signalé manquant par Stella, ce seed n'avait jamais été mis à jour
// après l'ajout de ces colonnes sur Offer (contrairement à seed-load-test.ts).
const OFFERS: SeedOffer[] = [
  // --- NORMALES : coordonnées ~ conformes à l'adresse ---
  { title: 'Développeur Full-Stack', address: '20 Avenue de Ségur, 75007 Paris', commune: 'Paris', latitude: 48.8507, longitude: 2.3086, group: 'normal', sector: 'Tech', contractType: 'CDI', salaryMin: 2800, salaryMax: 3600, experienceLevel: '3-5 ans', requiredSkills: ['Node.js', 'TypeScript'], workTime: '35h/semaine' },
  { title: 'Data Analyst', address: '1 Place Bellecour, 69002 Lyon', commune: 'Lyon', latitude: 45.7578, longitude: 4.832, group: 'normal', sector: 'Tech', contractType: 'CDI', salaryMin: 2600, salaryMax: 3400, experienceLevel: '1-3 ans', requiredSkills: ['SQL', 'Python'], workTime: '35h/semaine' },
  { title: 'Chef de projet digital', address: 'Place de la Bourse, 33000 Bordeaux', commune: 'Bordeaux', latitude: 44.8412, longitude: -0.57, group: 'normal', sector: 'Tech', contractType: 'CDI', salaryMin: 2800, salaryMax: 3500, experienceLevel: '3-5 ans', requiredSkills: ['Gestion de projet', 'Agile'], workTime: '35h/semaine' },
  { title: 'Community Manager', address: 'Grand Place, 59000 Lille', commune: 'Lille', latitude: 50.6366, longitude: 3.0635, group: 'normal', sector: 'Services', contractType: 'CDI', salaryMin: 1900, salaryMax: 2300, experienceLevel: '1-3 ans', requiredSkills: ['Réseaux sociaux', 'Rédaction'], workTime: '35h/semaine' },
  { title: 'Comptable général', address: 'Place du Capitole, 31000 Toulouse', commune: 'Toulouse', latitude: 43.6045, longitude: 1.4442, group: 'normal', sector: 'Services', contractType: 'CDI', salaryMin: 2100, salaryMax: 2600, experienceLevel: '3-5 ans', requiredSkills: ['Comptabilité générale'], workTime: '35h/semaine' },
  { title: 'UX/UI Designer', address: 'Place du Commerce, 44000 Nantes', commune: 'Nantes', latitude: 47.213, longitude: -1.557, group: 'normal', sector: 'Tech', contractType: 'CDI', salaryMin: 2600, salaryMax: 3300, experienceLevel: '1-3 ans', requiredSkills: ['Figma', 'Recherche utilisateur'], workTime: '35h/semaine' },
  { title: 'Ingénieur DevOps', address: 'Place Kléber, 67000 Strasbourg', commune: 'Strasbourg', latitude: 48.5834, longitude: 7.7455, group: 'normal', sector: 'Tech', contractType: 'CDI', salaryMin: 3000, salaryMax: 3900, experienceLevel: '5 ans et plus', requiredSkills: ['Docker', 'CI/CD'], workTime: '35h/semaine' },
  { title: 'Chargé de clientèle', address: '7 Promenade des Anglais, 06000 Nice', commune: 'Nice', latitude: 43.695, longitude: 7.265, group: 'normal', sector: 'Services', contractType: 'CDI', salaryMin: 1800, salaryMax: 2200, experienceLevel: 'Débutant accepté', requiredSkills: ['Relation client', 'CRM'], workTime: '35h/semaine' },

  // --- LEGACY : adresse résoluble MAIS coordonnées « d'avant » volontairement fausses ---
  // Marseille : décalage de plusieurs km
  { title: 'Cariste CACES', address: 'Quai du Port, 13002 Marseille', commune: 'Marseille', latitude: 43.35, longitude: 5.3, group: 'legacy', sector: 'Logistique', contractType: 'CDI', salaryMin: 1700, salaryMax: 2000, experienceLevel: '1-3 ans', requiredSkills: ['CACES 3', 'CACES 5'], workTime: '35h/semaine' },
  // Nancy : coordonnées carrément à Paris (erreur grossière historique)
  { title: 'Assistant RH', address: 'Place Stanislas, 54000 Nancy', commune: 'Nancy', latitude: 48.8566, longitude: 2.3522, group: 'legacy', sector: 'Services', contractType: 'CDI', salaryMin: 1900, salaryMax: 2300, experienceLevel: '1-3 ans', requiredSkills: ['Droit social'], workTime: '35h/semaine' },
  // Tours : décalage
  { title: 'Technicien de maintenance', address: 'Rue Nationale, 37000 Tours', commune: 'Tours', latitude: 47.3, longitude: 0.75, group: 'legacy', sector: 'Bâtiment', contractType: 'CDI', salaryMin: 1900, salaryMax: 2300, experienceLevel: '3-5 ans', requiredSkills: ['Dépannage'], workTime: '35h/semaine' },
  // Aix : coordonnées arrondies à la commune (imprécision « d'avant »)
  { title: 'Vendeur polyvalent', address: 'Cours Mirabeau, 13100 Aix-en-Provence', commune: 'Aix-en-Provence', latitude: 43.5, longitude: 5.4, group: 'legacy', sector: 'Commerce', contractType: 'CDD', salaryMin: 1550, salaryMax: 1800, experienceLevel: 'Débutant accepté', requiredSkills: ['Relation client'], workTime: '35h/semaine' },

  // --- INSOLUBLES : adresses non géocodables -> non résolu dans le relevé d'écarts ---
  { title: 'Manutentionnaire', address: '42 rue du Fantôme Imaginaire, 00000 Nulle-Part', commune: 'Nulle-Part', latitude: 0, longitude: 0, group: 'insoluble', sector: 'Logistique', contractType: 'Intérim', salaryMin: 1550, salaryMax: 1750, experienceLevel: 'Débutant accepté', requiredSkills: ['Rapidité'], workTime: '35h/semaine' },
  { title: 'Agent logistique', address: 'Lieu-dit Les Limbes, 99999 Contrée-Inexistante', commune: 'Contrée-Inexistante', latitude: 0, longitude: 0, group: 'insoluble', sector: 'Logistique', contractType: 'CDI', salaryMin: 1650, salaryMax: 1900, experienceLevel: '1-3 ans', requiredSkills: ['Excel', 'Organisation'], workTime: '35h/semaine' },
  { title: 'Préparateur de commandes', address: 'Chemin sans nom, Zone Blanche', commune: 'Zone Blanche', latitude: 0, longitude: 0, group: 'insoluble', sector: 'Logistique', contractType: 'CDD', salaryMin: 1600, salaryMax: 1850, experienceLevel: 'Débutant accepté', requiredSkills: ['CACES', 'Rigueur'], workTime: '35h/semaine' },
];

async function main() {
  // Compte admin de démonstration, aucun n'existait en base réelle avant.
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@geoemploi.fr' },
    update: {},
    create: {
      email: 'admin@geoemploi.fr',
      passwordHash: ADMIN_PASSWORD_HASH,
      role: 'ADMIN',
    },
  });
  console.log(`[seed] admin: ${adminUser.email} / mot de passe "Admin2026!"`);

  // Employeur de démonstration (User + EmployerProfile).
  const employerUser = await prisma.user.upsert({
    where: { email: 'seed-employeur@geoemploi.fr' },
    update: {},
    create: {
      email: 'seed-employeur@geoemploi.fr',
      passwordHash: DEMO_PASSWORD_HASH,
      role: 'EMPLOYER',
      employerProfile: {
        create: { companyName: 'Entreprise Démo GéoEmploi', verified: true },
      },
    },
    include: { employerProfile: true },
  });
  const employerId = employerUser.employerProfile!.id;

  // Repartir propre : supprime les offres de cet employeur (cascade -> candidatures).
  await prisma.offer.deleteMany({ where: { employerId } });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  for (const o of OFFERS) {
    await prisma.offer.create({
      data: {
        employerId,
        title: o.title,
        description: `Offre de démonstration (${o.group}), ${o.title}.`,
        address: o.address,
        commune: o.commune,
        latitude: o.latitude,
        longitude: o.longitude,
        radiusKm: 15,
        status: OfferStatus.ACTIVE,
        sector: o.sector,
        contractType: o.contractType,
        salaryMin: o.salaryMin,
        salaryMax: o.salaryMax,
        salaryKind: 'brut',
        workTime: o.workTime,
        experienceLevel: o.experienceLevel,
        requiredSkills: o.requiredSkills,
        expiresAt,
      },
    });
  }

  const counts = OFFERS.reduce<Record<string, number>>((acc, o) => {
    acc[o.group] = (acc[o.group] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[seed] employeur: ${employerUser.email} (profil ${employerId})`);
  console.log(`[seed] ${OFFERS.length} offres : ${counts.normal} normales, ${counts.legacy} legacy (coord. fausses), ${counts.insoluble} insolubles.`);
  console.log('[seed] -> la reprise IGN doit produire des écarts sur les 4 legacy et des non-résolus sur les 3 insolubles.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });