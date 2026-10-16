import type { JSX } from "react";

import { cn } from "@/lib/utils";

export interface CryptoPriceData {
  coin: string;
  currency: string;
  price: number;
  change24hPercent: number | null;
}

export interface CryptoTopCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24hPercent: number | null;
  marketCapRank: number | null;
}

export interface CryptoTopCoinsData {
  currency: string;
  coins: CryptoTopCoin[];
}

// Sous 1 unité, les cryptos ont souvent besoin de plus de décimales pour rester
// lisibles (ex: 0.0000234) qu'un prix classique à 2 décimales.
function formatCryptoPrice(price: number): string {
  if (price >= 1) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

// crypto_price : gros chiffre + devise (même logique visuelle que
// weather_city_current) + variation 24h en vert/rouge, c'est le widget qu'on
// s'attend à voir dupliqué plusieurs fois (une instance par pièce/devise).
export function CryptoPricePreview({ data }: { data: CryptoPriceData }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
        {formatCryptoPrice(data.price)}
        <span className="ml-1.5 text-xl font-medium text-muted-foreground">
          {data.currency.toUpperCase()}
        </span>
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="truncate text-sm text-muted-foreground capitalize">{data.coin}</p>
        {data.change24hPercent !== null ? (
          <span
            className={cn(
              "shrink-0 font-mono text-xs tabular-nums",
              data.change24hPercent >= 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {data.change24hPercent >= 0 ? "+" : ""}
            {data.change24hPercent.toFixed(2)}% (24h)
          </span>
        ) : null}
      </div>
    </div>
  );
}

// crypto_top_coins : classement par capitalisation, prix + variation 24h
// colorée — même lecture qu'un classement boursier compact.
export function CryptoTopCoinsPreview({ data }: { data: CryptoTopCoinsData }): JSX.Element {
  const coins = data.coins ?? [];
  if (coins.length === 0) {
    return <p className="text-sm text-muted-foreground">No data.</p>;
  }
  return (
    <ul className="flex flex-col" aria-label="Top cryptocurrencies">
      {coins.map((coin) => (
        <li
          key={coin.id}
          className="flex items-center gap-3 border-b border-border py-2.5 first:pt-0 last:border-none last:pb-0"
        >
          <span className="w-5 flex-shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {coin.marketCapRank ?? "—"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{coin.name}</p>
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
              {coin.symbol}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-mono text-sm tabular-nums">
              {formatCryptoPrice(coin.price)} {data.currency.toUpperCase()}
            </p>
            {coin.change24hPercent !== null ? (
              <p
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  coin.change24hPercent >= 0 ? "text-emerald-500" : "text-red-500",
                )}
              >
                {coin.change24hPercent >= 0 ? "+" : ""}
                {coin.change24hPercent.toFixed(2)}%
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
