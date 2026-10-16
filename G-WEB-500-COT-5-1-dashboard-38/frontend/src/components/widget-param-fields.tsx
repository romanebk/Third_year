"use client";

import { fieldSpec, refreshOptions } from "@/lib/widget-fields";
import type { ConfigParam } from "@/types";

// Champs de paramètres d'un widget, partagés par AddWidgetForm et
// EditWidgetForm : libellé lisible, liste de choix quand les valeurs sont
// connues, exemple et aide sous le champ (cf. lib/widget-fields.ts).

export const fieldInputClass =
  "mt-1.5 w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 hover:border-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/10 min-h-[44px]";

export function WidgetParamFields({
  idPrefix,
  widgetName,
  params,
  values,
  onChange,
}: {
  idPrefix: string;
  widgetName: string;
  params: ConfigParam[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <>
      {params.map((param) => {
        const spec = fieldSpec(param.name, param.type, widgetName);
        const id = `${idPrefix}-${param.name}`;
        const helpId = spec.help ? `${id}-help` : undefined;
        return (
          <div key={param.name}>
            <label htmlFor={id} className="text-xs font-medium text-foreground/90">
              {spec.label}
              {param.optional && !/optional/i.test(spec.label) ? " (optional)" : ""}
            </label>
            {spec.options ? (
              <select
                id={id}
                value={values[param.name] ?? spec.defaultValue ?? ""}
                onChange={(event) => onChange(param.name, event.target.value)}
                aria-describedby={helpId}
                className={`${fieldInputClass} cursor-pointer appearance-none [color-scheme:dark] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9`}
                style={{ backgroundImage: SELECT_CHEVRON }}
              >
                {spec.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={param.type === "integer" ? "number" : "text"}
                inputMode={param.type === "integer" ? "numeric" : undefined}
                min={param.type === "integer" ? (spec.min ?? 1) : undefined}
                max={param.type === "integer" ? spec.max : undefined}
                step={param.type === "integer" ? 1 : undefined}
                required={!param.optional}
                value={values[param.name] ?? ""}
                onChange={(event) => onChange(param.name, event.target.value)}
                placeholder={spec.placeholder}
                aria-describedby={helpId}
                autoComplete="off"
                className={fieldInputClass}
              />
            )}
            {spec.help ? (
              <p id={helpId} className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                {spec.help}
              </p>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function RefreshRateField({
  id,
  value,
  onChange,
  minSeconds,
  current,
}: {
  id: string;
  value: number;
  onChange: (seconds: number) => void;
  minSeconds: number;
  current?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-foreground/90">
        Update frequency
      </label>
      <select
        id={id}
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={`${id}-help`}
        className={`${fieldInputClass} cursor-pointer appearance-none [color-scheme:dark] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9`}
        style={{ backgroundImage: SELECT_CHEVRON }}
      >
        {refreshOptions(minSeconds, current).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={`${id}-help`} className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        The server refreshes this widget on its own and pushes new data live.
      </p>
    </div>
  );
}

// Chevron des <select> (appearance-none retire celui du navigateur, illisible
// sur fond sombre dans certains navigateurs).
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23a1a1aa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
