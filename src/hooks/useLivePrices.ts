import { useState, useCallback } from "react";

export interface LivePriceData {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  exchange: string;
  marketState: string;
  error?: string;
}

export function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, LivePriceData>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setLoading(true);

    const results: Record<string, LivePriceData> = {};

    await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const res = await fetch(
            `http://localhost:3001/live-price/${encodeURIComponent(symbol)}`
          );
          const data = await res.json();

          const price = data.price ?? null;
          const previousClose = data.previousClose ?? null;
          const change = price !== null && previousClose !== null ? price - previousClose : null;
          const changePercent =
            change !== null && previousClose ? (change / previousClose) * 100 : null;

          results[symbol] = {
            symbol,
            price,
            previousClose,
            change,
            changePercent,
            exchange: data.exchange ?? "NSE",
            marketState: data.marketState ?? "UNKNOWN",
            error: data.error,
          };
        } catch {
          results[symbol] = {
            symbol,
            price: null,
            previousClose: null,
            change: null,
            changePercent: null,
            exchange: "NSE",
            marketState: "UNKNOWN",
            error: "Failed to fetch",
          };
        }
      })
    );

    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  return { prices, loading, lastUpdated, fetchPrices };
}
