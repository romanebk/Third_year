import { useEffect, useState } from "react";

import { readWidgetError } from "@/lib/widget-errors";

export type FetchState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function useWidgetData<T>(url: string, key: string = "data"): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(url, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readWidgetError(response));
        }
        const json = (await response.json()) as Record<string, unknown>;
        if (!cancelled) setState({ status: "ready", data: json[key] as T });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Something went wrong.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, nonce, key]);

  return state;
}
