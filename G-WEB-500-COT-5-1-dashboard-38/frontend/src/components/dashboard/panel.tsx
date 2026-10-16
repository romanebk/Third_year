"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "@/lib/utils";
import { accentTint } from "@/lib/service-theme";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisIcon,
  GripIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/icons";

function PanelMenu({
  onConfigure,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  onConfigure?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && firstMenuItemRef.current) {
      firstMenuItemRef.current.focus();
    }
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative"
      // Sans ça, Tab depuis "Remove" (dernier item) laissait le menu affiché
      // visuellement ouvert alors que le focus était déjà ailleurs sur la
      // page — trouvé lors d'un audit d'accessibilité clavier. focusout
      // (déclenché par onBlur sur ce conteneur) atteint ce cas, contrairement
      // au mousedown déjà géré ci-dessus.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Panel actions"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] min-w-[44px]"
      >
        <EllipsisIcon className="size-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-xl"
        >
          <button
            ref={firstMenuItemRef}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onConfigure?.();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted min-h-[44px]"
          >
            <SettingsIcon className="size-3.5" aria-hidden="true" />
            Configure
          </button>
          {onMoveUp ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMoveUp();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted min-h-[44px]"
            >
              <ArrowUpIcon className="size-3.5" aria-hidden="true" />
              Move up
            </button>
          ) : null}
          {onMoveDown ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMoveDown();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted min-h-[44px]"
            >
              <ArrowDownIcon className="size-3.5" aria-hidden="true" />
              Move down
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRemove?.();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted min-h-[44px]"
          >
            <TrashIcon className="size-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  accent = "#A1A1AA",
  live,
  index = 0,
  action,
  icon,
  className,
  style,
  fill = false,
  scrollable = false,
  grip = false,
  editing = false,
  onConfigure,
  onRemove,
  onMoveUp,
  onMoveDown,
  children,
  ref,
  ...rest
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  // Intervalle de rafraîchissement lisible ("5 min") : affiché avec un point
  // pulsé, signe que la carte est alimentée en direct par le timer serveur.
  live?: string;
  // Rang d'affichage : décale l'animation d'entrée (cascade de 40 ms/carte).
  index?: number;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  fill?: boolean;
  scrollable?: boolean;
  grip?: boolean;
  editing?: boolean;
  onConfigure?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      ref={ref}
      // react-grid-layout pose son propre style (transform/width/height) : on
      // le fusionne avec les variables d'accent et le délai d'entrée.
      style={
        {
          ...style,
          "--accent": accent,
          "--accent-soft": accentTint(accent, 0.14),
          "--accent-glow": accentTint(accent, 0.22),
        } as CSSProperties
      }
      {...rest}
      className={cn(
        "dashboard-panel group/panel relative flex flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#0c0c10]/90 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-white/[0.14] hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_40px_-14px_var(--accent-glow)]",
        fill && "h-full",
        editing && "ring-1 ring-inset ring-white/25",
        className,
      )}
    >
      <div className="dashboard-panel-enter flex min-h-0 flex-1 flex-col" style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}>
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span
                className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-inset ring-white/[0.06]"
                aria-hidden="true"
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold leading-tight tracking-tight">{title}</h2>
              {subtitle || live ? (
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {subtitle ? <span className="truncate" title={subtitle}>{subtitle}</span> : null}
                  {subtitle && live ? <span aria-hidden="true">·</span> : null}
                  {live ? (
                    <span
                      className="flex shrink-0 items-center gap-1"
                      title={`Updated live every ${live}`}
                    >
                      <span className="relative flex size-1.5" aria-hidden="true">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                      </span>
                      <span className="sr-only">Live, updated every</span>
                      {live}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            {action}
            {grip ? (
              <button
                type="button"
                className="rgl-drag-handle flex size-8 cursor-grab items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground active:cursor-grabbing min-h-[44px] min-w-[44px]"
                aria-label="Drag to move panel"
                title="Drag to move"
              >
                <GripIcon className="size-4" />
              </button>
            ) : null}
            {/* Le menu reste affiché même en mode édition (pas seulement la
                poignée de drag ci-dessus) : sinon Configure/Remove devenaient
                inatteignables au clavier pendant l'édition, et il n'y avait
                aucun moyen non-souris de réordonner les panneaux — trouvé lors
                d'un audit d'accessibilité. Move up/down ne s'affiche que si
                fourni (mode édition), le drag reste l'option souris. */}
            <PanelMenu
              onConfigure={onConfigure}
              onRemove={onRemove}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          </div>
        </header>
        <div
          className={cn(
            "px-4 pb-4 pt-2 sm:px-5 sm:pb-5",
            fill && "min-h-0 flex-1",
            scrollable ? "dashboard-panel-scroll overflow-y-auto" : "overflow-hidden",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
