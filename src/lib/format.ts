export function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n: number, showPlus = true) {
  return (showPlus && n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function daysHeld(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function cagr(invested: number, current: number, days: number) {
  if (days < 1 || invested <= 0 || current <= 0) return null;
  return (Math.pow(current / invested, 1 / (days / 365.25)) - 1) * 100;
}

export function fmtCrore(n: number | null): string {
  if (n === null || n === undefined) return "—";
  const cr = n / 1e7;
  if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)}L Cr`;
  if (cr >= 1) return `₹${Math.round(cr).toLocaleString("en-IN")} Cr`;
  return `₹${fmt(n)}`;
}
