import { create } from 'zustand';

export type GeoConsent = 'unknown' | 'granted' | 'denied';

const KEY = 'cg_geo_consent';

function read(): GeoConsent {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {
    /* ignore */
  }
  return 'unknown';
}

interface ConsentState {
  geo: GeoConsent;
  setGeo: (geo: GeoConsent) => void;
}

export const useConsentStore = create<ConsentState>((set) => ({
  geo: read(),
  setGeo: (geo) => {
    try {
      localStorage.setItem(KEY, geo);
    } catch {
      /* ignore */
    }
    set({ geo });
  },
}));
