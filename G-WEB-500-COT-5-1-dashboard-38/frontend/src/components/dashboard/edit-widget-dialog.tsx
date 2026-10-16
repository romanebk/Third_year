"use client";

import { useRef } from "react";

import { CloseIcon } from "@/components/icons";
import EditWidgetForm, { type UpdatedWidgetInstance } from "@/components/edit-widget-form";
import { useDialogFocusTrap } from "@/components/dashboard/use-dialog-focus-trap";
import type { CustomPanel } from "@/components/dashboard/types";
import type { WidgetInfo } from "@/types";

// Pendant de AddWidgetDialog pour une instance existante : pas d'étape de choix
// de widget (on connaît déjà panel.service/panel.widget), juste le formulaire de
// reconfiguration dans le même habillage modal (focus trap, Escape, backdrop).
export function EditWidgetDialog({
  panel,
  widget,
  minRefreshRateSeconds,
  onClose,
  onUpdated,
}: {
  panel: CustomPanel | null;
  widget: WidgetInfo | undefined;
  minRefreshRateSeconds: number | undefined;
  onClose: () => void;
  onUpdated: (instance: UpdatedWidgetInstance) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = panel !== null;

  useDialogFocusTrap(open, dialogRef, closeRef, onClose);

  if (!panel) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Edit widget"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-medium tracking-tight">Edit widget</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Update its configuration.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] min-w-[44px]"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {widget ? (
            <EditWidgetForm
              instanceId={panel.id}
              widget={widget}
              initialParams={panel.params}
              initialRefreshRateSeconds={panel.refreshRateSeconds}
              minRefreshRateSeconds={minRefreshRateSeconds}
              onCancel={onClose}
              onUpdated={onUpdated}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Could not load this widget&apos;s configuration.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
