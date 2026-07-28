import { useState, useEffect, useCallback } from "react";
import { InvestmentEntry, GoldEntry, DividendEntry, SellEntry, HoldingData, MutualFundEntry, MfSellEntry, MfHoldingData, Target, WatchlistEntry, Goal } from "@/types/investment";

const API = "http://localhost:3001";

export function useInvestments() {
  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [goldEntries, setGoldEntries] = useState<GoldEntry[]>([]);
  const [dividendEntries, setDividendEntries] = useState<DividendEntry[]>([]);
  const [sellEntries, setSellEntries] = useState<SellEntry[]>([]);
  const [holdings, setHoldings] = useState<HoldingData[]>([]);
  const [mfEntries, setMfEntries] = useState<MutualFundEntry[]>([]);
  const [mfSellEntries, setMfSellEntries] = useState<MfSellEntry[]>([]);
  const [mfHoldings, setMfHoldings] = useState<MfHoldingData[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    fetch(`${API}/stock`).then((r) => r.json()).then(setEntries).catch(() => {});
    fetch(`${API}/gold`).then((r) => r.json()).then(setGoldEntries).catch(() => {});
    fetch(`${API}/dividend`).then((r) => r.json()).then(setDividendEntries).catch(() => {});
    fetch(`${API}/sells`).then((r) => r.json()).then(setSellEntries).catch(() => {});
    fetch(`${API}/holdings`).then((r) => r.json()).then(setHoldings).catch(() => {});
    fetch(`${API}/mf`).then((r) => r.json()).then(setMfEntries).catch(() => {});
    fetch(`${API}/mf-sells`).then((r) => r.json()).then(setMfSellEntries).catch(() => {});
    fetch(`${API}/mf-holdings`).then((r) => r.json()).then(setMfHoldings).catch(() => {});
    fetch(`${API}/targets`).then((r) => r.json()).then(setTargets).catch(() => {});
    fetch(`${API}/watchlist`).then((r) => r.json()).then(setWatchlist).catch(() => {});
    fetch(`${API}/goals`).then((r) => r.json()).then(setGoals).catch(() => {});
  }, []);

  const refreshHoldings = () =>
    fetch(`${API}/holdings`).then((r) => r.json()).then(setHoldings).catch(() => {});

  const addStockEntry = async (entry: Omit<InvestmentEntry, "id">) => {
    const res = await fetch(`${API}/stock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    setEntries((await res.json()).data);
    refreshHoldings();
  };

  const editStockEntry = async (entry: InvestmentEntry) => {
    const res = await fetch(`${API}/stock/${entry.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setEntries((await res.json()).data);
    refreshHoldings();
  };

  const deleteStockEntry = async (id: string) => {
    const res = await fetch(`${API}/stock/${id}`, { method: "DELETE" });
    setEntries((await res.json()).data);
    refreshHoldings();
  };

  const addGoldEntry = async (entry: Omit<GoldEntry, "id">) => {
    const res = await fetch(`${API}/gold`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    setGoldEntries((await res.json()).data);
  };

  const editGoldEntry = async (entry: GoldEntry) => {
    const res = await fetch(`${API}/gold/${entry.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setGoldEntries((await res.json()).data);
  };

  const deleteGoldEntry = async (id: string) => {
    const res = await fetch(`${API}/gold/${id}`, { method: "DELETE" });
    setGoldEntries((await res.json()).data);
  };

  const addSellEntry = async (entry: Omit<SellEntry, "id">) => {
    const res = await fetch(`${API}/sells`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    setSellEntries((await res.json()).data);
    fetch(`${API}/holdings`).then((r) => r.json()).then(setHoldings).catch(() => {});
  };

  const deleteSellEntry = async (id: string) => {
    const res = await fetch(`${API}/sells/${id}`, { method: "DELETE" });
    setSellEntries((await res.json()).data);
    fetch(`${API}/holdings`).then((r) => r.json()).then(setHoldings).catch(() => {});
  };

  const refreshMfHoldings = () =>
    fetch(`${API}/mf-holdings`).then((r) => r.json()).then(setMfHoldings).catch(() => {});

  const addMfEntry = async (entry: Omit<MutualFundEntry, "id">) => {
    const res = await fetch(`${API}/mf`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    setMfEntries((await res.json()).data);
    refreshMfHoldings();
  };

  const editMfEntry = async (entry: MutualFundEntry) => {
    const res = await fetch(`${API}/mf/${entry.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setMfEntries((await res.json()).data);
    refreshMfHoldings();
  };

  const deleteMfEntry = async (id: string) => {
    const res = await fetch(`${API}/mf/${id}`, { method: "DELETE" });
    setMfEntries((await res.json()).data);
    refreshMfHoldings();
  };

  const addMfSell = async (entry: Omit<MfSellEntry, "id">) => {
    const res = await fetch(`${API}/mf-sells`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    setMfSellEntries((await res.json()).data);
    refreshMfHoldings();
  };

  const deleteMfSell = async (id: string) => {
    const res = await fetch(`${API}/mf-sells/${id}`, { method: "DELETE" });
    setMfSellEntries((await res.json()).data);
    refreshMfHoldings();
  };

  const addDividendEntry = async (entry: Omit<DividendEntry, "id">) => {
    const res = await fetch(`${API}/dividend`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, id: crypto.randomUUID() }),
    });
    setDividendEntries((await res.json()).data);
  };

  const editDividendEntry = async (entry: DividendEntry) => {
    const res = await fetch(`${API}/dividend/${entry.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setDividendEntries((await res.json()).data);
  };

  const deleteDividendEntry = async (id: string) => {
    const res = await fetch(`${API}/dividend/${id}`, { method: "DELETE" });
    setDividendEntries((await res.json()).data);
  };

  const saveTarget = useCallback(async (stockName: string, price: number | null) => {
    const res = await fetch(`${API}/targets/${encodeURIComponent(stockName)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    setTargets((await res.json()).data);
  }, []);

  const addToWatchlist = async (symbol: string, note: string, sector?: string) => {
    const res = await fetch(`${API}/watchlist`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, note, sector }),
    });
    setWatchlist((await res.json()).data);
  };

  const removeFromWatchlist = async (symbol: string) => {
    const res = await fetch(`${API}/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" });
    setWatchlist((await res.json()).data);
  };

  const addGoal = async (goal: Omit<Goal, "id" | "createdAt">) => {
    const res = await fetch(`${API}/goals`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...goal, id: crypto.randomUUID(), createdAt: new Date().toISOString().split("T")[0] }),
    });
    setGoals((await res.json()).data);
  };

  const editGoal = async (goal: Goal) => {
    const res = await fetch(`${API}/goals/${goal.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goal),
    });
    setGoals((await res.json()).data);
  };

  const deleteGoal = async (id: string) => {
    const res = await fetch(`${API}/goals/${id}`, { method: "DELETE" });
    setGoals((await res.json()).data);
  };

  const exportData = () => {
    const data = JSON.stringify(
      { stocks: entries, gold: goldEntries, dividends: dividendEntries, targets },
      null, 2
    );
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
        if (data.targets) setTargets(data.targets);
      } catch {
        alert("Invalid file format");
      }
    };
    reader.readAsText(file);
  };

  return {
    entries, addStockEntry, editStockEntry, deleteStockEntry,
    goldEntries, addGoldEntry, editGoldEntry, deleteGoldEntry,
    dividendEntries, addDividendEntry, editDividendEntry, deleteDividendEntry,
    sellEntries, addSellEntry, deleteSellEntry,
    holdings,
    mfEntries, addMfEntry, editMfEntry, deleteMfEntry,
    mfSellEntries, addMfSell, deleteMfSell,
    mfHoldings,
    targets, saveTarget,
    watchlist, addToWatchlist, removeFromWatchlist,
    goals, addGoal, editGoal, deleteGoal,
    exportData,
    importData,
  };
}
