import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ContractType, Sector } from '@/types';

export interface JobPreferencesState {
  sectors: Sector[];
  contracts: ContractType[];
  radiusKm: number;
  onlyNew: boolean;
  walkOnly: boolean;
  toggleSector: (sector: Sector) => void;
  toggleContract: (contract: ContractType) => void;
  setRadiusKm: (km: number) => void;
  setOnlyNew: (v: boolean) => void;
  setWalkOnly: (v: boolean) => void;
  clear: () => void;
}

const defaults = {
  sectors: [] as Sector[],
  contracts: [] as ContractType[],
  radiusKm: 2,
  onlyNew: false,
  walkOnly: false,
};

export const usePreferencesStore = create<JobPreferencesState>()(
  persist(
    (set, get) => ({
      ...defaults,
      toggleSector: (sector) => {
        const cur = get().sectors;
        set({
          sectors: cur.includes(sector) ? cur.filter((s) => s !== sector) : [...cur, sector],
        });
      },
      toggleContract: (contract) => {
        const cur = get().contracts;
        set({
          contracts: cur.includes(contract)
            ? cur.filter((c) => c !== contract)
            : [...cur, contract],
        });
      },
      setRadiusKm: (radiusKm) => set({ radiusKm }),
      setOnlyNew: (onlyNew) => set({ onlyNew }),
      setWalkOnly: (walkOnly) => set({ walkOnly }),
      clear: () => set({ ...defaults }),
    }),
    { name: 'cg_job_prefs' },
  ),
);
