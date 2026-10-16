import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { formatDistance, walkMinutes } from '@/lib/geo';
import { OSM_ATTRIBUTION, TILE_OPTS, VOYAGER_URL } from '@/lib/tiles';
import { useCaughtStore } from '@/store/caught';
import { useSessionStore } from '@/store/session';
import type { Offer } from '@/types';
import type { OfferWithDistance } from '@/hooks/useOffers';
import { Tag } from '@/components/ui/Tag';

function pinLabel(offer: Offer, cls: string): string {
  const etat = cls === 'got' ? ', candidature envoyée' : cls === 'new' ? ', nouvelle offre' : '';
  return `Offre : ${offer.title}, ${offer.company}${etat}`;
}

function pinHtml(offer: Offer, cls: string): L.DivIcon {
  return L.divIcon({
    className: 'pin-wrap',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -38],
    html:
      `<div class="pin ${cls}" role="button" tabindex="0" aria-label="${pinLabel(offer, cls).replace(/"/g, '&quot;')}">` +
      `<span aria-hidden="true">${(offer.sector || '?').slice(0, 1)}</span></div>`,
  });
}

function meIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: '<div style="width:20px;height:20px;border-radius:50%;background:#1B4332;border:3px solid #fff;box-shadow:0 0 0 8px rgba(27,67,50,.22)"></div>',
  });
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [lat, lng, map]);
  return null;
}

function BBoxReporter({ onBBox }: { onBBox: (bbox: string) => void }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    const send = () => {
      const b = map.getBounds();
      const next = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
      if (next !== last.current) {
        last.current = next;
        onBBox(next);
      }
    };
    send();
    map.on('moveend', send);
    return () => {
      map.off('moveend', send);
    };
  }, [map, onBBox]);
  return null;
}

/** Décrit la carte pour les lecteurs d'écran (aucune alternative sinon, RGAA 1.1). */
function MapA11yLabel() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.setAttribute('role', 'application');
    el.setAttribute(
      'aria-label',
      "Carte des offres d'emploi à proximité. Utilisez Tab pour parcourir les offres, la liste ci-contre en propose une alternative textuelle complète.",
    );
  }, [map]);
  return null;
}

/** Recalcule la taille Leaflet quand le flex layout change. */
function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const refresh = () => map.invalidateSize({ pan: false });
    refresh();
    const ro = new ResizeObserver(() => refresh());
    ro.observe(el);
    window.addEventListener('resize', refresh);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, [map]);
  return null;
}

export interface JobMapProps {
  offers: OfferWithDistance[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onCatch: (offer: Offer) => void;
  onBBox?: (bbox: string) => void;
  me: { lat: number; lng: number };
  circleRadiusM?: number;
  catchLocked?: boolean;
  className?: string;
}

function JobMapInner({
  offers,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onCatch,
  onBBox,
  me,
  circleRadiusM = 600,
  catchLocked,
}: JobMapProps) {
  const caught = useCaughtStore((s) => s.ids);
  const user = useSessionStore((s) => s.user);
  const selected = offers.find((o) => o.id === selectedId);

  const markers = useMemo(() => {
    return offers.map((o) => {
      const isCaught = caught.includes(o.id);
      const isSel = o.id === selectedId || o.id === hoveredId;
      const cls = isCaught ? 'got' : isSel ? 'sel' : o.isNew ? 'new' : '';
      return (
        <Marker
          key={o.id}
          position={[o.lat, o.lng]}
          icon={pinHtml(o, cls)}
          eventHandlers={{
            click: () => onSelect(o.id),
            mouseover: () => onHover(o.id),
            mouseout: () => onHover(null),
            // Le pin est un <div> focusable (tabindex, aria-label posés dans pinHtml) :
            // Entrée/Espace doivent ouvrir l'offre comme un clic, pour un accès clavier réel.
            add: (e) => {
              const el = e.target.getElement?.();
              if (!el) return;
              el.addEventListener('keydown', (ev: KeyboardEvent) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onSelect(o.id);
                }
              });
            },
          }}
        >
          <Popup minWidth={230}>
            <div className="pop">
              <b className="block text-[15px] font-extrabold tracking-[-0.02em]">{o.title}</b>
              <small className="text-[12.5px] text-muted">
                {o.company} · {o.distanceM != null ? formatDistance(o.distanceM) : '-'} ·{' '}
                {o.distanceM != null ? `${walkMinutes(o.distanceM)} min à pied` : ''}
              </small>
              <div className="my-2.5 flex gap-1.5">
                {o.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
                {o.isNew ? <Tag hot>Nouveau</Tag> : null}
              </div>
              {catchLocked || !user ? (
                <a className="btn btn-lime w-full justify-center py-2.5 text-[13px]" href="/inscription">
                  Créer un compte pour postuler
                </a>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-[14px] bg-forest py-2.5 text-[13px] font-bold text-white disabled:bg-sageSoft disabled:text-muted"
                  disabled={isCaught}
                  onClick={() => onCatch(o)}
                >
                  {isCaught ? 'Candidature envoyée' : 'Postuler'}
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [caught, catchLocked, hoveredId, offers, onCatch, onHover, onSelect, selectedId, user]);

  const cluster = offers.length > 60;

  return (
    <MapContainer
      center={[me.lat, me.lng]}
      zoom={15}
      scrollWheelZoom
      zoomControl={false}
      dragging
      touchZoom
      doubleClickZoom
      boxZoom
      keyboard
      className="absolute inset-0 h-full w-full touch-none"
      attributionControl
    >
      <ZoomControl position="bottomright" />
      <TileLayer attribution={OSM_ATTRIBUTION} url={VOYAGER_URL} {...TILE_OPTS} />
      <MapA11yLabel />
      <MapResizeFix />
      {onBBox ? <BBoxReporter onBBox={onBBox} /> : null}
      {selected ? <FlyTo lat={selected.lat} lng={selected.lng} /> : null}
      <Circle
        center={[me.lat, me.lng]}
        radius={circleRadiusM}
        interactive={false}
        pathOptions={{ color: '#1B4332', weight: 1.4, fillColor: '#8FBC8F', fillOpacity: 0.14 }}
      />
      <Marker position={[me.lat, me.lng]} icon={meIcon()} zIndexOffset={1000} />
      {cluster ? (
        <MarkerClusterGroup chunkedLoading disableClusteringAtZoom={16}>
          {markers}
        </MarkerClusterGroup>
      ) : (
        markers
      )}
    </MapContainer>
  );
}

export const JobMap = memo(JobMapInner);

export function LocateButton({ onLocate }: { onLocate: () => void }) {
  const locate = useCallback(() => onLocate(), [onLocate]);
  return (
    <button type="button" className="chip geo ml-auto flex items-center gap-2" onClick={locate}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4" fill="#141715" />
        <path
          d="M12 1v4M12 19v4M1 12h4M19 12h4"
          stroke="#141715"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="9" stroke="#141715" strokeWidth="1.6" />
      </svg>
      Me localiser
    </button>
  );
}
