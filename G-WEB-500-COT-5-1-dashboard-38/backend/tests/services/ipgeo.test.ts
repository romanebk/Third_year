import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchCurrentIpgeo, fetchIpgeoLookup } from "@/server/services/ipgeo/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

const GEO = {
  ip: "8.8.8.8",
  city: "Mountain View",
  region: "California",
  region_code: "CA",
  country_name: "United States",
  country_code: "US",
  country_code_iso3: "USA",
  country_capital: "Washington",
  country_tld: ".us",
  continent_code: "NA",
  in_eu: false,
  postal: "94043",
  latitude: 37.4,
  longitude: -122.0,
  timezone: "America/Los_Angeles",
  utc_offset: "-0700",
  country_calling_code: "+1",
  currency: "USD",
  currency_name: "Dollar",
  languages: "en-US,es-US",
  country_area: 9629091,
  country_population: 331002651,
  asn: "AS15169",
  org: "GOOGLE",
};

describe("ipgeo fetchers", () => {
  it("fetchCurrentIpgeo returns the payload on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => GEO })));
    const res = await fetchCurrentIpgeo({}, undefined);
    expect(res.country_code).toBe("US");
    expect(res.city).toBe("Mountain View");
  });

  it("fetchIpgeoLookup targets the requested IP", async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => GEO }));
    vi.stubGlobal("fetch", spy);

    await fetchIpgeoLookup({ ip: "8.8.8.8" }, undefined);
    expect(String(spy.mock.calls[0][0])).toContain("/8.8.8.8/json/");
  });

  it("fetchIpgeoLookup validates the IP without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchIpgeoLookup({ ip: "not-an-ip" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
    await expect(fetchIpgeoLookup({ ip: "999.1.1.1" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("reports a rate-limited response as WidgetRateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ error: true, reason: "RateLimited" }) })),
    );
    await expect(fetchCurrentIpgeo({}, undefined)).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("reports a reserved IP as WidgetValidationError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ error: true, reason: "ReservedIPAddress" }) })),
    );
    await expect(fetchIpgeoLookup({ ip: "10.0.0.1" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("throws WidgetFetchError on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })));
    await expect(fetchCurrentIpgeo({}, undefined)).rejects.toBeInstanceOf(WidgetFetchError);
  });

  it("throws WidgetFetchError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(fetchCurrentIpgeo({}, undefined)).rejects.toBeInstanceOf(WidgetFetchError);
  });
});
