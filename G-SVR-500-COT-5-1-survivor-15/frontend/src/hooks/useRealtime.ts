import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistance, haversine } from '@/lib/geo';
import { realtime } from '@/lib/socket';
import { useLocationStore } from '@/store/location';
import { useToastStore } from '@/store/toast';
import type { Offer } from '@/types';

export function useRealtimeOffers() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const position = useLocationStore((s) => s.position);

  useEffect(() => {
    const onCreated = (offer: unknown) => {
      const o = offer as Offer;
      qc.invalidateQueries({ queryKey: ['offers'] });
      const d = haversine(position, { lat: o.lat, lng: o.lng });
      push(`Nouvelle offre à ${formatDistance(d)} : ${o.title}`, 'success');
    };
    const onUpdated = () => qc.invalidateQueries({ queryKey: ['offers'] });
    const onRemoved = () => qc.invalidateQueries({ queryKey: ['offers'] });
    const onApp = () => qc.invalidateQueries({ queryKey: ['applications'] });
    realtime.on('offer:created', onCreated);
    realtime.on('offer:updated', onUpdated);
    realtime.on('offer:removed', onRemoved);
    realtime.on('application:status', onApp);
    return () => {
      realtime.off('offer:created', onCreated);
      realtime.off('offer:updated', onUpdated);
      realtime.off('offer:removed', onRemoved);
      realtime.off('application:status', onApp);
    };
  }, [position, push, qc]);
}
