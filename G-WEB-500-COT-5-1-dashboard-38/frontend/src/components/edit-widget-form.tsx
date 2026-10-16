"use client";

import { useState } from "react";

import { CloseIcon, SpinnerIcon } from "@/components/icons";
import { RefreshRateField, WidgetParamFields } from "@/components/widget-param-fields";
import { widgetDescription, widgetLabel } from "@/lib/service-theme";
import type { WidgetInfo } from "@/types";

// Plancher par défaut si le catalogue ne précise rien (cf. add-widget-form.tsx).
const FALLBACK_MIN_REFRESH_RATE_SECONDS = 5;

export interface UpdatedWidgetInstance {
  id: string;
  service: string;
  widget: string;
  params: Record<string, string | number>;
  refreshRateSeconds: number;
  position: number;
}

// Pendant de AddWidgetForm pour une instance déjà créée : mêmes champs, mais
// préremplis avec la config actuelle et PATCH /api/dashboard/[id] au lieu de
// POST /api/dashboard.
export default function EditWidgetForm({
  instanceId,
  widget,
  initialParams,
  initialRefreshRateSeconds,
  minRefreshRateSeconds = FALLBACK_MIN_REFRESH_RATE_SECONDS,
  onCancel,
  onUpdated,
}: {
  instanceId: string;
  widget: WidgetInfo;
  initialParams: Record<string, string | number>;
  initialRefreshRateSeconds: number;
  minRefreshRateSeconds?: number;
  onCancel: () => void;
  onUpdated: (instance: UpdatedWidgetInstance) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const param of widget.params) {
      const raw = initialParams[param.name];
      initial[param.name] = raw !== undefined ? String(raw) : "";
    }
    return initial;
  });
  // Une instance enregistrée sous l'ancien plancher (5 s) est relevée au
  // minimum du service : sinon la valeur ne figurerait pas dans la liste et
  // l'enregistrement serait refusé (400).
  const [refreshRateSeconds, setRefreshRateSeconds] = useState(() =>
    Math.max(initialRefreshRateSeconds, minRefreshRateSeconds),
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    const params: Record<string, string | number> = {};
    for (const param of widget.params) {
      const raw = (values[param.name] ?? "").trim();
      params[param.name] = param.type === "integer" ? Number(raw) : raw;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/dashboard/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, refreshRateSeconds }),
      });
      const body = (await response.json().catch(() => null)) as
        | { instance: UpdatedWidgetInstance }
        | { error: string }
        | null;

      if (!response.ok) {
        setError((body && "error" in body && body.error) || "Could not update widget.");
        return;
      }
      if (body && "instance" in body) {
        onUpdated(body.instance);
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">{widgetLabel(widget.name)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {widgetDescription(widget.name, widget.description)}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/[0.06] hover:text-foreground active:scale-90 min-h-[40px] min-w-[40px]"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <WidgetParamFields
          idPrefix={`edit-${instanceId}`}
          widgetName={widget.name}
          params={widget.params}
          values={values}
          onChange={update}
        />
        <RefreshRateField
          id={`edit-${instanceId}-refresh`}
          value={refreshRateSeconds}
          onChange={setRefreshRateSeconds}
          minSeconds={minRefreshRateSeconds}
          current={refreshRateSeconds}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
        >
          {submitting ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
