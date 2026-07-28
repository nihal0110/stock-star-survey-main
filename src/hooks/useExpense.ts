import { useState, useEffect } from "react";
import { ExpenseMonth, ExpenseConfig } from "@/types/expense";

const BASE = "http://localhost:3001";

export function useExpense() {
  const [months, setMonths] = useState<ExpenseMonth[]>([]);
  const [config, setConfig] = useState<ExpenseConfig>({
    initialBalance: { investment: 0, policies: 0, family: 0, savings: 0, emergencyFund: 0, gold: 0, personalExpenses: 0 },
  });

  useEffect(() => {
    fetch(`${BASE}/expense/months`).then(r => r.json()).then(setMonths).catch(() => {});
    fetch(`${BASE}/expense/config`).then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  const saveMonth = async (month: ExpenseMonth) => {
    const existing = months.find(m => m.id === month.id);
    const method = existing ? "PUT" : "POST";
    const url = existing ? `${BASE}/expense/months/${month.id}` : `${BASE}/expense/months`;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(month) });
    const data = await res.json();
    setMonths(data.data);
  };

  const saveConfig = async (cfg: ExpenseConfig) => {
    const res = await fetch(`${BASE}/expense/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    const data = await res.json();
    setConfig(data.data);
  };

  return { months, config, saveMonth, saveConfig };
}
