import { describe, it, expect, vi, afterEach } from "vitest";

const { mockSafeFetch } = vi.hoisted(() => ({ mockSafeFetch: vi.fn() }));

vi.mock("@/server/widgets/ssrf-guard", () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}));

import { fetchArticleList, fetchInterestFeed } from "@/server/services/rss/fetch";
import { WidgetValidationError, WidgetFetchError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
  mockSafeFetch.mockReset();
});

function textResponse(text: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => ({}),
    headers: { get: () => null },
  };
}

const RSS_FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Example Feed</title>
<item><title><![CDATA[First <b>story</b>]]></title><link>https://example.com/1</link><pubDate>Mon, 06 Oct 2026 10:00:00 GMT</pubDate><enclosure url="https://example.com/img.jpg" type="image/jpeg" length="1"/></item>
<item><title>Second story</title><link>https://example.com/2</link><pubDate>Tue, 07 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM_FEED = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Feed</title>
<entry><title>Entry one</title><link rel="alternate" href="https://example.com/a"/><updated>2026-10-07T10:00:00Z</updated></entry>
</feed>`;

describe("fetchArticleList", () => {
  it("rejects a missing feed_url without calling the network", async () => {
    await expect(fetchArticleList({ feedUrl: "  " })).rejects.toBeInstanceOf(WidgetValidationError);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) feed_url without calling the network", async () => {
    await expect(fetchArticleList({ feedUrl: "ftp://example.com/feed" })).rejects.toThrow("http(s)");
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it("maps a 404 to a validation error", async () => {
    mockSafeFetch.mockResolvedValue(textResponse("not found", 404));

    await expect(fetchArticleList({ feedUrl: "https://example.com/feed" })).rejects.toThrow(
      "feed not found",
    );
  });

  it("maps a 5xx to a fetch error", async () => {
    mockSafeFetch.mockResolvedValue(textResponse("error", 500));

    await expect(fetchArticleList({ feedUrl: "https://example.com/feed" })).rejects.toBeInstanceOf(
      WidgetFetchError,
    );
  });

  it("throws WidgetFetchError when the feed is unreachable", async () => {
    mockSafeFetch.mockRejectedValue(new Error("down"));

    await expect(fetchArticleList({ feedUrl: "https://example.com/feed" })).rejects.toBeInstanceOf(
      WidgetFetchError,
    );
  });

  it("parses an RSS feed with cleaned titles and images", async () => {
    mockSafeFetch.mockResolvedValue(textResponse(RSS_FEED));

    const res = await fetchArticleList({ feedUrl: "https://example.com/feed" });
    expect(res.source).toBe("rss");
    expect(res.title).toBe("Example Feed");
    expect(res.articles).toHaveLength(2);
    expect(res.articles[0].title).toBe("First story");
    expect(res.articles[0].imageUrl).toBe("https://example.com/img.jpg");
    expect(res.articles[0].publishedAt).toContain("2026-10-06");
    expect(res.feedUrl).toBe("https://example.com/feed");
  });

  it("limits articles to maxItems", async () => {
    mockSafeFetch.mockResolvedValue(textResponse(RSS_FEED));

    const res = await fetchArticleList({ feedUrl: "https://example.com/feed", maxItems: 1 });
    expect(res.articles).toHaveLength(1);
  });

  it("parses an Atom feed with alternate links", async () => {
    mockSafeFetch.mockResolvedValue(textResponse(ATOM_FEED));

    const res = await fetchArticleList({ feedUrl: "https://example.com/atom" });
    expect(res.source).toBe("atom");
    expect(res.articles).toHaveLength(1);
    expect(res.articles[0].link).toBe("https://example.com/a");
  });

  it("throws when the feed contains no article", async () => {
    mockSafeFetch.mockResolvedValue(
      textResponse(`<rss version="2.0"><channel><title>Empty</title></channel></rss>`),
    );

    await expect(fetchArticleList({ feedUrl: "https://example.com/feed" })).rejects.toThrow(
      "no article found",
    );
  });
});

describe("fetchInterestFeed", () => {
  it("merges feeds sorted by publication date descending", async () => {
    mockSafeFetch.mockImplementation((url: string) => {
      if (url.includes("theverge")) {
        return Promise.resolve(
          textResponse(
            `<rss version="2.0"><channel><title>Verge</title><item><title>Old story</title><link>https://example.com/old</link><pubDate>Mon, 01 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
          ),
        );
      }
      return Promise.resolve(
        textResponse(
          `<rss version="2.0"><channel><title>BBC</title><item><title>New story</title><link>https://example.com/new</link><pubDate>Sat, 05 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
        ),
      );
    });

    const res = await fetchInterestFeed({ interests: "technology,world" });
    expect(res.title).toBe("Your interests");
    expect(res.articles).toHaveLength(2);
    expect(res.articles[0].title).toBe("New story");
    expect(res.articles[1].title).toBe("Old story");
  });

  it("throws when no feed can be reached", async () => {
    mockSafeFetch.mockRejectedValue(new Error("down"));

    await expect(fetchInterestFeed({ interests: "technology" })).rejects.toThrow(
      "could not reach any news feed",
    );
  });
});
