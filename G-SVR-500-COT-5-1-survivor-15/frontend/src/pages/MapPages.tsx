import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { JobMap } from '@/components/map/JobMap';
import { OfferList } from '@/components/map/OfferList';
import { CitySearchFallback } from '@/components/map/CitySearchFallback';
import { Brand } from '@/components/layout/Brand';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useOffer, useOffers, type OfferWithDistance } from '@/hooks/useOffers';
import { useRealtimeOffers } from '@/hooks/useRealtime';
import { useConsentStore } from '@/store/consent';
import { useLocationStore } from '@/store/location';
import { useSessionStore } from '@/store/session';
import { useCaughtStore } from '@/store/caught';
import { CONTRACTS, SECTORS, type ContractType, type Offer, type Sector } from '@/types';
import { ApplicationModal } from '@/features/candidate/ApplicationModal';
import { OfferDetailModal } from '@/features/offers/OfferDetailModal';
import { cn } from '@/lib/cn';

export function MapExperience({ mode }: { mode: 'public' | 'app' }) {
  const user = useSessionStore((s) => s.user);
  const setPending = useSessionStore((s) => s.setPendingAction);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useLocationStore((s) => s.position);
  const setPosition = useLocationStore((s) => s.setPosition);
  const granted = useConsentStore((s) => s.geo === 'granted');
  const denied = useConsentStore((s) => s.geo === 'denied');
  useGeolocation(granted);
  useRealtimeOffers();

  const [bbox, setBbox] = useState<string>();
  const [selectedId, setSelectedId] = useState<string | null>(
    params.get('postuler') ?? params.get('offre'),
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(params.get('offre'));
  const [catchTarget, setCatchTarget] = useState<Offer | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const filters = {
    q: params.get('q') ?? undefined,
    contract: (params.get('contract') as ContractType | null) ?? undefined,
    sector: (params.get('sector') as Sector | null) ?? undefined,
    onlyNew: params.get('new') === '1',
    radius: params.get('radius') ? Number(params.get('radius')) : undefined,
  };

  const locked = mode === 'public' && !user;
  const query = useOffers({
    bbox,
    lat: me.lat,
    lng: me.lng,
    filters: locked ? undefined : filters,
  });
  const offers = query.data ?? [];

  const near = offers.filter((o) => (o.distanceM ?? 9999) <= 600).length;
  const neu = offers.filter((o) => o.isNew).length;
  const caught = useCaughtStore((s) => s.ids);

  const onCatch = useCallback(
    (offer: Offer) => {
      if (!user) {
        setPending({ type: 'apply', offerId: offer.id });
        nav(`/connexion?redirect=${encodeURIComponent(`/app/carte?postuler=${offer.id}`)}`);
        return;
      }
      setCatchTarget(offer);
    },
    [nav, setPending, user],
  );

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setDetailId(id);
  }, []);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const chips = useMemo(
    () => [
      { k: 'all', label: 'Toutes', n: offers.length, active: !filters.onlyNew && !filters.contract },
      { k: 'near', label: 'Moins de 600 m', n: near, active: filters.radius === 0.6 },
      { k: 'new', label: 'Nouvelles', n: neu, active: filters.onlyNew },
      { k: 'got', label: 'Postulées', n: caught.length, active: false },
    ],
    [caught.length, filters.contract, filters.onlyNew, filters.radius, near, neu, offers.length],
  );

  return (
    <div
      className={
        mode === 'public' ? 'h-svh overflow-hidden bg-paper' : 'flex min-h-0 flex-1 flex-col'
      }
    >
      <div
        className={
          mode === 'public'
            ? 'flex h-full flex-col overflow-hidden bg-paper'
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        {mode === 'public' ? (
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:px-6">
            <Brand />
            <span className="hidden text-[11px] text-muted sm:inline">
              Démonstrateur technique, ne constitue pas un service public en exploitation.
            </span>
            <Link
              to="/connexion"
              className="ml-auto text-[12.5px] font-semibold sm:text-[13.5px]"
            >
              Se connecter
            </Link>
            <Link to="/inscription" className="btn btn-lime px-3 py-2 text-[12.5px] sm:text-[13.5px]">
              Créer un compte
            </Link>
          </header>
        ) : null}

        <div
          className={cn(
            'grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)] lg:grid-rows-1',
            listOpen
              ? 'grid-rows-[minmax(0,1fr)_minmax(200px,42vh)]'
              : 'grid-rows-1',
          )}
        >
          <div className="relative min-h-0 overflow-hidden bg-grey">
            <JobMap
              offers={offers as OfferWithDistance[]}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={openDetail}
              onHover={setHoveredId}
              onCatch={onCatch}
              onBBox={setBbox}
              me={me}
              catchLocked={locked}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] p-2.5 sm:p-3.5">
              {denied ? (
                <div className="pointer-events-none mb-2 max-w-[360px]">
                  <CitySearchFallback />
                </div>
              ) : null}
              <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2">
                {chips.map((c) => (
                  <button
                    key={c.k}
                    type="button"
                    className="chip pointer-events-auto px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]"
                    aria-pressed={c.active}
                    onClick={() => {
                      if (c.k === 'new') setParam('new', filters.onlyNew ? null : '1');
                      if (c.k === 'near') setParam('radius', filters.radius === 0.6 ? null : '0.6');
                      if (c.k === 'all') {
                        setParam('new', null);
                        setParam('radius', null);
                      }
                    }}
                  >
                    <span className="sm:hidden">{c.k === 'near' ? '<600m' : c.label}</span>
                    <span className="hidden sm:inline">{c.label}</span> <b>{c.n}</b>
                  </button>
                ))}
                <div className="pointer-events-auto ml-auto flex flex-wrap gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    className="chip px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]"
                    onClick={() => {
                      if (!navigator.geolocation) return;
                      navigator.geolocation.getCurrentPosition((p) =>
                        setPosition(
                          { lat: p.coords.latitude, lng: p.coords.longitude },
                          p.coords.accuracy,
                        ),
                      );
                    }}
                  >
                    Me localiser
                  </button>
                  {mode === 'app' ? (
                    <button
                      type="button"
                      className={cn(
                        'chip px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]',
                        filtersOpen && 'border-ink bg-ink text-white',
                      )}
                      onClick={() => setFiltersOpen((v) => !v)}
                    >
                      Filtres
                    </button>
                  ) : (
                    <span className="chip hidden opacity-70 sm:inline">Filtres verrouillés</span>
                  )}
                </div>
              </div>
              {mode === 'app' && filtersOpen ? (
                <form
                  className="pointer-events-auto mt-2.5 grid gap-2 rounded-[18px] border border-line bg-white/95 p-3 shadow-soft backdrop-blur sm:grid-cols-3"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <input
                    className="field-input"
                    placeholder="Mots-clés"
                    defaultValue={filters.q}
                    onBlur={(e) => setParam('q', e.target.value || null)}
                  />
                  <select
                    className="field-input"
                    value={filters.sector ?? ''}
                    onChange={(e) => setParam('sector', e.target.value || null)}
                  >
                    <option value="">Tous les secteurs</option>
                    {SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    className="field-input"
                    value={filters.contract ?? ''}
                    onChange={(e) => setParam('contract', e.target.value || null)}
                  >
                    <option value="">Tous les contrats</option>
                    {CONTRACTS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </form>
              ) : null}
            </div>

            <button
              type="button"
              className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-[600] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white shadow-card lg:bottom-4 lg:hidden"
              onClick={() => setListOpen((v) => !v)}
            >
              {listOpen ? 'Masquer la liste' : `Liste · ${offers.length}`}
            </button>
          </div>

          <aside
            className={cn(
              'min-h-0 flex-col border-t border-line bg-paper lg:flex lg:border-l lg:border-t-0',
              listOpen ? 'flex' : 'hidden',
            )}
          >
            <div className="shrink-0 border-b border-line px-4 py-3.5">
              <p className="text-[14px] font-extrabold tracking-[-0.02em]">Offres autour de vous</p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {query.isLoading
                  ? 'Chargement…'
                  : `${offers.length} résultat${offers.length === 1 ? '' : 's'} sur la carte`}
              </p>
              {locked ? (
                <p className="mt-2 text-[12px] text-muted">
                  Mode découverte, filtres réservés aux inscrits.
                </p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <OfferList
                offers={offers}
                selectedId={selectedId}
                hoveredId={hoveredId}
                loading={query.isLoading}
                onSelect={openDetail}
                onHover={setHoveredId}
              />
            </div>
          </aside>
        </div>
      </div>
      {detailId ? (
        <OfferDetailModal
          offerId={detailId}
          onClose={() => setDetailId(null)}
          onCatch={onCatch}
        />
      ) : null}
      {catchTarget ? (
        <ApplicationModal offer={catchTarget} onClose={() => setCatchTarget(null)} />
      ) : null}
    </div>
  );
}

export function PublicMapPage() {
  return <MapExperience mode="public" />;
}

export function AppMapPage() {
  const [params] = useSearchParams();
  const pending = params.get('postuler');
  return (
    <>
      {pending ? <AutoApply offerId={pending} /> : null}
      <MapExperience mode="app" />
    </>
  );
}

/** Ouvre directement le formulaire de candidature après une redirection connexion → carte. */
function AutoApply({ offerId }: { offerId: string }) {
  const { data: offer } = useOffer(offerId);
  const [closed, setClosed] = useState(false);
  if (!offer || closed) return null;
  return <ApplicationModal offer={offer} onClose={() => setClosed(true)} />;
}
