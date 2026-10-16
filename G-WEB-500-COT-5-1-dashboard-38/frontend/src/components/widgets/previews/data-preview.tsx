import type { JSX } from "react";

// Rendu générique récursif : objet -> paires clé/valeur, tableau -> lignes,
// primitive -> texte. Filet de secours pour un futur widget sans rendu dédié
// (cf. InstanceWidget), sans connaître sa forme exacte à l'avance.
export default function DataPreview({ value }: { value: unknown }): JSX.Element {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="text-sm text-muted-foreground">No data.</p>;
    }
    return (
      <ul className="flex flex-col gap-2">
        {value.slice(0, 8).map((item, index) => (
          <li key={index} className="rounded-md border border-border px-3 py-2 text-xs">
            <DataPreview value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <dl className="flex flex-col gap-1">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="truncate text-right text-sm font-medium">
              {typeof val === "object" && val !== null ? (
                <DataPreview value={val} />
              ) : (
                String(val)
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span className="text-sm">{String(value)}</span>;
}
