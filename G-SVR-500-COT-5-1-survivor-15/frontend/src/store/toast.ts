import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    set((s) => ({ items: [...s.items, { id, message, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
