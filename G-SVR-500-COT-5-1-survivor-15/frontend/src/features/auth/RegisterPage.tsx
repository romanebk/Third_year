import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, toBackendRole } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { passwordScore } from '@/lib/format';
import { PARIS_11 } from '@/lib/geo';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { FileDrop } from '@/components/ui/FileDrop';
import { useSessionStore } from '@/store/session';
import { CONTRACTS, SECTORS, type AuthResponse } from '@/types';
import {
  candidateStep1,
  candidateStep2,
  candidateStep3,
  employerSchema,
} from './schemas';
import { AuthShell } from './AuthShell';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { OSM_ATTRIBUTION, TILE_OPTS, VOYAGER_URL } from '@/lib/tiles';

const pin = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: '<div style="width:24px;height:24px;border-radius:9px;background:#141715;display:grid;place-items:center"><span style="width:7px;height:7px;border-radius:50%;background:#C8E6C0;display:block"></span></div>',
});

function DraggablePin({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return (
    <Marker
      position={[lat, lng]}
      draggable
      icon={pin}
      eventHandlers={{
        dragend: (e) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onMove(ll.lat, ll.lng);
        },
      }}
    />
  );
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const initial = params.get('role') === 'employer' ? 'employer' : 'candidate';
  const [role, setRole] = useState<'candidate' | 'employer'>(initial);
  return role === 'employer' ? (
    <EmployerForm onSwitch={() => setRole('candidate')} />
  ) : (
    <CandidateForm onSwitch={() => setRole('employer')} />
  );
}

function CandidateForm({ onSwitch }: { onSwitch: () => void }) {
  const [step, setStep] = useState(1);
  const [cv, setCv] = useState<File | null>(null);
  const nav = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);

  const s1 = useForm({ resolver: zodResolver(candidateStep1), defaultValues: { email: '', password: '', confirm: '' } });
  const s2 = useForm({
    resolver: zodResolver(candidateStep2),
    defaultValues: { firstName: '', lastName: '', phone: '', city: 'Paris 11e', defaultRadiusKm: 3 },
  });
  const s3 = useForm({
    resolver: zodResolver(candidateStep3),
    defaultValues: {
      jobTitle: '',
      contracts: [] as string[],
      availableFrom: '',
      geoConsent: undefined,
      alertsConsent: false,
    },
  });

  const pwd = s1.watch('password');
  const strength = useMemo(() => passwordScore(pwd ?? ''), [pwd]);

  const finish = s3.handleSubmit(async (v3) => {
    const v1 = s1.getValues();
    const v2 = s2.getValues();
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', {
        role: toBackendRole('candidate'),
        ...v1,
        ...v2,
        ...v3,
      });
      setSession(data.user, data.accessToken, data.refreshToken, true);
      if (cv) {
        const fd = new FormData();
        fd.append('file', cv);
        await api.post('/me/cv', fd);
      }
      nav('/app');
    } catch (e) {
      s3.setError('jobTitle', {
        message: e instanceof ApiError ? e.message : 'Inscription impossible pour le moment.',
      });
    }
  });

  return (
    <AuthShell
      title={
        <>
          Créez votre compte <span className="text-forest">candidat</span>
        </>
      }
      subtitle="Trois étapes pour afficher les offres autour de vous et postuler en un geste."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link className="font-bold text-ink" to="/connexion">
            Se connecter
          </Link>
          <br />
          <button type="button" className="mt-2 font-semibold text-ink" onClick={onSwitch}>
            Vous recrutez ? Compte employeur
          </button>
        </>
      }
      panelTitle="Il y a du travail près de chez vous."
      panelStory={{
        title: 'Comment ça marche',
        body: 'Ouvrez la carte, repérez une offre près de votre commune, puis postulez directement.',
        cta: { to: '/#etapes', label: 'Voir les 3 gestes' },
      }}
    >
      <Stepper step={step} total={3} labels={['Compte', 'Profil', 'Métier']} />
      {step === 1 ? (
        <form
          className="space-y-4"
          onSubmit={s1.handleSubmit(() => setStep(2))}
          noValidate
        >
          <Input id="email" label="Email *" type="email" error={s1.formState.errors.email?.message} {...s1.register('email')} />
          <Input
            id="password"
            label="Mot de passe *"
            type="password"
            hint="10 caractères, 1 majuscule, 1 chiffre"
            error={s1.formState.errors.password?.message}
            {...s1.register('password')}
          />
          <div className="h-1.5 overflow-hidden rounded-full bg-grey">
            <span
              className="block h-full bg-success"
              style={{ width: `${(strength.score / 5) * 100}%` }}
            />
          </div>
          <p className="text-[12px] text-muted">Force : {strength.label}</p>
          <Input
            id="confirm"
            label="Confirmation *"
            type="password"
            error={s1.formState.errors.confirm?.message}
            {...s1.register('confirm')}
          />
          <Button variant="dark" type="submit" className="w-full">
            Continuer
          </Button>
        </form>
      ) : null}
      {step === 2 ? (
        <form className="space-y-4" onSubmit={s2.handleSubmit(() => setStep(3))} noValidate>
          <Input id="firstName" label="Prénom" error={s2.formState.errors.firstName?.message} {...s2.register('firstName')} />
          <Input id="lastName" label="Nom" error={s2.formState.errors.lastName?.message} {...s2.register('lastName')} />
          <Input id="phone" label="Téléphone" error={s2.formState.errors.phone?.message} {...s2.register('phone')} />
          <Input id="city" label="Ville" error={s2.formState.errors.city?.message} {...s2.register('city')} />
          <label className="field-label" htmlFor="defaultRadiusKm">
            Rayon de recherche : {s2.watch('defaultRadiusKm')} km
          </label>
          <input
            id="defaultRadiusKm"
            type="range"
            min={1}
            max={20}
            className="w-full"
            {...s2.register('defaultRadiusKm', { valueAsNumber: true })}
          />
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button variant="lime" type="submit" className="flex-1">
              Continuer
            </Button>
          </div>
        </form>
      ) : null}
      {step === 3 ? (
        <form className="space-y-4" onSubmit={finish} noValidate>
          <Input id="jobTitle" label="Métier recherché" error={s3.formState.errors.jobTitle?.message} {...s3.register('jobTitle')} />
          <fieldset>
            <legend className="field-label">Type de contrat</legend>
            <div className="flex flex-wrap gap-2">
              {CONTRACTS.map((c) => (
                <label key={c} className="rounded-full border border-line px-3 py-1.5 text-[13px]">
                  <input type="checkbox" value={c} className="mr-1.5" {...s3.register('contracts')} />
                  {c}
                </label>
              ))}
            </div>
            {s3.formState.errors.contracts ? (
              <p className="field-error">{s3.formState.errors.contracts.message}</p>
            ) : null}
          </fieldset>
          <Input
            id="availableFrom"
            label="Disponible à partir du"
            type="date"
            error={s3.formState.errors.availableFrom?.message}
            {...s3.register('availableFrom')}
          />
          <FileDrop label="CV (PDF ou DOCX, 5 Mo max)" value={cv} onChange={setCv} />
          <label className="flex items-start gap-2 text-[13.5px]">
            <input type="checkbox" {...s3.register('geoConsent')} />
            <span>
              J’accepte le traitement de ma position pour afficher les offres.{' '}
              <Link className="font-semibold underline" to="/mentions/donnees">
                Politique de données
              </Link>
            </span>
          </label>
          {s3.formState.errors.geoConsent ? (
            <p className="field-error">{s3.formState.errors.geoConsent.message}</p>
          ) : null}
          <label className="flex items-start gap-2 text-[13.5px]">
            <input type="checkbox" {...s3.register('alertsConsent')} />
            J’accepte de recevoir des alertes d’offres proches (facultatif)
          </label>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button variant="lime" type="submit" className="flex-1" disabled={s3.formState.isSubmitting}>
              {s3.formState.isSubmitting ? 'Création…' : 'Créer mon compte'}
            </Button>
          </div>
        </form>
      ) : null}
    </AuthShell>
  );
}

function EmployerForm({ onSwitch }: { onSwitch: () => void }) {
  const nav = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const form = useForm({
    resolver: zodResolver(employerSchema),
    defaultValues: {
      companyName: '',
      siret: '',
      sector: 'Restauration',
      address: '12 rue de la Roquette, 75011 Paris',
      lat: PARIS_11.lat,
      lng: PARIS_11.lng,
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  });

  const searchNominatim = async (q: string) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(q)}`,
    );
    const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const hit = json[0];
    if (!hit) return;
    form.setValue('lat', Number(hit.lat));
    form.setValue('lng', Number(hit.lon));
    form.setValue('address', hit.display_name);
  };

  return (
    <AuthShell
      title={
        <>
          Créez votre <span className="text-forest">compte employeur</span>
        </>
      }
      subtitle="Activité vérifiée sous 48 h. Tant que le statut est « en attente », la publication d’offres est bloquée."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link className="font-bold text-ink" to="/connexion">
            Se connecter
          </Link>
          <br />
          <button type="button" className="mt-2 font-semibold text-ink" onClick={onSwitch}>
            Vous cherchez un emploi ? Compte candidat
          </button>
        </>
      }
      panelTitle="Vous recrutez dans le quartier"
      panelStory={{
        title: 'Publication gratuite',
        body: 'Choisissez le rayon de diffusion de chaque offre, sans contrepartie financière. Offres illimitées.',
        cta: { to: '/#employeurs', label: 'Voir la zone' },
      }}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const { data } = await api.post<AuthResponse>('/auth/register', {
              role: toBackendRole('employer'),
              ...values,
            });
            setSession(data.user, data.accessToken, data.refreshToken, true);
            nav('/pro/tableau-de-bord');
          } catch (e) {
            const err = e instanceof ApiError ? e : null;
            err?.fields?.forEach((f) => form.setError(f.field as 'siret', { message: f.message }));
            if (!err?.fields?.length) {
              form.setError('email', { message: err?.message ?? 'Inscription impossible.' });
            }
          }
        })}
        noValidate
      >
        <Input
          id="companyName"
          label="Raison sociale *"
          error={form.formState.errors.companyName?.message}
          {...form.register('companyName')}
        />
        <Input
          id="siret"
          label="SIRET (14 chiffres) *"
          error={form.formState.errors.siret?.message}
          {...form.register('siret')}
        />
        <Select
          id="sector"
          label="Secteur *"
          error={form.formState.errors.sector?.message}
          {...form.register('sector')}
        >
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Input
          id="address"
          label="Adresse de l’entreprise *"
          error={form.formState.errors.address?.message}
          {...form.register('address')}
          onBlur={(e) => searchNominatim(e.target.value)}
        />
        <div className="relative h-48 overflow-hidden rounded-[18px]">
          <MapContainer
            center={[form.watch('lat'), form.watch('lng')]}
            zoom={15}
            className="h-full w-full"
            scrollWheelZoom={false}
          >
            <TileLayer attribution={OSM_ATTRIBUTION} url={VOYAGER_URL} {...TILE_OPTS} />
            <DraggablePin
              lat={form.watch('lat')}
              lng={form.watch('lng')}
              onMove={(lat, lng) => {
                form.setValue('lat', lat);
                form.setValue('lng', lng);
              }}
            />
          </MapContainer>
        </div>
        <Input
          id="firstName"
          label="Prénom du contact *"
          error={form.formState.errors.firstName?.message}
          {...form.register('firstName')}
        />
        <Input
          id="lastName"
          label="Nom du contact *"
          error={form.formState.errors.lastName?.message}
          {...form.register('lastName')}
        />
        <Input
          id="email"
          label="Email professionnel *"
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          id="password"
          label="Mot de passe *"
          type="password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Button
          variant="dark"
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Création…' : 'Créer le compte employeur'}
        </Button>
      </form>
    </AuthShell>
  );
}
