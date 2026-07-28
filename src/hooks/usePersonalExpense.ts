import { useState, useEffect } from "react";
import { PersonalExpenseMonth, PersonalCats, PERSONAL_KEYS } from "@/types/expense";

const BASE = "http://localhost:3001";

export function emptyPersonalCats(): PersonalCats {
  return Object.fromEntries(PERSONAL_KEYS.map(k => [k, 0])) as PersonalCats;
}

export function usePersonalExpense() {
  const [months, setMonths] = useState<PersonalExpenseMonth[]>([]);

  useEffect(() => {
    fetch(`${BASE}/personal-expense/months`)
      .then(r => r.json())
      .then(setMonths)
      .catch(() => {});
  }, []);

  const saveMonth = async (month: PersonalExpenseMonth) => {
    const existing = months.find(m => m.id === month.id);
    const method = existing ? "PUT" : "POST";
    const url = existing
      ? `${BASE}/personal-expense/months/${month.id}`
      : `${BASE}/personal-expense/months`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(month),
    });
    const data = await res.json();
    setMonths(data.data);
  };

  return { months, saveMonth };
}
