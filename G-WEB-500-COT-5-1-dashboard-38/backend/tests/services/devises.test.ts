import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchDevisesHistory, fetchDevisesRate } from "@/server/services/devises/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("devises fetchers", () => {
  it("fetchDevisesRate resolves via EUR pivot on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ date: "2026-10-09", rates: { USD: 1.12 } }) })),
    );

    const res = await fetchDevisesRate({ base: "eur", target: "usd" });
    expect(res.base).toBe("EUR");
    expect(res.target).toBe("USD");
    expect(res.rate).toBe(1.12);
  });

  it("fetchDevisesRate supports pegged XOF without network", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ date: "2026-10-09", rates: {} }) }));
    vi.stubGlobal("fetch", spy);

    const res = await fetchDevisesRate({ base: "EUR", target: "XOF" });
    expect(res.rate).toBe(655.957);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchDevisesRate crosses XOF/USD through EUR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ date: "2026-10-09", rates: { USD: 1.12 } }) })),
    );

    const res = await fetchDevisesRate({ base: "XOF", target: "USD" });
    expect(res.rate).toBeCloseTo(1.12 / 655.957);
  });

  it("fetchDevisesRate returns 1 without network for identical pair", async () => {
    const spy = vi.fn(() => Promise.reject(new Error("should not fetch")));
    vi.stubGlobal("fetch", spy);

    const res = await fetchDevisesRate({ base: "EUR", target: "eur" });
    expect(res.rate).toBe(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchDevisesRate throws WidgetValidationError for bad code and unknown pair", async () => {
    await expect(fetchDevisesRate({ base: "EU", target: "USD" })).rejects.toBeInstanceOf(WidgetValidationError);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    await expect(fetchDevisesRate({ base: "EUR", target: "XXX" })).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("fetchDevisesRate maps 429 to WidgetRateLimitError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 429 })));
    await expect(fetchDevisesRate({ base: "EUR", target: "USD" })).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("fetchDevisesRate throws WidgetFetchError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("down"))),
    );
    await expect(fetchDevisesRate({ base: "EUR", target: "USD" })).rejects.toBeInstanceOf(WidgetFetchError);
  });

  it("fetchDevisesHistory returns sorted points and change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rates: { "2026-10-08": { USD: 1.1 }, "2026-10-09": { USD: 1.12 } } }),
        }),
      ),
    );

    const res = await fetchDevisesHistory({ base: "EUR", target: "USD", days: 2 });
    expect(res.points.length).toBe(2);
    expect(res.points[0].date < res.points[1].date).toBe(true);
    expect(res.currentRate).toBe(1.12);
    expect(res.changePercent).toBeCloseTo(((1.12 - 1.1) / 1.1) * 100);
  });

  it("fetchDevisesHistory draws a flat line for EUR/XOF", async () => {
    const spy = vi.fn(() => Promise.reject(new Error("should not fetch")));
    vi.stubGlobal("fetch", spy);

    const res = await fetchDevisesHistory({ base: "EUR", target: "XOF", days: 7 });
    expect(res.points.length).toBe(7);
    expect(res.currentRate).toBe(655.957);
    expect(res.changePercent).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchDevisesHistory falls back to default on NaN days", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rates: { "2026-10-08": { USD: 1.1 }, "2026-10-09": { USD: 1.12 } } }),
        }),
      ),
    );

    const res = await fetchDevisesHistory({ base: "EUR", target: "USD", days: NaN });
    expect(res.points.length).toBeGreaterThan(0);
  });
});
