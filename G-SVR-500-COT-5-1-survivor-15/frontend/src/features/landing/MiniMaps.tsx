import { useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { PARIS_11 } from '@/lib/geo';
import { DARK_URL, OSM_ATTRIBUTION, TILE_OPTS, VOYAGER_URL } from '@/lib/tiles';
import { offers } from '@/mocks/data';

const TOUR = [
  [48.8558, 2.3775],
  [48.8601, 2.3712],
  [48.8534, 2.3695],
  [48.8641, 2.3714],
  [48.8512, 2.3861],
] as const;

function Tour({ coords, onTick }: { coords: readonly (readonly [number, number])[]; onTick: (i: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % coords.length;
      const c = coords[i];
      if (!c) return;
      // panTo sans animation de zoom → bien moins de tuiles annulées que flyTo
      map.panTo([c[0], c[1]], { animate: true, duration: 1.2 });
      onTick(i);
    }, 5200);
    return () => window.clearInterval(id);
  }, [coords, map, onTick]);
  return null;
}

const limeDot = L.divIcon({
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#C8E6C0;border:2px solid #14170F"></div>',
});

export function LiveMiniMap() {
  const [i, setI] = useState(0);
  const c = TOUR[i] ?? TOUR[0];
  return (
    <div>
      <div className="h-[170px] overflow-hidden rounded-card bg-[#12140f]">
        <MapContainer
          center={[48.8558, 2.3775]}
          zoom={15}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          className="h-full w-full"
        >
          <TileLayer url={DARK_URL} {...TILE_OPTS} />
          {offers.slice(0, 6).map((o) => (
            <Marker key={o.id} position={[o.lat, o.lng]} icon={limeDot} />
          ))}
          <Tour coords={TOUR} onTick={setI} />
        </MapContainer>
      </div>
      <div className="flex items-center justify-between px-1.5 pb-1 pt-2.5 text-[11.5px] text-white/70">
        <span>7 offres dans un rayon de 600 m</span>
        <span>
          {c[0].toFixed(4)}, {c[1].toFixed(4)}
        </span>
      </div>
    </div>
  );
}

function radiusBounds(lat: number, lng: number, radiusM: number): L.LatLngBounds {
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return L.latLngBounds(
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
  );
}

function FitCircle({ km }: { km: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    const bounds = radiusBounds(PARIS_11.lat, PARIS_11.lng, km * 1000).pad(0.22);
    // Premier cadrage sans animation : évite d’annuler les tuiles du zoom initial
    map.fitBounds(bounds, {
      animate: !first.current,
      duration: 0.6,
    });
    first.current = false;
  }, [km, map]);
  return null;
}

const hqIcon = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: '<div style="width:24px;height:24px;border-radius:9px;background:#141715;display:grid;place-items:center"><span style="width:7px;height:7px;border-radius:50%;background:#C8E6C0;display:block"></span></div>',
});

export function ZonePreviewMap({ km }: { km: number }) {
  return (
    <MapContainer
      center={[PARIS_11.lat, PARIS_11.lng]}
      zoom={13}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      className="absolute inset-0 h-full w-full"
    >
      <TileLayer url={VOYAGER_URL} attribution={OSM_ATTRIBUTION} {...TILE_OPTS} />
      <Circle
        center={[PARIS_11.lat, PARIS_11.lng]}
        radius={km * 1000}
        pathOptions={{ color: '#1B4332', weight: 2, fillColor: '#8FBC8F', fillOpacity: 0.22 }}
      />
      <Marker position={[PARIS_11.lat, PARIS_11.lng]} icon={hqIcon} />
      <FitCircle km={km} />
    </MapContainer>
  );
}
