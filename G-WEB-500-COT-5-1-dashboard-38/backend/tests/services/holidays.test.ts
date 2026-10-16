import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchUpcomingHolidays, fetchYearHolidays } from "@/server/services/holidays/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

function holiday(date: string, name = "Day") {
  return { date, localName: name, name, countryCode: "FR", fixed: true, global: true, types: ["Public"] };
}

describe("holidays fetchers", () => {
  it("fetchYearHolidays returns the list and echoes the country/year", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [holiday("2026-01-01")] })),
    );

    const res = await fetchYearHolidays({ country: "fr", year: 2026 }, undefined);
    expect(res.country).toBe("FR");
    expect(res.year).toBe(2026);
    expect(res.holidays).toHaveLength(1);
  });

  it("fetchYearHolidays clamps an out-of-range year to the current one", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal("fetch", spy);

    const res = await fetchYearHolidays({ country: "FR", year: 1900 }, undefined);
    expect(res.year).toBe(new Date().getFullYear());
  });

  it("fetchYearHolidays rejects an invalid country code without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchYearHolidays({ country: "France" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchUpcomingHolidays keeps only future dates and honours maxItems", async () => {
    const past = holiday("2000-01-01");
    const future1 = holiday("2999-01-01", "A");
    const future2 = holiday("2999-02-01", "B");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [past, future1, future2] })),
    );

    const res = await fetchUpcomingHolidays({ country: "FR", maxItems: 1 }, undefined);
    expect(res.holidays).toHaveLength(1);
    expect(res.holidays[0].name).toBe("A");
  });

  it("fetchUpcomingHolidays adds subdivisions=true when a region is given", async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal("fetch", spy);

    await fetchUpcomingHolidays({ country: "FR", region: "FR-idf" }, undefined);
    const calledUrl = String(spy.mock.calls[0][0]);
    expect(calledUrl).toContain("subdivisions=true");
  });

  it("fetchUpcomingHolidays rejects a malformed region", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(fetchUpcomingHolidays({ country: "FR", region: "idf" }, undefined)).rejects.toBeInstanceOf(
      WidgetValidationError,
    );
  });

  it("maps 429 to WidgetRateLimitError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 429, json: async () => ({}) })));
    await expect(fetchYearHolidays({ country: "FR" }, undefined)).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("maps 404 to WidgetValidationError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404, json: async () => ({ error: "not found" }) })));
    await expect(fetchYearHolidays({ country: "FR" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("throws WidgetFetchError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(fetchYearHolidays({ country: "FR" }, undefined)).rejects.toBeInstanceOf(WidgetFetchError);
  });
});
