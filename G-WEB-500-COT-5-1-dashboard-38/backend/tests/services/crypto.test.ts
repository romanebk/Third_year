import { describe, it, expect, vi, afterEach } from "vitest";

import {
  fetchCryptoPrice,
  fetchCryptoTopCoins,
} from "@/server/services/crypto/fetch";
import { WidgetValidationError, WidgetFetchError } from "@/server/widgets/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("crypto fetchers", () => {
  it("fetchCryptoPrice returns price and change on success", async () => {
    const mockData = { bitcoin: { usd: 12345.67, usd_24h_change: 1.2 } };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => mockData })));

    const res = await fetchCryptoPrice({ coin: "bitcoin", currency: "usd" });
    expect(res.coin).toBe("bitcoin");
    expect(res.currency).toBe("usd");
    expect(res.price).toBe(12345.67);
    expect(res.change24hPercent).toBe(1.2);
  });

  it("fetchCryptoPrice throws WidgetValidationError for unknown coin/currency", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) })));

    await expect(fetchCryptoPrice({ coin: "unknowncoin", currency: "usd" })).rejects.toBeInstanceOf(WidgetValidationError);
  });

  it("fetchCryptoPrice throws WidgetFetchError on rate limit (429)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 429 })));

    await expect(fetchCryptoPrice({ coin: "bitcoin", currency: "usd" })).rejects.toBeInstanceOf(WidgetFetchError);
  });

  it("fetchCryptoTopCoins returns list of coins", async () => {
    const mockList = [
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        current_price: 50000,
        price_change_percentage_24h: 2.5,
        market_cap_rank: 1,
      },
      {
        id: "ethereum",
        symbol: "eth",
        name: "Ethereum",
        current_price: 4000,
        price_change_percentage_24h: -1.0,
        market_cap_rank: 2,
      },
    ];
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => mockList })));

    const res = await fetchCryptoTopCoins({ currency: "usd", limit: 2 });
    expect(res.currency).toBe("usd");
    expect(res.coins.length).toBe(2);
    expect(res.coins[0].id).toBe("bitcoin");
    expect(res.coins[1].price).toBe(4000);
  });
});
