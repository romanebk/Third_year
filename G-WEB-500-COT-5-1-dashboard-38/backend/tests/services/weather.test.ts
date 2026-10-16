import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchCityCurrent, fetchCityForecast, reverseGeocodeCity } from "@/server/services/weather/fetch";
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

const GEOCODE_PARIS = { results: [{ latitude: 48.85, longitude: 2.35 }] };

const FORECAST_CURRENT = {
  current: {
    temperature_2m: 21,
    apparent_temperature: 22,
    relative_humidity_2m: 55,
    wind_speed_10m: 12,
    weather_code: 2,
    is_day: 1,
  },
  daily: { temperature_2m_max: [24], temperature_2m_min: [15] },
};

function stubWeatherApis(options: { aqiFails?: boolean; forecast?: unknown } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("geocoding-api")) return Promise.resolve(jsonResponse(GEOCODE_PARIS));
      if (url.includes("air-quality")) {
        if (options.aqiFails) return Promise.reject(new Error("down"));
        return Promise.resolve(jsonResponse({ current: { us_aqi: 42 } }));
      }
      return Promise.resolve(jsonResponse(options.forecast ?? FORECAST_CURRENT));
    }),
  );
}

describe("fetchCityCurrent", () => {
  it("rejects a missing city without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchCityCurrent({ city: "  " })).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects an unknown city as a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ results: [] }))));

    await expect(fetchCityCurrent({ city: "NowhereVille" })).rejects.toThrow("unknown city");
  });

  it("throws WidgetFetchError when geocoding is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    await expect(fetchCityCurrent({ city: "Paris" })).rejects.toBeInstanceOf(WidgetFetchError);
  });

  it("returns current conditions with details and AQI on success", async () => {
    stubWeatherApis();

    const res = await fetchCityCurrent({ city: "Paris" });
    expect(res.city).toBe("Paris");
    expect(res.temperature).toBe(21);
    expect(res.unit).toBe("celsius");
    expect(res.isDay).toBe(true);
    expect(res.apparentTemperature).toBe(22);
    expect(res.humidity).toBe(55);
    expect(res.todayMax).toBe(24);
    expect(res.todayMin).toBe(15);
  });

  it("still succeeds without AQI when the air-quality service is down", async () => {
    const spy = vi.fn((url: string) => {
      if (url.includes("geocoding-api")) return Promise.resolve(jsonResponse(GEOCODE_PARIS));
      if (url.includes("air-quality")) return Promise.reject(new Error("down"));
      return Promise.resolve(jsonResponse(FORECAST_CURRENT));
    });
    vi.stubGlobal("fetch", spy);

    const res = await fetchCityCurrent({ city: "Paris" });
    expect(res.temperature).toBe(21);
  });

  it("passes fahrenheit through to the API and the result", async () => {
    const spy = vi.fn((url: string) => {
      if (url.includes("geocoding-api")) return Promise.resolve(jsonResponse(GEOCODE_PARIS));
      if (url.includes("air-quality")) return Promise.resolve(jsonResponse({ current: { us_aqi: 10 } }));
      return Promise.resolve(jsonResponse(FORECAST_CURRENT));
    });
    vi.stubGlobal("fetch", spy);

    const res = await fetchCityCurrent({ city: "Paris", unit: "fahrenheit" });
    expect(res.unit).toBe("fahrenheit");
    const forecastUrl = spy.mock.calls.map((call) => String(call[0])).find((url) => url.includes("forecast?"));
    expect(forecastUrl).toContain("temperature_unit=fahrenheit");
  });

  it("rejects an unexpected forecast payload", async () => {
    stubWeatherApis({ forecast: { daily: {} } });

    await expect(fetchCityCurrent({ city: "Paris" })).rejects.toThrow("unexpected response");
  });
});

describe("fetchCityForecast", () => {
  const DAILY = {
    time: ["2026-10-01"],
    temperature_2m_max: [20],
    temperature_2m_min: [10],
    weather_code: [95],
    precipitation_probability_max: [30],
    relative_humidity_2m_max: [70],
    wind_speed_10m_max: [15],
    apparent_temperature_max: [21],
    surface_pressure_max: [1015],
  };
  const HOURLY = {
    time: [
      "2026-10-01T06:00",
      "2026-10-01T07:00",
      "2026-10-01T08:00",
      "2026-10-01T12:00",
      "2026-10-01T13:00",
      "2026-10-01T23:00",
    ],
    weather_code: [1, 1, 1, 2, 2, 95],
  };
  const CURRENT = { temperature_2m: 19, weather_code: 1, is_day: 1 };

  function stubForecastApis() {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("geocoding-api")) return Promise.resolve(jsonResponse(GEOCODE_PARIS));
        if (url.includes("air-quality")) return Promise.resolve(jsonResponse({ current: { us_aqi: 30 } }));
        return Promise.resolve(jsonResponse({ daily: DAILY, hourly: HOURLY, current: CURRENT }));
      }),
    );
  }

  it("rejects a missing city without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchCityForecast({ city: "" })).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("uses the dominant daytime code instead of the daily code", async () => {
    stubForecastApis();

    const res = await fetchCityForecast({ city: "Paris" });
    // Code 1 appears 3 times in daytime hours, code 2 twice, night code 95 excluded.
    expect(res.days).toHaveLength(1);
    expect(res.days[0].weatherCode).toBe(1);
    expect(res.days[0].precipitationChance).toBe(30);
    expect(res.current?.temperature).toBe(19);
    expect(res.aqi).toBe(30);
  });

  it("clamps the day count to the API range", async () => {
    const spy = vi.fn((url: string) => {
      if (url.includes("geocoding-api")) return Promise.resolve(jsonResponse(GEOCODE_PARIS));
      if (url.includes("air-quality")) return Promise.resolve(jsonResponse({}));
      return Promise.resolve(jsonResponse({ daily: { ...DAILY, time: [] }, hourly: { time: [], weather_code: [] } }));
    });
    vi.stubGlobal("fetch", spy);

    await fetchCityForecast({ city: "Paris", days: 99 });
    const forecastUrl = spy.mock.calls.map((call) => String(call[0])).find((url) => url.includes("forecast?"));
    expect(forecastUrl).toContain("forecast_days=16");
  });
});

describe("reverseGeocodeCity", () => {
  it("returns the town fallback when no city is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ address: { town: "Petiteville" } }))),
    );

    await expect(reverseGeocodeCity(48.8, 2.3)).resolves.toBe("Petiteville");
  });

  it("rejects coordinates without any usable locality", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ address: {} }))));

    await expect(reverseGeocodeCity(0, 0)).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("throws WidgetFetchError when the service is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    await expect(reverseGeocodeCity(48.8, 2.3)).rejects.toBeInstanceOf(WidgetFetchError);
  });
});
