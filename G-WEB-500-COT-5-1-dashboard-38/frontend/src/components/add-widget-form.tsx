"use client";

import { useState } from "react";

import { CloseIcon, PlusIcon, SpinnerIcon } from "@/components/icons";
import { RefreshRateField, WidgetParamFields } from "@/components/widget-param-fields";
import { widgetDescription, widgetLabel } from "@/lib/service-theme";
import { defaultParamValues, defaultRefreshSeconds } from "@/lib/widget-fields";
import type { WidgetInfo } from "@/types";

// Plancher par défaut si le catalogue ne précise rien ; le vrai minimum vient
// de GET /api/services (minRefreshRateSeconds, par service) et reste imposé
// côté serveur.
const FALLBACK_MIN_REFRESH_RATE_SECONDS = 5;

export interface CreatedWidgetInstance {
  id: string;
  service: string;
  widget: string;
  params: Record<string, string | number>;
  refreshRateSeconds: number;
  position: number;
}

// Ajout d'un widget au dashboard (POST /api/dashboard), depuis le catalogue du
// dashboard ou depuis /services : champs pré-remplis avec des valeurs par
// défaut raisonnables, fréquence choisie dans une liste plutôt que saisie en
// secondes.
export default function AddWidgetForm({
  service,
  widget,
  minRefreshRateSeconds = FALLBACK_MIN_REFRESH_RATE_SECONDS,
  onCancel,
  onCreated,
}: {
  service: string;
  widget: WidgetInfo;
  minRefreshRateSeconds?: number;
  onCancel: () => void;
  onCreated: (instance: CreatedWidgetInstance) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    defaultParamValues(widget.params, widget.name),
  );
  const [refreshRateSeconds, setRefreshRateSeconds] = useState(() =>
    defaultRefreshSeconds(minRefreshRateSeconds),
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
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, widget: widget.name, params, refreshRateSeconds }),
      });
      const body = (await response.json().catch(() => null)) as
        | { instance: CreatedWidgetInstance }
        | { error: string }
        | null;

      if (!response.ok) {
        setError((body && "error" in body && body.error) || "Could not add widget.");
        return;
      }
      if (body && "instance" in body) {
        onCreated(body.instance);
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
          idPrefix={`add-${service}-${widget.name}`}
          widgetName={widget.name}
          params={widget.params}
          values={values}
          onChange={update}
        />
        <RefreshRateField
          id={`add-${service}-${widget.name}-refresh`}
          value={refreshRateSeconds}
          onChange={setRefreshRateSeconds}
          minSeconds={minRefreshRateSeconds}
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
          {submitting ? <SpinnerIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
          {submitting ? "Adding…" : "Add to dashboard"}
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
