import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/cn';
import { OfferSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Tag';
import { SectorMark } from '@/components/ui/SectorIcon';
import type { OfferWithDistance } from '@/hooks/useOffers';

export function OfferList({
  offers,
  selectedId,
  hoveredId,
  loading,
  onSelect,
  onHover,
}: {
  offers: OfferWithDistance[];
  selectedId: string | null;
  hoveredId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <OfferSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!offers.length) {
    return (
      <p className="p-5 text-[14px] text-muted">
        Rien ici pour l’instant. Élargissez le rayon ?
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Liste des offres">
      {offers.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            className={cn(
              'offer flex w-full items-center gap-3.5 rounded-[18px] border border-line bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#C9D3BE] hover:shadow-soft',
              (o.id === selectedId || o.id === hoveredId) && 'border-ink shadow-soft',
            )}
            onClick={() => onSelect(o.id)}
            onMouseEnter={() => onHover(o.id)}
            onMouseLeave={() => onHover(null)}
          >
            <SectorMark sector={o.sector} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14.5px] font-bold tracking-[-0.01em]">{o.title}</b>
              <small className="block truncate text-[12.5px] text-muted">
                {o.company} · {o.sector}
              </small>
            </span>
            <span className="ml-auto flex-none">
              <Badge tone="sage">
                {o.distanceM != null ? formatDistance(o.distanceM) : '-'}
              </Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
