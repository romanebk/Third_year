import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Offer, OfferFilters } from '@/types';

export interface OfferWithDistance extends Offer {
  distanceM: number | null;
}

export function useOffers(params: {
  bbox?: string;
  lat?: number;
  lng?: number;
  filters?: OfferFilters;
  enabled?: boolean;
}) {
  const { bbox, lat, lng, filters, enabled = true } = params;
  return useQuery({
    queryKey: ['offers', bbox, lat, lng, filters],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<OfferWithDistance[]>('/offers', {
        params: {
          bbox,
          lat,
          lng,
          radius: filters?.radius,
          q: filters?.q,
          contract: filters?.contract,
          sector: filters?.sector,
          new: filters?.onlyNew ? '1' : undefined,
        },
      });
      return data;
    },
  });
}

export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: ['offer', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<Offer>(`/offers/${id}`);
      return data;
    },
  });
}
