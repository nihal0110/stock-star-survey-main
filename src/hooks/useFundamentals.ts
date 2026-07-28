import { useState, useEffect } from "react";
import { StockFundamental } from "@/types/investment";

export function useFundamentals() {
  const [fundamentals, setFundamentals] = useState<StockFundamental[]>([]);

  useEffect(() => {
    fetch("http://localhost:3001/fundamentals")
      .then((r) => r.json())
      .then((data) => setFundamentals(Array.isArray(data) ? data : []))
      .catch(() => setFundamentals([]));
  }, []);

  const saveFundamental = async (entry: StockFundamental) => {
    const existing = fundamentals.find((f) => f.stockName === entry.stockName);
    const method = existing ? "PUT" : "POST";
    const url = existing
      ? `http://localhost:3001/fundamentals/${existing.id}`
      : "http://localhost:3001/fundamentals";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    setFundamentals(data.data);
  };

  return { fundamentals, saveFundamental };
}
