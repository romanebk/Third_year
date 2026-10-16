import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-grey', className)} />;
}

export function OfferSkeleton() {
  return (
    <div className="flex gap-3.5 rounded-[18px] border border-line p-3.5">
      <Skeleton className="h-11 w-11 rounded-[14px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
