import type { CSSProperties } from "react";

export const EXPENSE_YEAR = "2026";

export const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export const ALL_MONTHS = Array.from(
  { length: 12 },
  (_, i) => `${EXPENSE_YEAR}-${String(i + 1).padStart(2, "0")}`,
);

/** Full ₹1,23,456.78 or short ₹1.2L / ₹12.3K */
export function fmtInr(n: number, short = false): string {
  if (!n && n !== 0) return "—";
  if (short) {
    if (Math.abs(n) >= 100_000) return "₹" + (n / 100_000).toFixed(1) + "L";
    if (Math.abs(n) >= 1_000)   return "₹" + (n / 1_000).toFixed(1) + "K";
    return "₹" + n.toFixed(0);
  }
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2026-01" → "Jan 2026" (or "Jan" when short=true) */
export function monthLabel(m: string, short = false): string {
  const [y, mo] = m.split("-");
  const name = MONTH_NAMES[parseInt(mo) - 1];
  return short ? name : `${name} ${y}`;
}

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
};
