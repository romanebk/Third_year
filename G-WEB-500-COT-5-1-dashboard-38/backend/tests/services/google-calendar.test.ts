import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchUpcomingEvents, fetchTodayEvents } from "@/server/services/google-calendar/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

function event(id: string) {
  return {
    id,
    summary: `Event ${id}`,
    start: { dateTime: "2026-10-09T10:00:00Z" },
    end: { dateTime: "2026-10-09T11:00:00Z" },
    htmlLink: "https://calendar.google.com/event",
  };
}

describe("google-calendar fetchers", () => {
  it("fetchUpcomingEvents requires a linked access token", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchUpcomingEvents({}, undefined)).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetchUpcomingEvents sends a bearer token and returns events", async () => {
    const spy = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [event("1")], timeZone: "Europe/Paris" }) }),
    );
    vi.stubGlobal("fetch", spy);

    const res = await fetchUpcomingEvents({ maxItems: 5 }, "token-123");
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
    expect(new URL(url).searchParams.get("singleEvents")).toBe("true");
    expect(res.events).toHaveLength(1);
    expect(res.timeZone).toBe("Europe/Paris");
  });

  it("fetchUpcomingEvents falls back to UTC when the API omits the timezone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) })),
    );
    const res = await fetchUpcomingEvents({}, "token-123");
    expect(res.timeZone).toBe("UTC");
  });

  it("fetchTodayEvents returns today's date and events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [event("2")] }) })),
    );
    const res = await fetchTodayEvents({}, "token-123");
    expect(res.events).toHaveLength(1);
    expect(res.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("maps an expired token (401) to WidgetValidationError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 401, errors: [{ reason: "authError" }] } }),
        }),
      ),
    );
    await expect(fetchUpcomingEvents({}, "token-123")).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("maps a rate-limit error to WidgetRateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({ error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } }),
        }),
      ),
    );
    await expect(fetchUpcomingEvents({}, "token-123")).rejects.toBeInstanceOf(WidgetRateLimitError);
  });

  it("throws WidgetFetchError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(fetchUpcomingEvents({}, "token-123")).rejects.toBeInstanceOf(WidgetFetchError);
  });
});
