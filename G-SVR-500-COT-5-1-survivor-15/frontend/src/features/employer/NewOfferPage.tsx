import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PARIS_11 } from '@/lib/geo';
import { OSM_ATTRIBUTION, TILE_OPTS, VOYAGER_URL } from '@/lib/tiles';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { CONTRACTS, SECTORS, EXPERIENCE_LEVELS } from '@/types';
import type { Offer } from '@/types';
import { SectorMark } from '@/components/ui/SectorIcon';
import { useSessionStore } from '@/store/session';
import { useToastStore } from '@/store/toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  title: z.string().min(3, 'Intitulé trop court'),
  description: z.string().min(20, 'Décrivez le poste (20 caractères min)').max(2000),
  contract: z.string(),
  sector: z.string(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  salaryKind: z.enum(['brut', 'net']),
  workTime: z.string().optional(),
  experienceLevel: z.string().optional(),
  requiredSkills: z.string().optional(),
  address: z.string().min(3),
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.coerce.number().min(1).max(12),
  endsAt: z.string().min(1),
});

type Values = z.infer<typeof schema>;

const DRAFT_KEY = 'cg_offer_draft';

const pin = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: '<div style="width:24px;height:24px;border-radius:9px;background:#141715;display:grid;place-items:center"><span style="width:7px;height:7px;border-radius:50%;background:#C8E6C0;display:block"></span></div>',
});

function Recenter({ lat, lng, km }: { lat: number; lng: number; km: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    const latDelta = (km * 1000) / 111_320;
    const lngDelta = (km * 1000) / (111_320 * Math.cos((lat * Math.PI) / 180));
    map.fitBounds(
      L.latLngBounds([lat - latDelta, lng - lngDelta], [lat + latDelta, lng + lngDelta]).pad(0.2),
      { animate: !first.current },
    );
    first.current = false;
  }, [km, lat, lng, map]);
  return null;
}

export function NewOfferPage() {
  const user = useSessionStore((s) => s.user);
  const push = useToastStore((s) => s.push);
  const nav = useNavigate();
  const { id: offerId } = useParams();
  const isEdit = Boolean(offerId);

  const saved = useMemo(() => {
    if (isEdit) return null; // pas de brouillon en édition, on part des vraies données
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Values | null;
    } catch {
      return null;
    }
  }, [isEdit]);

  const offerQuery = useQuery({
    queryKey: ['offer', offerId],
    queryFn: async () => (await api.get<Offer>(`/offers/${offerId}`)).data,
    enabled: isEdit,
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: saved ?? {
      title: '',
      description: '',
      contract: 'CDI',
      sector: 'Restauration',
      salaryKind: 'net',
      address: user?.address ?? '12 rue de la Roquette, 75011 Paris',
      lat: user?.lat ?? PARIS_11.lat,
      lng: user?.lng ?? PARIS_11.lng,
      radiusKm: 3,
      endsAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    const o = offerQuery.data;
    if (!o) return;
    form.reset({
      title: o.title,
      description: o.description,
      contract: o.contract,
      sector: o.sector,
      salaryMin: o.salaryMin,
      salaryMax: o.salaryMax,
      salaryKind: o.salaryKind ?? 'net',
      workTime: o.workTime,
      experienceLevel: o.experienceLevel,
      requiredSkills: o.requiredSkills?.join(', '),
      address: o.address,
      lat: o.lat,
      lng: o.lng,
      radiusKm: o.radiusKm,
      endsAt: o.endsAt.slice(0, 10),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerQuery.data]);

  const values = form.watch();

  useEffect(() => {
    if (isEdit) return; // pas de brouillon persisté quand on édite une offre existante
    const id = window.setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    }, 400);
    return () => window.clearTimeout(id);
  }, [values, isEdit]);

  const geocode = async () => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(values.address)}`,
    );
    const json = (await res.json()) as { lat: string; lon: string }[];
    const hit = json[0];
    if (!hit) {
      push("On n'a pas trouvé cette adresse. Placez le pin à la main ?", 'danger');
      return;
    }
    form.setValue('lat', Number(hit.lat), { shouldDirty: true });
    form.setValue('lng', Number(hit.lon), { shouldDirty: true });
  };

  if (isEdit && offerQuery.isLoading) {
    return (
      <div className="px-3 py-8 text-center text-[14px] text-muted sm:px-4 md:px-7">
        Chargement de l’offre…
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-7 md:py-7">
      <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold tracking-[-0.03em]">
        {isEdit ? 'Modifier l’offre' : 'Publier une offre géolocalisée'}
      </h1>
      <p className="mt-1.5 text-[13.5px] text-muted sm:text-[14px]">
        L'offre est géolocalisée au centre de la commune renseignée, pas à l'adresse exacte.
      </p>
      <form
        className="mt-5 grid gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-2"
        onSubmit={form.handleSubmit(async (v) => {
          const payload = {
            ...v,
            tags: [v.contract],
            requiredSkills: v.requiredSkills
              ? v.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
          };
          try {
            if (isEdit) {
              await api.patch(`/offers/${offerId}`, payload);
              push('Offre mise à jour.', 'success');
            } else {
              await api.post('/offers', payload);
              sessionStorage.removeItem(DRAFT_KEY);
              push('Offre publiée, elle apparaît sur la carte sans rechargement.', 'success');
            }
            nav('/pro/offres');
          } catch (e) {
            push(e instanceof Error ? e.message : 'Enregistrement impossible.', 'danger');
          }
        })}
      >
        <div className="space-y-4">
          <Input id="title" label="Intitulé" error={form.formState.errors.title?.message} {...form.register('title')} />
          <TextArea
            id="description"
            label={`Description (${values.description?.length ?? 0} / 2000)`}
            maxLength={2000}
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select id="contract" label="Contrat" {...form.register('contract')}>
              {CONTRACTS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select id="sector" label="Secteur" {...form.register('sector')}>
              {SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input id="salaryMin" label="Salaire min" type="number" {...form.register('salaryMin')} />
            <Input id="salaryMax" label="Salaire max" type="number" {...form.register('salaryMax')} />
            <Select id="salaryKind" label="Type" {...form.register('salaryKind')}>
              <option value="brut">Brut</option>
              <option value="net">Net</option>
            </Select>
          </div>
          <Input id="workTime" label="Temps de travail" {...form.register('workTime')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="experienceLevel" label="Expérience demandée" {...form.register('experienceLevel')}>
              <option value="">Non précisé</option>
              {EXPERIENCE_LEVELS.map((lvl) => (
                <option key={lvl}>{lvl}</option>
              ))}
            </Select>
            <Input
              id="requiredSkills"
              label="Compétences recherchées (séparées par des virgules)"
              placeholder="Node.js, TypeScript, PostgreSQL"
              {...form.register('requiredSkills')}
            />
          </div>
          <Input id="address" label="Adresse" error={form.formState.errors.address?.message} {...form.register('address')} />
          <Button variant="outline" type="button" onClick={geocode}>
            Géocoder l’adresse
          </Button>
          <Input id="endsAt" label="Fin de publication" type="date" {...form.register('endsAt')} />
          <label className="field-label" htmlFor="radiusKm">
            Rayon de diffusion : {values.radiusKm} km
          </label>
          <input id="radiusKm" type="range" min={1} max={12} {...form.register('radiusKm', { valueAsNumber: true })} />
          <Button variant="lime" type="submit" className="w-full" disabled={form.formState.isSubmitting || user?.status === 'pending'}>
            {user?.status === 'pending'
              ? 'Publication bloquée (vérification 48 h)'
              : isEdit
                ? 'Enregistrer les modifications'
                : 'Publier'}
          </Button>
        </div>
        <div>
          <div className="relative h-[320px] overflow-hidden rounded-block border border-line">
            <MapContainer center={[values.lat, values.lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer attribution={OSM_ATTRIBUTION} url={VOYAGER_URL} {...TILE_OPTS} />
              <Circle
                center={[values.lat, values.lng]}
                radius={values.radiusKm * 1000}
                pathOptions={{ color: '#1B4332', fillColor: '#8FBC8F', fillOpacity: 0.22, weight: 2 }}
              />
              <Marker
                position={[values.lat, values.lng]}
                draggable
                icon={pin}
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    form.setValue('lat', ll.lat);
                    form.setValue('lng', ll.lng);
                  },
                }}
              />
              <Recenter lat={values.lat} lng={values.lng} km={values.radiusKm} />
            </MapContainer>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Pin déplaçable · {values.lat.toFixed(5)}, {values.lng.toFixed(5)}
          </p>
          <div className="mt-6 rounded-block border border-line p-5">
            <p className="text-[12px] font-bold text-muted">Aperçu candidat</p>
            <div className="mt-3 flex gap-3">
              <SectorMark sector={values.sector} size={44} />
              <div>
                <b>{values.title || 'Intitulé du poste'}</b>
                <p className="text-[13px] text-muted">{user?.companyName}</p>
                <div className="mt-2 flex gap-1">
                  <Tag>{values.contract}</Tag>
                  {values.salaryMin ? <Tag>{values.salaryMin} €</Tag> : null}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] text-muted">{values.description || 'La description apparaîtra ici.'}</p>
          </div>
        </div>
      </form>
    </div>
  );
}
