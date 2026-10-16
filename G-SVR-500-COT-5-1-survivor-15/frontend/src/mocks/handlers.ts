import { http, HttpResponse } from 'msw';
import { haversine, inBBox, parseBBox } from '@/lib/geo';
import { realtime } from '@/lib/socket';
import type { Application, Offer, User } from '@/types';
import {
  adminMetrics,
  applications,
  employerStats,
  offers,
  passwords,
  reports,
  resetTokens,
  users,
} from './data';

function jsonError(status: number, code: string, message: string, fields?: { field: string; message: string }[]) {
  return HttpResponse.json({ status, code, message, fields }, { status });
}

function bearer(request: Request): string | null {
  const h = request.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7);
}

function userFromToken(token: string | null): User | undefined {
  if (!token) return undefined;
  const id = token.split(':')[1];
  return users.find((u) => u.id === id);
}

function requireUser(request: Request, roles?: User['role'][]) {
  const user = userFromToken(bearer(request));
  if (!user) return { error: jsonError(401, 'unauthenticated', 'Session expirée. Reconnectez-vous.') };
  if (roles && !roles.includes(user.role)) {
    return { error: jsonError(403, 'forbidden', 'Cet espace est réservé à un autre type de compte.') };
  }
  if (user.status === 'suspended') {
    return { error: jsonError(403, 'suspended', 'Ce compte a été suspendu.') };
  }
  return { user };
}

function tokens(user: User) {
  return {
    user,
    accessToken: `access:${user.id}:${Date.now()}`,
    refreshToken: `refresh:${user.id}:${Date.now()}`,
  };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const handlers = [
  http.post('/auth/register', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? '').toLowerCase().trim();
    const role = body.role === 'employer' ? 'employer' : 'candidate';
    if (!email || !String(body.password ?? '')) {
      return jsonError(422, 'validation', 'Email et mot de passe sont obligatoires.', [
        { field: 'email', message: 'Indiquez un email.' },
      ]);
    }
    if (users.some((u) => u.email === email)) {
      return jsonError(422, 'validation', 'Un compte existe déjà avec cet email.', [
        { field: 'email', message: 'Cet email est déjà utilisé.' },
      ]);
    }
    if (role === 'employer') {
      const siret = String(body.siret ?? '').replace(/\s/g, '');
      if (!/^\d{14}$/.test(siret)) {
        return jsonError(422, 'validation', 'Le SIRET doit contenir 14 chiffres.', [
          { field: 'siret', message: 'SIRET invalide : 14 chiffres attendus, sans espaces.' },
        ]);
      }
    }
    const user: User = {
      id: `u-${Date.now()}`,
      email,
      role,
      status: role === 'employer' ? 'pending' : 'active',
      firstName: body.firstName as string | undefined,
      lastName: body.lastName as string | undefined,
      phone: body.phone as string | undefined,
      city: body.city as string | undefined,
      defaultRadiusKm: Number(body.defaultRadiusKm ?? 3),
      jobTitle: body.jobTitle as string | undefined,
      contracts: body.contracts as User['contracts'],
      availableFrom: body.availableFrom as string | undefined,
      geoConsent: Boolean(body.geoConsent),
      alertsConsent: Boolean(body.alertsConsent),
      companyName: body.companyName as string | undefined,
      siret: body.siret as string | undefined,
      sector: body.sector as string | undefined,
      address: body.address as string | undefined,
      lat: body.lat as number | undefined,
      lng: body.lng as number | undefined,
    };
    users.push(user);
    passwords.set(email, String(body.password));
    return HttpResponse.json(tokens(user), { status: 201 });
  }),

  http.post('/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email ?? '').toLowerCase().trim();
    const user = users.find((u) => u.email === email);
    const ok = user && passwords.get(email) === body.password;
    if (!ok) {
      return jsonError(
        401,
        'invalid_credentials',
        'Identifiants incorrects. Vérifiez votre email et votre mot de passe.',
      );
    }
    if (user.status === 'suspended') {
      return jsonError(403, 'suspended', 'Ce compte a été suspendu. Contactez le support.');
    }
    return HttpResponse.json(tokens(user));
  }),

  http.post('/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    const id = body.refreshToken?.split(':')[1];
    const user = users.find((u) => u.id === id);
    if (!user) return jsonError(401, 'invalid_refresh', 'Session expirée. Reconnectez-vous.');
    return HttpResponse.json(tokens(user));
  }),

  http.post('/auth/forgot', async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    const email = String(body.email ?? '').toLowerCase();
    const user = users.find((u) => u.email === email);
    if (user) resetTokens.set('demo-reset', user.id);
    return HttpResponse.json({
      ok: true,
      message: 'Si un compte existe, un lien de réinitialisation a été envoyé.',
    });
  }),

  http.post('/auth/reset/:token', async ({ params, request }) => {
    const userId = resetTokens.get(String(params.token));
    const user = users.find((u) => u.id === userId);
    if (!user) return jsonError(404, 'invalid_token', 'Ce lien de réinitialisation n’est plus valide.');
    const body = (await request.json()) as { password?: string };
    passwords.set(user.email, String(body.password ?? ''));
    return HttpResponse.json({ ok: true });
  }),

  http.get('/me', ({ request }) => {
    const auth = requireUser(request);
    if (auth.error) return auth.error;
    return HttpResponse.json(clone(auth.user));
  }),

  http.patch('/me/profile', async ({ request }) => {
    const auth = requireUser(request, ['candidate']);
    if (auth.error) return auth.error;
    const patch = (await request.json()) as Partial<User>;
    Object.assign(auth.user, patch);
    return HttpResponse.json(clone(auth.user));
  }),

  http.post('/me/cv', async ({ request }) => {
    const auth = requireUser(request, ['candidate']);
    if (auth.error) return auth.error;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return jsonError(422, 'validation', 'Ajoutez un fichier PDF ou DOCX.', [
        { field: 'file', message: 'Fichier manquant.' },
      ]);
    }
    if (file.size > 5 * 1024 * 1024) {
      return jsonError(422, 'validation', 'Le CV ne doit pas dépasser 5 Mo.', [
        { field: 'file', message: 'Fichier trop volumineux (5 Mo max).' },
      ]);
    }
    const cv = { id: `cv-${Date.now()}`, name: file.name, size: file.size, uploadedAt: new Date().toISOString() };
    auth.user.cv = cv;
    return HttpResponse.json(cv, { status: 201 });
  }),

  http.get('/offers', ({ request }) => {
    const url = new URL(request.url);
    const bbox = parseBBox(url.searchParams.get('bbox'));
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const radius = Number(url.searchParams.get('radius'));
    const q = url.searchParams.get('q')?.toLowerCase();
    const contract = url.searchParams.get('contract');
    const sector = url.searchParams.get('sector');
    const onlyNew = url.searchParams.get('new') === '1' || url.searchParams.get('new') === 'true';
    const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

    let list = offers.filter((o) => o.status === 'published');
    if (bbox) list = list.filter((o) => inBBox({ lat: o.lat, lng: o.lng }, bbox));
    if (origin && Number.isFinite(radius) && radius > 0) {
      list = list.filter((o) => haversine(origin, { lat: o.lat, lng: o.lng }) <= radius * 1000);
    }
    if (q) {
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.company.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q),
      );
    }
    if (contract) list = list.filter((o) => o.contract === contract);
    if (sector) list = list.filter((o) => o.sector === sector);
    if (onlyNew) list = list.filter((o) => o.isNew);

    const withDist = list.map((o) => ({
      ...clone(o),
      distanceM: origin ? haversine(origin, { lat: o.lat, lng: o.lng }) : null,
    }));
    withDist.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    return HttpResponse.json(withDist);
  }),

  http.get('/offers/:id', ({ params }) => {
    const offer = offers.find((o) => o.id === params.id);
    if (!offer) return jsonError(404, 'not_found', 'Cette offre n’existe plus ou a été dépubliée.');
    offer.views += 1;
    return HttpResponse.json(clone(offer));
  }),

  http.post('/offers', async ({ request }) => {
    const auth = requireUser(request, ['employer']);
    if (auth.error) return auth.error;
    if (auth.user.status === 'pending') {
      return jsonError(
        403,
        'pending_verification',
        'Votre activité est en cours de vérification (48 h). La publication sera possible ensuite.',
      );
    }
    const body = (await request.json()) as Partial<Offer>;
    if (!body.title || !body.lat || !body.lng) {
      return jsonError(422, 'validation', 'Intitulé et localisation sont obligatoires.', [
        { field: 'title', message: 'Indiquez un intitulé.' },
      ]);
    }
    const offer: Offer = {
      id: `off-${Date.now()}`,
      title: body.title,
      description: body.description ?? '',
      company: auth.user.companyName ?? 'Entreprise',
      employerId: auth.user.id,
      sector: (body.sector as Offer['sector']) ?? 'Commerce',
      contract: body.contract ?? 'CDI',
      tags: body.tags ?? [body.contract ?? 'CDI'],
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      salaryKind: body.salaryKind,
      workTime: body.workTime,
      address: body.address ?? auth.user.address ?? '',
      lat: body.lat,
      lng: body.lng,
      radiusKm: body.radiusKm ?? 3,
      isNew: true,
      createdAt: new Date().toISOString(),
      endsAt: body.endsAt ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: 'published',
      views: 0,
      approaches: 0,
      applicationsCount: 0,
    };
    offers.unshift(offer);
    realtime.emit('offer:created', clone(offer));
    return HttpResponse.json(clone(offer), { status: 201 });
  }),

  http.patch('/offers/:id', async ({ params, request }) => {
    const auth = requireUser(request, ['employer', 'admin']);
    if (auth.error) return auth.error;
    const offer = offers.find((o) => o.id === params.id);
    if (!offer) return jsonError(404, 'not_found', 'On n’a pas trouvé cette offre. Réessayez ?');
    if (auth.user.role === 'employer' && offer.employerId !== auth.user.id) {
      return jsonError(403, 'forbidden', 'Vous ne pouvez modifier que vos propres offres.');
    }
    const patch = (await request.json()) as Partial<Offer>;
    Object.assign(offer, patch);
    realtime.emit('offer:updated', clone(offer));
    return HttpResponse.json(clone(offer));
  }),

  http.delete('/offers/:id', ({ params, request }) => {
    const auth = requireUser(request, ['employer', 'admin']);
    if (auth.error) return auth.error;
    const idx = offers.findIndex((o) => o.id === params.id);
    if (idx < 0) return jsonError(404, 'not_found', 'On n’a pas trouvé cette offre. Réessayez ?');
    const offer = offers[idx];
    if (!offer) return jsonError(404, 'not_found', 'On n’a pas trouvé cette offre. Réessayez ?');
    if (auth.user.role === 'employer' && offer.employerId !== auth.user.id) {
      return jsonError(403, 'forbidden', 'Vous ne pouvez retirer que vos propres offres.');
    }
    offer.status = 'unpublished';
    realtime.emit('offer:removed', { id: offer.id });
    return HttpResponse.json({ ok: true });
  }),

  http.post('/offers/:id/report', async ({ params, request }) => {
    const auth = requireUser(request);
    if (auth.error) return auth.error;
    const offer = offers.find((o) => o.id === params.id);
    if (!offer) return jsonError(404, 'not_found', 'On n’a pas trouvé cette offre. Réessayez ?');
    const body = (await request.json()) as { reason?: string; comment?: string };
    if (!body.reason) {
      return jsonError(422, 'validation', 'Choisissez un motif de signalement.', [
        { field: 'reason', message: 'Motif obligatoire.' },
      ]);
    }
    offer.status = 'reported';
    reports.unshift({
      id: `rep-${Date.now()}`,
      offerId: offer.id,
      offerTitle: offer.title,
      reason: body.reason,
      comment: body.comment,
      reporterId: auth.user.id,
      createdAt: new Date().toISOString(),
      status: 'open',
    });
    return HttpResponse.json({ ok: true });
  }),

  http.post('/applications', async ({ request }) => {
    const auth = requireUser(request, ['candidate']);
    if (auth.error) return auth.error;
    const body = (await request.json()) as { offerId?: string; message?: string; cvId?: string };
    const offer = offers.find((o) => o.id === body.offerId);
    if (!offer) return jsonError(404, 'not_found', 'On n’a pas trouvé cette offre. Réessayez ?');
    const app = {
      id: `app-${Date.now()}`,
      offerId: offer.id,
      candidateId: auth.user.id,
      candidateName: `${auth.user.firstName ?? ''} ${auth.user.lastName ?? ''}`.trim(),
      candidateEmail: auth.user.email,
      offerTitle: offer.title,
      company: offer.company,
      status: 'sent' as const,
      message: body.message,
      cvId: body.cvId ?? auth.user.cv?.id,
      createdAt: new Date().toISOString(),
    };
    applications.unshift(app);
    offer.applicationsCount += 1;
    realtime.emit('application:status', clone(app));
    return HttpResponse.json(clone(app), { status: 201 });
  }),

  http.get('/applications', ({ request }) => {
    const auth = requireUser(request, ['candidate']);
    if (auth.error) return auth.error;
    return HttpResponse.json(applications.filter((a) => a.candidateId === auth.user.id).map(clone));
  }),

  http.get('/pro/applications', ({ request }) => {
    const auth = requireUser(request, ['employer']);
    if (auth.error) return auth.error;
    const mine = offers.filter((o) => o.employerId === auth.user.id).map((o) => o.id);
    return HttpResponse.json(applications.filter((a) => mine.includes(a.offerId)).map(clone));
  }),

  http.patch('/pro/applications/:id', async ({ params, request }) => {
    const auth = requireUser(request, ['employer']);
    if (auth.error) return auth.error;
    const app = applications.find((a) => a.id === params.id);
    if (!app) return jsonError(404, 'not_found', 'On n’a pas trouvé cette candidature. Réessayez ?');
    const body = (await request.json()) as { status?: Application['status'] };
    if (body.status) app.status = body.status;
    realtime.emit('application:status', clone(app));
    return HttpResponse.json(clone(app));
  }),

  http.get('/pro/stats', ({ request }) => {
    const auth = requireUser(request, ['employer']);
    if (auth.error) return auth.error;
    return HttpResponse.json(employerStats);
  }),

  http.get('/pro/offers', ({ request }) => {
    const auth = requireUser(request, ['employer']);
    if (auth.error) return auth.error;
    return HttpResponse.json(offers.filter((o) => o.employerId === auth.user.id).map(clone));
  }),

  http.get('/admin/offers', ({ request }) => {
    const auth = requireUser(request, ['admin']);
    if (auth.error) return auth.error;
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const list = status === 'reported' ? offers.filter((o) => o.status === 'reported') : offers;
    return HttpResponse.json(list.map(clone));
  }),

  http.get('/admin/reports', ({ request }) => {
    const auth = requireUser(request, ['admin']);
    if (auth.error) return auth.error;
    return HttpResponse.json(reports.map(clone));
  }),

  http.get('/admin/users', ({ request }) => {
    const auth = requireUser(request, ['admin']);
    if (auth.error) return auth.error;
    return HttpResponse.json(users.map(clone));
  }),

  http.patch('/admin/users/:id', async ({ params, request }) => {
    const auth = requireUser(request, ['admin']);
    if (auth.error) return auth.error;
    const target = users.find((u) => u.id === params.id);
    if (!target) return jsonError(404, 'not_found', 'On n’a pas trouvé ce compte. Réessayez ?');
    const body = (await request.json()) as { status?: User['status'] };
    if (body.status) target.status = body.status;
    return HttpResponse.json(clone(target));
  }),

  http.get('/admin/metrics', ({ request }) => {
    const auth = requireUser(request, ['admin']);
    if (auth.error) return auth.error;
    return HttpResponse.json(adminMetrics);
  }),
];

const authBackendRoutes = ['/auth', '/me'];

export const activeHandlers = handlers.filter((h) => {
  const path = (h as { info?: { path?: string } }).info?.path ?? '';
  return !authBackendRoutes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
});
