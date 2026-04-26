import { useState, useCallback } from "react";

const API = "http://localhost:3001";

export interface GoldPriceData {
  retail24k: number;
  retail22k: number;
  retail18k: number;
  spot24k: number;
  change: number | null;
  changePct: number | null;
  source: string;
  updatedAt: string;
}

export function useGoldPrice() {
  const [goldPrice, setGoldPrice] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoldPrice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/gold-price`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setGoldPrice(data);
    } catch {
      setError("Could not fetch gold price.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { goldPrice, loading, error, fetchGoldPrice };
}
