import { LayoutGridIcon, PlusIcon } from "@/components/icons";

// État vide : aucun widget sur le compte. Affiche l'appel à l'action vers
// l'ajout du premier widget plutôt qu'une grille vide.
export function EmptyDashboard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366F1]/30 to-[#EC4899]/30 text-white ring-1 ring-inset ring-white/10">
        <LayoutGridIcon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Your dashboard is empty</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add weather, news, crypto, YouTube and more — each widget updates on its own.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add your first widget
      </button>
    </div>
  );
}
