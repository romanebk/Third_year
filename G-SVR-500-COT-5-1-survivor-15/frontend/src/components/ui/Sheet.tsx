import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Sheet({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const startY = useRef(0);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 980px)');
    const sync = () => setOpen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <section
      className={cn(
        'fixed inset-x-0 bottom-0 z-[40] rounded-t-block bg-paper shadow-card md:static md:rounded-none md:shadow-none',
        'max-h-[78vh] overflow-hidden',
      )}
      style={{ transform: `translateY(${open ? dy : 58}%)` }}
    >
      <button
        type="button"
        className="flex w-full flex-col items-center pt-2 md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onPointerDown={(e) => {
          startY.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!e.buttons) return;
          setDy(Math.max(0, ((e.clientY - startY.current) / window.innerHeight) * 100));
        }}
        onPointerUp={() => {
          setOpen(dy < 18);
          setDy(0);
        }}
      >
        <span className="mb-2 h-1.5 w-12 rounded-full bg-line" />
        <span className="sr-only">{title}</span>
      </button>
      <div className="max-h-[70vh] overflow-auto px-3 pb-6 md:max-h-none md:px-0">{children}</div>
    </section>
  );
}
