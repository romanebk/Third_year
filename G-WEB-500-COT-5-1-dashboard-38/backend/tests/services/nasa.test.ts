import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchApod, fetchApodRandom } from "@/server/services/nasa/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

const APOD = {
  date: "2026-10-09",
  title: "A title",
  explanation: "An explanation",
  url: "https://apod.nasa.gov/image.jpg",
  media_type: "image" as const,
  service_version: "v1",
};

describe("nasa fetchers", () => {
  it("fetchApod returns the payload on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => APOD })));

    const res = await fetchApod({}, undefined);
    expect(res.title).toBe("A title");
    expect(res.media_type).toBe("image");
  });

  it("fetchApod passes hd=true when hd=1 and includes the date", async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => APOD }));
    vi.stubGlobal("fetch", spy);

    await fetchApod({ date: "2020-01-01", hd: 1 }, undefined);
    const url = new URL(String(spy.mock.calls[0][0]));
    expect(url.searchParams.get("hd")).toBe("true");
    expect(url.searchParams.get("date")).toBe("2020-01-01");
    expect(url.searchParams.get("api_key")).toBe("DEMO_KEY");
  });

  it("fetchApod rejects a malformed date without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchApod({ date: "01/01/2020" }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchApod rejects a future date", async () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];
    vi.stubGlobal("fetch", vi.fn());
    await expect(fetchApod({ date: future }, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("fetchApod maps 429 to WidgetRateLimitError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 429, json: async () => ({}) })));
    await expect(fetchApod({}, undefined)).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("fetchApod reports an API rate-limit message as WidgetRateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ error: { code: 429, message: "API rate limit exceeded" } }),
        }),
      ),
    );
    await expect(fetchApod({}, undefined)).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("fetchApod maps 400 to WidgetValidationError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { code: 400, message: "bad date" } }) })),
    );
    await expect(fetchApod({}, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("fetchApod throws WidgetFetchError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(fetchApod({}, undefined)).rejects.toBeInstanceOf(WidgetFetchError);
  });

  it("fetchApodRandom requests a date within the APOD archive range", async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => APOD }));
    vi.stubGlobal("fetch", spy);

    await fetchApodRandom({}, undefined);
    const url = new URL(String(spy.mock.calls[0][0]));
    const date = url.searchParams.get("date") as string;
    expect(date >= "1995-06-16").toBe(true);
    expect(date <= new Date().toISOString().split("T")[0]).toBe(true);
  });
});
