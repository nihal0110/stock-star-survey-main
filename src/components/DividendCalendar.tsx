import { useMemo, useState } from "react";
import { DividendEntry } from "@/types/investment";
import { Gift, TrendingUp, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/common/StatCard";

interface Props {
  dividendEntries: DividendEntry[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DividendCalendar({ dividendEntries }: Props) {
  const years = useMemo(() => {
    const set = new Set(dividendEntries.map((d) => new Date(d.date).getFullYear()));
    const arr = Array.from(set).sort((a, b) => b - a);
    if (arr.length === 0) arr.push(new Date().getFullYear());
    return arr;
  }, [dividendEntries]);

  const [selectedYear, setSelectedYear] = useState(() => years[0]);

  // Keep year in sync when entries change
  const currentYear = years.includes(selectedYear) ? selectedYear : years[0];

  const byMonth = useMemo(() => {
    const map: Record<number, DividendEntry[]> = {};
    for (let m = 0; m < 12; m++) map[m] = [];
    dividendEntries
      .filter((d) => new Date(d.date).getFullYear() === currentYear)
      .forEach((d) => {
        const m = new Date(d.date).getMonth();
        map[m].push(d);
      });
    return map;
  }, [dividendEntries, currentYear]);

  const yearTotal = useMemo(
    () => Object.values(byMonth).flat().reduce((s, d) => s + d.amount, 0),
    [byMonth],
  );

  const monthlyAvg = yearTotal > 0 ? yearTotal / 12 : 0;

  // Projection: average of last 12 months (rolling, not calendar year)
  const projected = useMemo(() => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const last12 = dividendEntries.filter((d) => new Date(d.date) >= cutoff);
    return last12.reduce((s, d) => s + d.amount, 0);
  }, [dividendEntries]);

  // Cumulative running total across all years for the chart
  const cumulativeData = useMemo(() => {
    const sorted = [...dividendEntries].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((d) => {
      running += d.amount;
      return { date: d.date, amount: d.amount, running, stock: d.stockName };
    });
  }, [dividendEntries]);

  const allTimeTotal = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].running : 0;

  // Per-stock totals for the year
  const stockTotals = useMemo(() => {
    const map: Record<string, number> = {};
    Object.values(byMonth).flat().forEach((d) => {
      map[d.stockName] = (map[d.stockName] ?? 0) + d.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [byMonth]);

  if (dividendEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Gift className="h-12 w-12 mb-4 opacity-30" />
        <p>No dividend entries yet. Add dividends to see the calendar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + year nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Dividend Calendar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Passive income across time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon"
            onClick={() => {
              const idx = years.indexOf(currentYear);
              if (idx < years.length - 1) setSelectedYear(years[idx + 1]);
            }}
            disabled={years.indexOf(currentYear) >= years.length - 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono font-semibold text-primary w-12 text-center">{currentYear}</span>
          <Button
            variant="outline" size="icon"
            onClick={() => {
              const idx = years.indexOf(currentYear);
              if (idx > 0) setSelectedYear(years[idx - 1]);
            }}
            disabled={years.indexOf(currentYear) <= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`${currentYear} Total`} value={`₹${fmt(yearTotal)}`} valueClass="text-green-500" borderClass="border-green-500/30" />
        <StatCard label="Monthly Avg" value={`₹${fmt(monthlyAvg)}`} sub={`${currentYear}`} />
        <StatCard label="Next 12M Projection" value={`₹${fmt(projected)}`} sub="based on last 12 months" icon={<TrendingUp className="h-3 w-3" />} />
        <StatCard label="All-Time Total" value={`₹${fmt(allTimeTotal)}`} sub={`${dividendEntries.length} payments`} icon={<Calendar className="h-3 w-3" />} />
      </div>

      {/* Monthly grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {MONTHS.map((month, mi) => {
          const entries = byMonth[mi];
          const total = entries.reduce((s, d) => s + d.amount, 0);
          const isCurrentMonth =
            mi === new Date().getMonth() && currentYear === new Date().getFullYear();

          return (
            <div
              key={month}
              className={`rounded-lg border p-3 space-y-2 transition-colors ${
                total > 0
                  ? "border-green-500/40 bg-green-500/5"
                  : isCurrentMonth
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-secondary/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                  {SHORT_MONTHS[mi]}
                </span>
                {total > 0 && (
                  <span className="text-xs font-mono font-semibold text-green-500">
                    +₹{fmt(total)}
                  </span>
                )}
              </div>

              {entries.length > 0 ? (
                <div className="space-y-1">
                  {entries
                    .sort((a, b) => b.amount - a.amount)
                    .map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-1">
                        <span className="text-xs font-mono text-primary truncate">{d.stockName}</span>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">₹{fmt(d.amount)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/40 italic">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-stock breakdown + heat bar */}
      {stockTotals.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary border-b border-border">
            <h3 className="text-sm font-semibold">
              Top Dividend Payers — {currentYear}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {stockTotals.map(([stock, total]) => {
              const pct = yearTotal > 0 ? (total / yearTotal) * 100 : 0;
              return (
                <div key={stock} className="px-4 py-3 flex items-center gap-3">
                  <span className="font-mono font-semibold text-primary w-28 shrink-0">{stock}</span>
                  <div className="flex-1 relative h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-green-500/70 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                  <span className="font-mono text-sm w-24 text-right shrink-0 text-green-500">
                    ₹{fmt(total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Running total timeline */}
      {cumulativeData.length > 1 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cumulative Dividend Income</h3>
            <span className="text-sm font-mono font-semibold text-green-500">₹{fmt(allTimeTotal)}</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <div className="flex items-end gap-1 h-24 min-w-max">
              {cumulativeData.map((d, i) => {
                const barH = allTimeTotal > 0 ? (d.running / allTimeTotal) * 100 : 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 group relative" style={{ minWidth: 12 }}>
                    <div
                      className="w-3 bg-green-500/60 rounded-t-sm group-hover:bg-green-500 transition-colors cursor-default"
                      style={{ height: `${barH}%` }}
                      title={`${d.date}: +₹${fmt(d.amount)} from ${d.stock} (total ₹${fmt(d.running)})`}
                    />
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-1 text-xs font-mono whitespace-nowrap hidden group-hover:block z-10 shadow-md">
                      {d.date}<br />
                      <span className="text-primary">{d.stock}</span> +₹{fmt(d.amount)}<br />
                      Total: ₹{fmt(d.running)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
