import { useEffect, useState } from 'react';
import { realtime } from '@/lib/socket';

export function ReconnectBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    realtime.on('disconnect', onOff);
    realtime.on('connect', onOn);
    return () => {
      realtime.off('disconnect', onOff);
      realtime.off('connect', onOn);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 top-3 z-[85] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-white"
    >
      Connexion perdue, tentative de reconnexion…
    </div>
  );
}
