import { useState, useCallback } from "react";
import { stockCodes } from "../constants/stockCodes";
export interface LivePriceData {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  high52: number | null;
  low52: number | null;
  dayHigh: number | null;
  dayLow: number | null;
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
    const uniqueSymbols = [...new Set(symbols)];

    await Promise.allSettled(
      uniqueSymbols.map(async (symbol) => {
        try {
          const ticker = stockCodes[symbol.toUpperCase()] ?? symbol;
          const res = await fetch(
            `http://localhost:3001/live-price/${encodeURIComponent(ticker)}`,
          );
          const data = await res.json();
          const price = data.price ?? null;
          const prev = data.previousClose ?? null;
          const change = price !== null && prev !== null ? price - prev : null;
          const changePct =
            change !== null && prev ? (change / prev) * 100 : null;
          results[symbol] = {
            symbol,
            price,
            previousClose: prev,
            change,
            changePercent: changePct,
            high52: data.high52 ?? null,
            low52: data.low52 ?? null,
            dayHigh: data.dayHigh ?? null,
            dayLow: data.dayLow ?? null,
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
            high52: null,
            low52: null,
            dayHigh: null,
            dayLow: null,
            exchange: "NSE",
            marketState: "UNKNOWN",
            error: "Failed to fetch",
          };
        }
      }),
    );

    setPrices(results);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  return { prices, loading, lastUpdated, fetchPrices };
}
