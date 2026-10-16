import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchUnisByCountry, fetchUnisSearch } from "@/server/services/universities/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

function uni(name: string, country = "France") {
  return { name, country, alpha_two_code: "FR", "state-province": null, domains: ["x.fr"], web_pages: ["http://x.fr"] };
}

describe("universities fetchers", () => {
  it("fetchUnisByCountry returns and truncates the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [uni("A"), uni("B"), uni("C")] })),
    );

    const res = await fetchUnisByCountry({ country: "France", maxItems: 2 }, undefined);
    expect(res.country).toBe("France");
    expect(res.universities).toHaveLength(2);
  });

  it("fetchUnisByCountry rejects too short a country without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchUnisByCountry({ country: "F" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchUnisSearch sends name and country query params", async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal("fetch", spy);

    const res = await fetchUnisSearch({ name: "Sorbonne", country: "France" }, undefined);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("name=Sorbonne");
    expect(url).toContain("country=France");
    expect(res.query).toEqual({ name: "Sorbonne", country: "France" });
  });

  it("fetchUnisSearch validates a too short name", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(fetchUnisSearch({ name: "a" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("maps 429 to WidgetRateLimitError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 429, json: async () => [] })));
    await expect(fetchUnisByCountry({ country: "France" }, undefined)).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("throws WidgetFetchError on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502, json: async () => [] })));
    await expect(fetchUnisByCountry({ country: "France" }, undefined)).rejects.toBeInstanceOf(WidgetFetchError);
  });

  it("throws WidgetFetchError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(fetchUnisByCountry({ country: "France" }, undefined)).rejects.toBeInstanceOf(WidgetFetchError);
  });
});
