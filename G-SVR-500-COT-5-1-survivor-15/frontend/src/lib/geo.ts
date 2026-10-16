import type { LatLng } from '@/types';

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(la1) * Math.cos(la2);
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  }
  return `${meters} m`;
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 75));
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function parseBBox(raw: string | null): BBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  return { minLng, minLat, maxLng, maxLat };
}

export function inBBox(point: LatLng, box: BBox): boolean {
  return (
    point.lng >= box.minLng &&
    point.lng <= box.maxLng &&
    point.lat >= box.minLat &&
    point.lat <= box.maxLat
  );
}

export const PARIS_11: LatLng = { lat: 48.8558, lng: 2.3775 };
