import { cn } from '@/lib/cn';

export function Stepper({
  step,
  total,
  labels,
}: {
  step: number;
  total: number;
  labels: string[];
}) {
  return (
    <ol className="mb-8 flex gap-2" aria-label="Progression">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const current = n === step;
        const done = n < step;
        return (
          <li key={n} className="flex-1">
            <div
              className={cn(
                'h-1.5 rounded-full',
                done || current ? 'bg-success' : 'bg-line',
              )}
            />
            <p
              className={cn(
                'mt-2 text-[11.5px] font-semibold',
                current ? 'text-ink' : 'text-muted',
              )}
            >
              {n}. {labels[i]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
