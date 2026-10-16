"use client";

import { useRef, useState } from "react";

import { CloseIcon, CloudIcon } from "@/components/icons";
import { widgetLabel } from "@/lib/service-theme";
import { SERVICE_ICONS } from "@/components/ui/service-card";
import AddWidgetForm, { type CreatedWidgetInstance } from "@/components/add-widget-form";
import { useDialogFocusTrap } from "@/components/dashboard/use-dialog-focus-trap";
import type { ServiceInfo, WidgetInfo } from "@/types";

export function AddWidgetDialog({
  open,
  onClose,
  services,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  services: ServiceInfo[];
  onAdd: (instance: CreatedWidgetInstance) => void;
}) {
  const [selected, setSelected] = useState<{ service: string; widget: WidgetInfo } | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function handleClose() {
    setSelected(null);
    onClose();
  }

  useDialogFocusTrap(open, dialogRef, closeRef, handleClose);

  if (!open) return null;

  const selectable = services.filter(
    (service) => service.widgets && service.widgets.length > 0,
  );

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add a widget"
    >
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} aria-hidden="true" />
      <div className="relative z-10 flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-medium tracking-tight">Add a widget</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selected ? "Configure it, then add it to the dashboard." : "Pick a widget to drop it on the dashboard."}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] min-w-[44px]"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {selected ? (
            <AddWidgetForm
              service={selected.service}
              widget={selected.widget}
              minRefreshRateSeconds={
                services.find((service) => service.name === selected.service)?.minRefreshRateSeconds
              }
              onCancel={() => setSelected(null)}
              onCreated={(instance) => {
                setSelected(null);
                onAdd(instance);
              }}
            />
          ) : (
            <>
              {selectable.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No widgets available.</p>
              ) : (
                selectable.map((service) => {
                  const Icon = SERVICE_ICONS[service.name] ?? CloudIcon;
                  return (
                    <section key={service.name} className="mb-5 last:mb-0">
                      <p className="mb-2 flex items-center gap-2 text-xs font-medium capitalize text-muted-foreground">
                        <Icon className="size-3.5" />
                        {service.name}
                      </p>
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {service.widgets.map((widget) => (
                          <li key={widget.name}>
                            <button
                              type="button"
                              onClick={() => setSelected({ service: service.name, widget })}
                              className="flex h-full w-full flex-col items-start gap-1 rounded-lg border border-border px-3 py-3 text-left transition-colors hover:border-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                            >
                              <span className="truncate text-sm font-medium">{widgetLabel(widget.name)}</span>
                              <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                {widget.description}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
