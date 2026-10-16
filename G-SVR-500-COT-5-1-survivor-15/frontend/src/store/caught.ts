import { create } from 'zustand';

interface CaughtState {
  ids: string[];
  catchOffer: (id: string) => void;
  has: (id: string) => boolean;
}

export const useCaughtStore = create<CaughtState>((set, get) => ({
  ids: [],
  catchOffer: (id) => {
    if (get().ids.includes(id)) return;
    set({ ids: [...get().ids, id] });
  },
  has: (id) => get().ids.includes(id),
}));
