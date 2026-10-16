import { LayoutGridIcon, PlusIcon, RefreshIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const toolbarButtonClass =
  "flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-foreground/90 backdrop-blur transition-[background-color,border-color,transform] duration-150 ease-out hover:border-white/[0.16] hover:bg-white/[0.07] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]";

const addButtonClass =
  "flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#EC4899] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)] transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-110 hover:shadow-[0_10px_28px_-8px_rgba(139,92,246,0.9)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]";

interface DashboardHeaderProps {
  greeting: string;
  username: string | null;
  panelsLoaded: boolean;
  panelCount: number;
  serviceCount: number;
  editing: boolean;
  onResetLayout: () => void;
  onRefresh: () => void;
  onToggleEditing: () => void;
  onAdd: () => void;
}

// En-tête du dashboard : halos décoratifs, titre (nom d'utilisateur),
// compteur live et barre d'outils (refresh, édition du layout, ajout).
export function DashboardHeader({
  greeting,
  username,
  panelsLoaded,
  panelCount,
  serviceCount,
  editing,
  onResetLayout,
  onRefresh,
  onToggleEditing,
  onAdd,
}: DashboardHeaderProps) {
  return (
    <>
      {/* Halos de couleur derrière l'en-tête : donnent de la profondeur au fond
          noir sans gêner la lecture (décoratifs, hors flux, non interactifs). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-[420px] overflow-hidden">
        <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#6366F1]/20 blur-[110px]" />
        <div className="absolute left-1/3 -top-32 size-[380px] rounded-full bg-[#22D3EE]/10 blur-[120px]" />
        <div className="absolute -right-16 -top-10 size-[340px] rounded-full bg-[#F472B6]/10 blur-[120px]" />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="mt-0.5 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{username ?? "Your dashboard"}</h1>
          {panelsLoaded ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              {panelCount} {panelCount === 1 ? "widget" : "widgets"} live
              {serviceCount > 0 ? ` from ${serviceCount} ${serviceCount === 1 ? "service" : "services"}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing ? (
            <button type="button" onClick={onResetLayout} className={toolbarButtonClass}>
              Reset layout
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className={toolbarButtonClass}
            aria-label="Refresh all widgets"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={onToggleEditing}
            aria-pressed={editing}
            className={cn(
              toolbarButtonClass,
              editing && "border-white bg-white text-black hover:border-white hover:bg-white/90",
            )}
          >
            <LayoutGridIcon className="h-3.5 w-3.5" />
            {editing ? "Done" : "Edit layout"}
          </button>
          <button type="button" onClick={onAdd} className={addButtonClass}>
            <PlusIcon className="h-3.5 w-3.5" />
            Add widget
          </button>
        </div>
      </header>

      {editing ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs text-muted-foreground"
        >
          Drag cards by their handle and resize them from the bottom-right corner. Click <span className="font-medium text-foreground">Done</span> to save.
        </p>
      ) : null}
    </>
  );
}
