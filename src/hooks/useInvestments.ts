import { useState, useEffect } from "react";
import { InvestmentEntry, GoldEntry, DividendEntry } from "@/types/investment";

export function useInvestments() {
  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [goldEntries, setGoldEntries] = useState<GoldEntry[]>([]);
  const [dividendEntries, setDividendEntries] = useState<DividendEntry[]>([]);

  useEffect(() => {
    fetch("http://localhost:3001/stock")
      .then((r) => r.json())
      .then((d) => setEntries(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("http://localhost:3001/gold")
      .then((r) => r.json())
      .then((d) => setGoldEntries(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("http://localhost:3001/dividend")
      .then((r) => r.json())
      .then((d) => setDividendEntries(d))
      .catch(() => {});
  }, []);

  // ── Stock ──────────────────────────────────────────────────────────────────

  const addStockEntry = async (entry: Omit<InvestmentEntry, "id">) => {
    const res = await fetch("http://localhost:3001/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    const data = await res.json();
    setEntries(data.data);
  };

  const editStockEntry = async (entry: InvestmentEntry) => {
    const res = await fetch(`http://localhost:3001/stock/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    setEntries(data.data);
  };

  const deleteStockEntry = async (id: string) => {
    const res = await fetch(`http://localhost:3001/stock/${id}`, { method: "DELETE" });
    const data = await res.json();
    setEntries(data.data);
  };

  // ── Gold ───────────────────────────────────────────────────────────────────

  const addGoldEntry = async (entry: Omit<GoldEntry, "id">) => {
    const res = await fetch("http://localhost:3001/gold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    const data = await res.json();
    setGoldEntries(data.data);
  };

  const editGoldEntry = async (entry: GoldEntry) => {
    const res = await fetch(`http://localhost:3001/gold/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    setGoldEntries(data.data);
  };

  const deleteGoldEntry = async (id: string) => {
    const res = await fetch(`http://localhost:3001/gold/${id}`, { method: "DELETE" });
    const data = await res.json();
    setGoldEntries(data.data);
  };

  // ── Dividend ───────────────────────────────────────────────────────────────

  const addDividendEntry = async (entry: Omit<DividendEntry, "id">) => {
    const res = await fetch("http://localhost:3001/dividend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    const data = await res.json();
    setDividendEntries(data.data);
  };

  const editDividendEntry = async (entry: DividendEntry) => {
    const res = await fetch(`http://localhost:3001/dividend/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    setDividendEntries(data.data);
  };

  const deleteDividendEntry = async (id: string) => {
    const res = await fetch(`http://localhost:3001/dividend/${id}`, { method: "DELETE" });
    const data = await res.json();
    setDividendEntries(data.data);
  };

  // ── Import / Export ────────────────────────────────────────────────────────

  const exportData = () => {
    const data = JSON.stringify({ stocks: entries, gold: goldEntries, dividends: dividendEntries }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invest-tracker-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.stocks) setEntries(data.stocks);
        if (data.gold) setGoldEntries(data.gold);
        if (data.dividends) setDividendEntries(data.dividends);
      } catch {
        alert("Invalid file format");
      }
    };
    reader.readAsText(file);
  };

  return {
    entries,
    addStockEntry,
    editStockEntry,
    deleteStockEntry,
    goldEntries,
    addGoldEntry,
    editGoldEntry,
    deleteGoldEntry,
    dividendEntries,
    addDividendEntry,
    editDividendEntry,
    deleteDividendEntry,
    exportData,
    importData,
  };
}
