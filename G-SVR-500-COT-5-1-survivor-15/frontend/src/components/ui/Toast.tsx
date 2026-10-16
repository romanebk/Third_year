import { useToastStore } from '@/store/toast';
import { cn } from '@/lib/cn';

export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto rounded-2xl px-4 py-3 text-[13.5px] font-semibold shadow-card',
            t.tone === 'success' && 'bg-sageSoft text-forest ring-1 ring-sage/40',
            t.tone === 'danger' && 'bg-danger text-white',
            t.tone === 'info' && 'bg-ink text-white',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p>{t.message}</p>
            <button type="button" className="opacity-70" onClick={() => dismiss(t.id)} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
