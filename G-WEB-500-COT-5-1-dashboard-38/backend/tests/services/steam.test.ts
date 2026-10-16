import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchMostPlayedGames, fetchGameNews } from "@/server/services/steam/fetch";
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

const STEAM_ID = "76561198000000000";

const OWNED_GAMES = {
  response: {
    games: [
      { appid: 1, name: "Game B", playtime_2weeks: 10, playtime_forever: 100 },
      { appid: 2, name: "Game A", playtime_2weeks: 50, playtime_forever: 5 },
      { appid: 3, playtime_2weeks: 999, playtime_forever: 999 },
    ],
  },
};

describe("fetchMostPlayedGames", () => {
  it("rejects a missing steam_id without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchMostPlayedGames({ steamId: "", apiKey: "key" })).rejects.toBeInstanceOf(
      WidgetValidationError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a malformed steam_id without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchMostPlayedGames({ steamId: "not-an-id", apiKey: "key" })).rejects.toThrow(
      "17-digit",
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a missing API key without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchMostPlayedGames({ steamId: STEAM_ID })).rejects.toThrow("API key is required");
    expect(spy).not.toHaveBeenCalled();
  });

  it("maps a rejected API key to a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({}, 401))));

    await expect(fetchMostPlayedGames({ steamId: STEAM_ID, apiKey: "bad" })).rejects.toThrow(
      "rejected the API key",
    );
  });

  it("maps a 404 to a fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({}, 404))));

    await expect(fetchMostPlayedGames({ steamId: STEAM_ID, apiKey: "key" })).rejects.toBeInstanceOf(
      WidgetFetchError,
    );
  });

  it("ranks by two-week playtime for short periods and skips nameless games", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(OWNED_GAMES))));

    const res = await fetchMostPlayedGames({ steamId: STEAM_ID, apiKey: "key" });
    expect(res.source).toBe("two_weeks");
    expect(res.games.map((game) => game.name)).toEqual(["Game A", "Game B"]);
    expect(res.games[0].playtimeMinutes).toBe(50);
  });

  it("ranks by all-time playtime for long periods", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(OWNED_GAMES))));

    const res = await fetchMostPlayedGames({ steamId: STEAM_ID, periodDays: 30, apiKey: "key" });
    expect(res.source).toBe("all_time");
    expect(res.games[0].name).toBe("Game B");
    expect(res.games[0].playtimeMinutes).toBe(100);
  });

  it("rejects a private profile as a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ response: {} }))));

    await expect(fetchMostPlayedGames({ steamId: STEAM_ID, apiKey: "key" })).rejects.toThrow(
      "private",
    );
  });

  it("throws WidgetFetchError when Steam is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    await expect(fetchMostPlayedGames({ steamId: STEAM_ID, apiKey: "key" })).rejects.toBeInstanceOf(
      WidgetFetchError,
    );
  });
});

describe("fetchGameNews", () => {
  const NEWS = {
    appnews: {
      newsitems: [
        { title: "Patch notes", url: "https://example.com/patch", author: " dev ", date: 1728000000 },
        { title: "Event", date: 0 },
      ],
    },
  };

  it("rejects an invalid app_id without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchGameNews({ appId: 0 })).rejects.toBeInstanceOf(WidgetValidationError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns mapped items with ISO dates", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(NEWS))));

    const res = await fetchGameNews({ appId: 440 });
    expect(res.appId).toBe(440);
    expect(res.items).toHaveLength(2);
    expect(res.items[0].author).toBe("dev");
    expect(res.items[0].publishedAt).toBe(new Date(1728000000 * 1000).toISOString());
    expect(res.items[1].publishedAt).toBeNull();
  });

  it("throws when the app has no news", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ appnews: { newsitems: [] } }))));

    await expect(fetchGameNews({ appId: 440 })).rejects.toThrow("no news");
  });

  it("maps a 404 to a fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({}, 404))));

    await expect(fetchGameNews({ appId: 440 })).rejects.toBeInstanceOf(WidgetFetchError);
  });
});
