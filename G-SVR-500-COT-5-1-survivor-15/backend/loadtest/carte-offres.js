// Test de charge, consultation carte + liste des offres (exigence Thomas Vignal)
// 50 utilisateurs simultanés pendant 3 minutes. Base : 537 offres / 59 communes
// (voir prisma/seed-load-test.ts). Cible le backend réel directement (pas de pont
// de dev), pour mesurer l'API telle qu'elle sera réellement servie.
//
// Lancer : k6 run backend/loadtest/carte-offres.js
// Variable d'environnement BASE_URL pour cibler un autre backend (défaut ci-dessous).
// Variable d'environnement VUS pour changer le nombre d'utilisateurs simultanés
// (défaut 50, le seuil exigé) : k6 run -e VUS=100 backend/loadtest/carte-offres.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3010/api';
const VUS = Number(__ENV.VUS) || 50;

const errorRate = new Rate('errors');
const nearbyDuration = new Trend('nearby_duration');
const detailDuration = new Trend('detail_duration');

// Sous-ensemble des communes réellement seedées (prisma/seed-load-test.ts),
// simule des utilisateurs répartis dans toute la France, pas un point unique.
const COMMUNES = [
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
  { name: 'Brest', lat: 48.3904, lng: -4.4861 },
  { name: 'Dijon', lat: 47.322, lng: 5.0415 },
  { name: 'Angers', lat: 47.4784, lng: -0.5632 },
  { name: 'Perpignan', lat: 42.6886, lng: 2.8948 },
];

export const options = {
  scenarios: {
    carte_et_offres: {
      executor: 'constant-vus',
      vus: VUS,
      duration: '3m',
    },
  },
  thresholds: {
    // Seuils indicatifs (pas bloquants ici) pour lecture rapide du rapport.
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  const commune = COMMUNES[Math.floor(Math.random() * COMMUNES.length)];
  const radiusKm = [10, 15, 20, 25][Math.floor(Math.random() * 4)];

  // 1) Consultation carte : recherche d'offres à proximité (PostGIS ST_DWithin)
  const nearbyRes = http.get(
    `${BASE_URL}/offers/nearby?lat=${commune.lat}&lng=${commune.lng}&radiusKm=${radiusKm}`,
    { tags: { endpoint: 'nearby' } },
  );
  nearbyDuration.add(nearbyRes.timings.duration);
  const nearbyOk = check(nearbyRes, {
    'nearby: status 200': (r) => r.status === 200,
    'nearby: a un tableau offers': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).offers);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!nearbyOk);

  sleep(Math.random() * 1.5 + 0.5); // temps de lecture simulé (0.5-2s)

  // 2) Consultation du détail d'une offre trouvée (comportement réaliste : l'utilisateur clique dessus)
  if (nearbyOk) {
    try {
      const offers = JSON.parse(nearbyRes.body).offers;
      if (offers.length > 0) {
        const offer = offers[Math.floor(Math.random() * offers.length)];
        const detailRes = http.get(`${BASE_URL}/offers/${offer.id}`, {
          tags: { endpoint: 'detail' },
        });
        detailDuration.add(detailRes.timings.duration);
        const detailOk = check(detailRes, {
          'detail: status 200': (r) => r.status === 200,
        });
        errorRate.add(!detailOk);
      }
    } catch {
      // pas d'offre à consulter, rien à faire
    }
  }

  sleep(Math.random() * 1 + 0.5);
}
