import { useState, useMemo } from "react";
import { InvestmentEntry, DividendEntry } from "@/types/investment";
import { calculatePortfolio } from "@/lib/calculations";
import { fmt, daysHeld } from "@/lib/format";
import { Filter, X, CheckSquare, Square, TrendingUp, PieChart } from "lucide-react";
import { LivePriceData } from "@/hooks/useLivePrices";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries?: DividendEntry[];
  prices?: Record<string, LivePriceData>;
}

export default function FilteredPortfolio({ entries, dividendEntries = [], prices = {} }: Props) {
  const holdEntries = useMemo(() => entries.filter((e) => e.status !== "sold"), [entries]);

  // All unique stocks and sectors
  const allStocks = useMemo(
    () => [...new Set(holdEntries.map((e) => e.stockName))].sort(),
    [holdEntries],
  );
  const allSectors = useMemo(
    () => ["All", ...new Set(holdEntries.map((e) => e.sector)).values()].sort((a, b) =>
      a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b),
    ),
    [holdEntries],
  );

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [activeSector, setActiveSector] = useState("All");

  const toggle = (name: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const selectSector = (sector: string) => {
    setActiveSector(sector);
    if (sector === "All") return;
    const sectorStocks = new Set(holdEntries.filter((e) => e.sector === sector).map((e) => e.stockName));
    // Exclude everything not in this sector
    const newExcluded = new Set(allStocks.filter((s) => !sectorStocks.has(s)));
    setExcluded(newExcluded);
  };

  const selectAll = () => { setExcluded(new Set()); setActiveSector("All"); };
  const clearAll = () => setExcluded(new Set(allStocks));

  const filteredEntries = useMemo(
    () => holdEntries.filter((e) => !excluded.has(e.stockName)),
    [holdEntries, excluded],
  );
  const filteredDividends = useMemo(
    () => dividendEntries.filter((d) => !excluded.has(d.stockName)),
    [dividendEntries, excluded],
  );

  const { totalInvested: totalAll } = useMemo(() => calculatePortfolio(holdEntries, dividendEntries), [holdEntries, dividendEntries]);
  const { totalInvested, stocks, sectors, totalDividends } = useMemo(
    () => calculatePortfolio(filteredEntries, filteredDividends),
    [filteredEntries, filteredDividends],
  );

  // Sector-wise return: aggregate current value and cost per sector using live prices
  const sectorReturns = useMemo(() => {
    const map = new Map<string, { invested: number; currentValue: number; priced: boolean }>();
    for (const s of stocks) {
      const live = prices[s.stockName.trim().toUpperCase()] ?? prices[s.stockName.trim()];
      const currentPrice = live?.price ?? null;
      if (!map.has(s.sector)) map.set(s.sector, { invested: 0, currentValue: 0, priced: false });
      const r = map.get(s.sector)!;
      r.invested += s.totalAmount;
      if (currentPrice !== null && s.totalQuantity > 0) {
        r.currentValue += currentPrice * s.totalQuantity;
        r.priced = true;
      } else {
        r.currentValue += s.totalAmount; // use cost if no price
      }
    }
    return map;
  }, [stocks, prices]);

  const includedCount = allStocks.length - excluded.size;
  const filteredOut = totalAll - totalInvested;

  if (allStocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Filter className="h-12 w-12 mb-4 opacity-30" />
        <p>No stocks available. Add entries first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Filter panel */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Sector tabs */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-3 overflow-x-auto border-b border-border">
          {allSectors.map((sector) => (
            <button
              key={sector}
              onClick={() => selectSector(sector)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-100
                ${activeSector === sector
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                }`}
            >
              {sector}
            </button>
          ))}
        </div>

        {/* Stock pills */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium">
              {includedCount} of {allStocks.length} stocks selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <CheckSquare className="h-3.5 w-3.5" /> Select all
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                <Square className="h-3.5 w-3.5" /> Clear all
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allStocks.map((name) => {
              const isIncluded = !excluded.has(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all duration-100
                    ${isIncluded
                      ? "border-primary/30 bg-primary/8 text-primary hover:bg-primary/15"
                      : "border-border bg-secondary/40 text-muted-foreground/50 line-through hover:border-border/80"
                    }`}
                >
                  {isIncluded
                    ? <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    : <X className="h-3 w-3 shrink-0" />
                  }
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {includedCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Filtered Invested</p>
            <p className="font-mono font-bold text-lg text-primary">₹{fmt(totalInvested)}</p>
            {filteredOut > 0 && (
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                −₹{fmt(filteredOut)} excluded
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Stocks</p>
            <p className="font-mono font-bold text-lg">{stocks.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{sectors.length} sectors</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Avg Allocation</p>
            <p className="font-mono font-bold text-lg">
              {stocks.length > 0 ? (100 / stocks.length).toFixed(1) : "—"}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">per stock</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Dividends</p>
            <p className="font-mono font-bold text-lg">
              {totalDividends > 0 ? `₹${fmt(totalDividends)}` : "—"}
            </p>
            {totalDividends > 0 && totalInvested > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {((totalDividends / totalInvested) * 100).toFixed(2)}% yield
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stock breakdown table */}
      {stocks.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Stock Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Sector</th>
                  <th className="px-4 py-3 text-right">Invested</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Days Held</th>
                  <th className="px-4 py-3 text-right">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {stocks
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((s) => (
                    <tr key={s.stockName} className="border-t border-border hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{s.stockName}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                          {s.sector}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-right">₹{fmt(s.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono text-right">{s.totalQuantity}</td>
                      <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(s.avgPrice)}</td>
                      <td className="px-4 py-3 font-mono text-right text-muted-foreground">
                        {daysHeld(s.firstPurchaseDate)}d
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(s.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs w-12 text-right">{s.percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border border-border bg-card">
          <Filter className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm">All stocks excluded. Select at least one stock above.</p>
        </div>
      )}

      {/* Sector breakdown */}
      {sectors.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Sector Breakdown</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors
              .sort((a, b) => b.percentage - a.percentage)
              .map((s) => {
                const ret = sectorReturns.get(s.sector);
                const pnl = ret?.priced ? ret.currentValue - ret.invested : null;
                const pnlPct = pnl !== null && ret!.invested > 0 ? (pnl / ret!.invested) * 100 : null;
                const isPos = pnlPct !== null && pnlPct >= 0;
                return (
                  <div key={s.sector} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{s.sector}</span>
                      <span className="font-mono text-muted-foreground">
                        {s.percentage.toFixed(1)}% · ₹{fmt(s.totalAmount)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(s.percentage, 100)}%`,
                          backgroundColor: pnlPct === null ? "hsl(var(--primary))" : isPos ? "#10b981" : "#ef4444",
                        }}
                      />
                    </div>
                    {pnlPct !== null ? (
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">
                          {pnl! >= 0 ? "+" : ""}₹{fmt(Math.abs(pnl!))}
                        </span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded ${isPos ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"}`}>
                          {isPos ? "+" : ""}{pnlPct.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/50 font-mono">no live price</p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
