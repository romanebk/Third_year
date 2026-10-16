import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchWikiOnThisDay, fetchWikiTopRead } from "@/server/services/wikipedia/fetch";
import { WidgetValidationError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wikipedia fetchers", () => {
  it("fetchWikiOnThisDay returns bounded events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            selected: [
              { year: 1960, text: "Event one", pages: [{ title: "Page_One", content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Page_One" } } }] },
              { year: 2000, text: "Event two", pages: [] },
            ],
          }),
        }),
      ),
    );

    const res = await fetchWikiOnThisDay({ lang: "fr", maxItems: 1 });
    expect(res.lang).toBe("fr");
    expect(res.events.length).toBe(1);
    expect(res.events[0].year).toBe(1960);
  });

  it("fetchWikiOnThisDay throws WidgetValidationError for bad lang and 404", async () => {
    await expect(fetchWikiOnThisDay({ lang: "x!" })).rejects.toBeInstanceOf(WidgetValidationError);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    await expect(fetchWikiOnThisDay({ lang: "xx" })).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("fetchWikiTopRead filters special pages and bounds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            mostread: {
              date: "2026-10-09Z",
              articles: [
                { title: "Main_Page", views: 99999, rank: 1 },
                { title: "Special:Search", views: 50000, rank: 2 },
                { title: "Anne_Carson", views: 34715, rank: 4, content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Anne_Carson" } }, description: "poet", thumbnail: { source: "https://img" } },
              ],
            },
          }),
        }),
      ),
    );

    const res = await fetchWikiTopRead({ lang: "fr", maxItems: 5 });
    expect(res.articles.length).toBe(1);
    expect(res.articles[0].title).toBe("Anne Carson");
    expect(res.articles[0].views).toBe(34715);
  });

  it("fetchers map 429 to WidgetRateLimitError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 429 })));
    await expect(fetchWikiOnThisDay({ lang: "fr" })).rejects.toBeInstanceOf(WidgetRateLimitError);
    await expect(fetchWikiTopRead({ lang: "fr" })).rejects.toBeInstanceOf(WidgetRateLimitError);
  });
});
