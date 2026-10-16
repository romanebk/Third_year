import { create } from 'zustand';
import { PARIS_11 } from '@/lib/geo';
import type { LatLng } from '@/types';

interface LocationState {
  position: LatLng;
  accuracy: number | null;
  watching: boolean;
  denied: boolean;
  setPosition: (position: LatLng, accuracy?: number | null) => void;
  setWatching: (watching: boolean) => void;
  setDenied: (denied: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  position: PARIS_11,
  accuracy: null,
  watching: false,
  denied: false,
  setPosition: (position, accuracy = null) => set({ position, accuracy }),
  setWatching: (watching) => set({ watching }),
  setDenied: (denied) => set({ denied }),
}));
