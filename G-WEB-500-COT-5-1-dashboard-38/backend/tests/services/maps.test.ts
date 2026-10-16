import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchMapLocation, fetchMapDistance } from "@/server/services/maps/fetch";
import { WidgetValidationError, WidgetFetchError } from "@/server/widgets/errors";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  };
}

const GEOCODE_PARIS = [{ lat: "48.8566", lon: "2.3522", display_name: "Paris, France" }];
const GEOCODE_LYON = [{ lat: "45.764", lon: "4.8357", display_name: "Lyon, France" }];

describe("fetchMapLocation", () => {
  it("rejects a missing address without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchMapLocation({ address: "  " })).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects an unknown address as a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([]))));

    await expect(fetchMapLocation({ address: "NowhereVille" })).rejects.toThrow("address not found");
  });

  it("returns coordinates with the default zoom on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(GEOCODE_PARIS))));

    const res = await fetchMapLocation({ address: "Paris" });
    expect(res.latitude).toBeCloseTo(48.8566);
    expect(res.longitude).toBeCloseTo(2.3522);
    expect(res.displayName).toBe("Paris, France");
    expect(res.zoom).toBe(14);
  });

  it("clamps the zoom to the readable range", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(GEOCODE_PARIS))));

    await expect(fetchMapLocation({ address: "Paris", zoom: 99 })).resolves.toMatchObject({
      zoom: 18,
    });
    await expect(fetchMapLocation({ address: "Paris", zoom: 0 })).resolves.toMatchObject({
      zoom: 3,
    });
  });

  it("throws WidgetFetchError when geocoding is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    await expect(fetchMapLocation({ address: "Paris" })).rejects.toBeInstanceOf(WidgetFetchError);
  });
});

describe("fetchMapDistance", () => {
  function stubDistanceApis(route: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("nominatim")) {
          return Promise.resolve(jsonResponse(url.includes("Paris") ? GEOCODE_PARIS : GEOCODE_LYON));
        }
        return Promise.resolve(jsonResponse(route));
      }),
    );
  }

  it("rejects a missing origin without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchMapDistance({ origin: "", destination: "Lyon" })).rejects.toBeInstanceOf(
      WidgetValidationError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns distance in km and duration in minutes on success", async () => {
    stubDistanceApis({ code: "Ok", routes: [{ distance: 500000, duration: 18000 }] });

    const res = await fetchMapDistance({ origin: "Paris", destination: "Lyon" });
    expect(res.distanceKm).toBe(500);
    expect(res.durationMinutes).toBe(300);
    expect(res.originDisplayName).toBe("Paris, France");
    expect(res.destinationDisplayName).toBe("Lyon, France");
  });

  it("rejects a missing route as a validation error", async () => {
    stubDistanceApis({ code: "NoRoute", routes: [] });

    await expect(fetchMapDistance({ origin: "Paris", destination: "Lyon" })).rejects.toThrow(
      "no route",
    );
  });

  it("throws WidgetFetchError when routing is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("nominatim")) return Promise.resolve(jsonResponse(GEOCODE_PARIS));
        return Promise.reject(new Error("down"));
      }),
    );

    await expect(fetchMapDistance({ origin: "Paris", destination: "Lyon" })).rejects.toThrow(
      "routing service",
    );
  });
});
