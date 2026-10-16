import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchChannelStats, fetchLatestVideos, fetchTrending } from "@/server/services/youtube/fetch";
import { WidgetValidationError, WidgetFetchError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function apiResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  };
}

const CHANNEL = {
  id: "UCxxxxxxxxxxxxxxxxxxxxxx",
  snippet: {
    title: "Some Channel",
    customUrl: "@some",
    thumbnails: { high: { url: "https://example.com/h.jpg" } },
  },
  statistics: { viewCount: "1000", subscriberCount: "50", videoCount: "10" },
  contentDetails: { relatedPlaylists: { uploads: "UUxxxxxxxxxxxxxxxxxxxxxx" } },
};

const VIDEO = {
  id: "vid1",
  snippet: {
    title: "A video",
    channelTitle: "Some Channel",
    publishedAt: "2026-10-01T00:00:00Z",
    thumbnails: { default: { url: "https://example.com/d.jpg" } },
  },
  statistics: { viewCount: "5" },
};

describe("fetchTrending", () => {
  it("rejects an invalid region without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchTrending({ region: "USA" })).rejects.toThrow("2-letter");
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a missing API key without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchTrending({ region: "FR" })).rejects.toThrow("API key is required");
    expect(spy).not.toHaveBeenCalled();
  });

  it("defaults to the FR region", async () => {
    const spy = vi.fn((_url: string) => Promise.resolve(apiResponse({ items: [] })));
    vi.stubGlobal("fetch", spy);

    const res = await fetchTrending({ apiKey: "key" });
    expect(res.region).toBe("FR");
    expect(String(spy.mock.calls[0][0])).toContain("regionCode=FR");
  });

  it("maps an exhausted quota to WidgetRateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          apiResponse(
            { error: { code: 403, message: "quota", errors: [{ reason: "quotaExceeded" }] } },
            403,
          ),
        ),
      ),
    );

    await expect(fetchTrending({ region: "FR", apiKey: "key" })).rejects.toBeInstanceOf(
      WidgetRateLimitError,
    );
  });

  it("returns mapped videos on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(apiResponse({ items: [VIDEO] }))));

    const res = await fetchTrending({ region: "us", apiKey: "key" });
    expect(res.region).toBe("US");
    expect(res.videos).toHaveLength(1);
    expect(res.videos[0]).toMatchObject({
      id: "vid1",
      url: "https://www.youtube.com/watch?v=vid1",
      views: 5,
    });
  });
});

describe("fetchChannelStats", () => {
  it("rejects a missing channel without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchChannelStats({ channel: "  ", apiKey: "key" })).rejects.toBeInstanceOf(
      WidgetValidationError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects an unknown channel as a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(apiResponse({ items: [] }))));

    await expect(fetchChannelStats({ channel: "@nobody", apiKey: "key" })).rejects.toThrow(
      "not found",
    );
  });

  it("returns counts on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(apiResponse({ items: [CHANNEL] }))));

    const res = await fetchChannelStats({ channel: "@some", apiKey: "key" });
    expect(res).toMatchObject({
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
      title: "Some Channel",
      handle: "@some",
      subscribers: 50,
      views: 1000,
      videos: 10,
    });
    expect(res.avatarUrl).toBe("https://example.com/h.jpg");
  });

  it("returns null subscribers when the channel hides them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          apiResponse({
            items: [{ ...CHANNEL, statistics: { ...CHANNEL.statistics, hiddenSubscriberCount: true } }],
          }),
        ),
      ),
    );

    const res = await fetchChannelStats({ channel: "@some", apiKey: "key" });
    expect(res.subscribers).toBeNull();
  });

  it("throws WidgetFetchError when YouTube is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    await expect(fetchChannelStats({ channel: "@some", apiKey: "key" })).rejects.toBeInstanceOf(
      WidgetFetchError,
    );
  });
});

describe("fetchLatestVideos", () => {
  it("returns an empty list when the channel has no uploads playlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(apiResponse({ items: [{ ...CHANNEL, contentDetails: {} }] })),
      ),
    );

    const res = await fetchLatestVideos({ channel: "@some", apiKey: "key" });
    expect(res.channelTitle).toBe("Some Channel");
    expect(res.videos).toEqual([]);
  });

  it("keeps the playlist order even if the details call returns another order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/channels")) return Promise.resolve(apiResponse({ items: [CHANNEL] }));
        if (url.includes("/playlistItems")) {
          return Promise.resolve(
            apiResponse({ items: [{ contentDetails: { videoId: "v2" } }, { contentDetails: { videoId: "v1" } }] }),
          );
        }
        return Promise.resolve(
          apiResponse({
            items: [
              { ...VIDEO, id: "v1", snippet: { ...VIDEO.snippet, title: "First" } },
              { ...VIDEO, id: "v2", snippet: { ...VIDEO.snippet, title: "Second" } },
            ],
          }),
        );
      }),
    );

    const res = await fetchLatestVideos({ channel: "@some", apiKey: "key" });
    expect(res.videos.map((video) => video.id)).toEqual(["v2", "v1"]);
  });
});
