import { useEffect } from 'react';
import { useConsentStore } from '@/store/consent';
import { useLocationStore } from '@/store/location';

export function useGeolocation(active: boolean) {
  const granted = useConsentStore((s) => s.geo === 'granted');
  const setPosition = useLocationStore((s) => s.setPosition);
  const setWatching = useLocationStore((s) => s.setWatching);
  const setDenied = useLocationStore((s) => s.setDenied);

  useEffect(() => {
    if (!active || !granted || !navigator.geolocation) return;
    setWatching(true);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }, p.coords.accuracy);
        setDenied(false);
      },
      () => {
        setDenied(true);
        setWatching(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 4000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      setWatching(false);
    };
  }, [active, granted, setDenied, setPosition, setWatching]);
}
