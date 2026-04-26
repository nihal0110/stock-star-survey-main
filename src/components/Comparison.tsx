import { useEffect, useState, useMemo } from "react";
import { InvestmentEntry, GoldEntry } from "@/types/investment";
import { xirr } from "@/lib/calculations";
import { fmt } from "@/lib/format";
import { GoldPriceData } from "@/hooks/useGoldPrice";
import { LivePriceData } from "@/hooks/useLivePrices";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, Scale } from "lucide-react";

const API = "http://localhost:3001";

interface NiftyPrice { date: string; close: number; }

interface Props {
  stockEntries: InvestmentEntry[];
  goldEntries: GoldEntry[];
  goldPrice: GoldPriceData | null;
  prices: Record<string, LivePriceData>;
}

function getClosestPrice(prices: NiftyPrice[], targetDate: string): number | null {
  if (prices.length === 0) return null;
  let lo = 0, hi = prices.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date < targetDate) lo = mid + 1;
    else hi = mid;
  }
  if (prices[lo]) return prices[lo].close;
  if (prices[lo - 1]) return prices[lo - 1].close;
  return null;
}

function XIRRBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={`font-mono font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}>
      {positive ? "+" : ""}{value.toFixed(2)}% p.a.
    </span>
  );
}

export default function Comparison({ stockEntries, goldEntries, goldPrice, prices }: Props) {
  const [niftyPrices, setNiftyPrices] = useState<NiftyPrice[]>([]);
  const [niftyLoading, setNiftyLoading] = useState(false);
  const [niftyError, setNiftyError] = useState<string | null>(null);

  const holdEntries = stockEntries.filter((e) => e.status !== "sold");
  const soldEntries = stockEntries.filter((e) => e.status === "sold");

  // Only open (unsold) gold for current portfolio stats
  const openGoldEntries = goldEntries.filter((e) => e.status !== "sold");

  const totalStock = holdEntries.reduce((s, e) => s + e.amount, 0);
  const totalGold  = openGoldEntries.reduce((s, e) => s + e.amount, 0);
  const grandTotal = totalStock + totalGold;
  const stockPct   = grandTotal > 0 ? (totalStock / grandTotal) * 100 : 0;
  const goldPct    = grandTotal > 0 ? (totalGold  / grandTotal) * 100 : 0;
  const totalGoldQty    = openGoldEntries.reduce((s, e) => s + e.quantity, 0);
  const goldAvgPrice    = totalGoldQty > 0 ? totalGold / totalGoldQty : 0;
  const goldLiveValue   = goldPrice ? goldPrice.retail22k * totalGoldQty : null;
  const goldPnl         = goldLiveValue !== null ? goldLiveValue - totalGold : null;
  const goldPnlPct      = goldPnl !== null && totalGold > 0 ? (goldPnl / totalGold) * 100 : null;

  // Compute actual portfolio market value from live prices (for XIRR terminal value)
  const portfolioMarketValue = useMemo(() => {
    if (!prices || Object.keys(prices).length === 0) return null;
    const stockQty = new Map<string, number>();
    for (const e of holdEntries) {
      const key = e.stockName.trim().toUpperCase();
      stockQty.set(key, (stockQty.get(key) ?? 0) + e.quantity);
    }
    let total = 0;
    let counted = 0;
    for (const [name, qty] of stockQty) {
      const livePrice = prices[name]?.price;
      if (livePrice && qty > 0) { total += livePrice * qty; counted++; }
    }
    return counted > 0 ? total : null;
  }, [holdEntries, prices]);

  const earliestDate = useMemo(() => {
    const dates = holdEntries.map((e) => e.date).filter(Boolean);
    return dates.length > 0 ? dates.sort()[0] : null;
  }, [holdEntries]);

  const loadNifty = async () => {
    if (!earliestDate) return;
    setNiftyLoading(true);
    setNiftyError(null);
    try {
      const res = await fetch(`${API}/nifty-prices?from=${earliestDate}`);
      const data = await res.json();
      if (data.error) setNiftyError(data.error);
      else setNiftyPrices(data);
    } catch {
      setNiftyError("Could not fetch Nifty data.");
    }
    setNiftyLoading(false);
  };

  useEffect(() => { if (earliestDate) loadNifty(); }, [earliestDate]);

  const benchmark = useMemo(() => {
    if (niftyPrices.length === 0 || holdEntries.length === 0) return null;
    const currentNifty = niftyPrices[niftyPrices.length - 1].close;
    const sorted = [...holdEntries].sort((a, b) => a.date.localeCompare(b.date));
    const today = new Date().toISOString().split("T")[0];

    const sellProceeds = soldEntries
      .filter((s) => s.sellDate && s.sellAmount != null)
      .map((s) => ({ date: s.sellDate!, amount: (s.sellAmount ?? 0) - (s.sellCharges ?? 0) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let sipUnits = 0;
    for (const e of sorted) {
      const price = getClosestPrice(niftyPrices, e.date);
      if (price && price > 0) sipUnits += e.amount / price;
    }
    for (const s of sellProceeds) {
      const price = getClosestPrice(niftyPrices, s.date);
      if (price && price > 0) sipUnits -= s.amount / price;
    }
    sipUnits = Math.max(0, sipUnits);
    const sipValue = sipUnits * currentNifty;

    const sipXirr = xirr([
      ...sorted.map((e) => ({ date: e.date, amount: -e.amount })),
      ...sellProceeds.map((s) => ({ date: s.date, amount: s.amount })),
      { date: today, amount: sipValue },
    ]);

    const firstDate = sorted[0].date;
    const lumpSumNiftyPrice = getClosestPrice(niftyPrices, firstDate);
    const lumpSumValue = lumpSumNiftyPrice && lumpSumNiftyPrice > 0
      ? (totalStock / lumpSumNiftyPrice) * currentNifty
      : null;

    const lumpSumXirr = lumpSumValue !== null ? xirr([
      { date: firstDate, amount: -totalStock },
      { date: today,     amount: lumpSumValue },
    ]) : null;

    // Use actual market value when available; fall back to cost basis with null marker
    const terminalValue = portfolioMarketValue ?? totalStock;
    const yourXirr = xirr([
      ...sorted.map((e) => ({ date: e.date, amount: -e.amount })),
      ...sellProceeds.map((s) => ({ date: s.date, amount: s.amount })),
      { date: today, amount: terminalValue },
    ]);

    return {
      currentNifty, firstDate, sipValue, sipXirr, lumpSumValue, lumpSumXirr, yourXirr,
      terminalValue, hasLiveValue: portfolioMarketValue !== null,
    };
  }, [niftyPrices, holdEntries, soldEntries, totalStock, portfolioMarketValue]);

  if (grandTotal === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Scale className="h-12 w-12 mb-4 opacity-30" />
        <p>No data. Add stock or gold entries first.</p>
      </div>
    );
  }

  const outperformanceVsSip = benchmark
    ? (benchmark.yourXirr ?? 0) - (benchmark.sipXirr ?? 0)
    : null;
  const outperformanceVsLumpSum = benchmark
    ? (benchmark.yourXirr ?? 0) - (benchmark.lumpSumXirr ?? 0)
    : null;

  return (
    <div className="space-y-5">

      {/* Total + allocation bar */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
          <p className="text-3xl font-mono font-bold text-primary">₹{fmt(grandTotal)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground mb-3">Allocation Split</p>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {stockPct > 0 && (
              <div
                className="bg-primary flex items-center justify-center text-primary-foreground text-xs font-mono font-semibold transition-all"
                style={{ width: `${stockPct}%` }}
              >
                {stockPct > 12 && `Stocks ${stockPct.toFixed(1)}%`}
              </div>
            )}
            {goldPct > 0 && (
              <div
                className="flex items-center justify-center text-white text-xs font-mono font-semibold transition-all"
                style={{ width: `${goldPct}%`, background: "hsl(43 80% 50%)" }}
              >
                {goldPct > 12 && `Gold ${goldPct.toFixed(1)}%`}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
            <span>{stockPct.toFixed(1)}% Stocks · ₹{fmt(totalStock)}</span>
            <span>{goldPct.toFixed(1)}% Gold · ₹{fmt(totalGold)}</span>
          </div>
        </div>
      </div>

      {/* Stocks vs Gold cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Stocks */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">Stocks</span>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {stockPct.toFixed(1)}%
            </span>
          </div>
          <p className="font-mono font-bold text-2xl">₹{fmt(totalStock)}</p>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${stockPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {holdEntries.length} lots · {new Set(holdEntries.map((e) => e.stockName)).size} stocks
          </p>
        </div>

        {/* Gold */}
        <div className="rounded-xl border bg-card p-5 space-y-3" style={{ borderColor: "hsl(43 60% 50% / 0.4)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md flex items-center justify-center text-base" style={{ background: "hsl(43 80% 50% / 0.12)" }}>
                🥇
              </div>
              <span className="font-semibold text-sm">Gold</span>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full" style={{ background: "hsl(43 80% 50% / 0.12)", color: "hsl(43 80% 40%)" }}>
              {goldPct.toFixed(1)}%
            </span>
          </div>
          <p className="font-mono font-bold text-2xl">₹{fmt(totalGold)}</p>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${goldPct}%`, background: "hsl(43 80% 50%)" }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{totalGoldQty.toFixed(3)} g · Avg ₹{fmt(goldAvgPrice)}/g</span>
          </div>
          {goldLiveValue !== null && (
            <div className="pt-1 border-t border-border space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current value</span>
                <span className="font-mono font-semibold">₹{fmt(goldLiveValue)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Unrealized P&L</span>
                <span className={`font-mono font-semibold ${(goldPnl ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {(goldPnl ?? 0) >= 0 ? "+" : "−"}₹{fmt(Math.abs(goldPnl ?? 0))}
                  {goldPnlPct !== null && ` (${goldPnlPct >= 0 ? "+" : ""}${goldPnlPct.toFixed(1)}%)`}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">22K retail · ₹{fmt(goldPrice!.retail22k)}/g</p>
            </div>
          )}
        </div>
      </div>

      {/* Nifty 50 Benchmark */}
      {stockEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Nifty 50 Benchmark</h3>
              {benchmark && (
                <span className="text-xs text-muted-foreground font-mono">
                  · ₹{fmt(benchmark.currentNifty)}
                </span>
              )}
            </div>
            <button
              onClick={loadNifty}
              disabled={niftyLoading}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${niftyLoading ? "animate-spin" : ""}`} />
              {niftyLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {niftyError && (
            <div className="px-5 py-3 text-sm text-destructive bg-destructive/5 border-b border-destructive/20">
              {niftyError}
            </div>
          )}

          {!benchmark && !niftyLoading && !niftyError && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No benchmark data loaded yet.
            </div>
          )}

          {niftyLoading && !benchmark && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-40" />
              Fetching Nifty prices…
            </div>
          )}

          {benchmark && (
            <div className="p-5 space-y-5">
              {/* 3 column comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Your portfolio */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Your Portfolio</p>
                  <p className="text-xl font-mono font-bold text-primary">₹{fmt(benchmark.terminalValue)}</p>
                  {!benchmark.hasLiveValue && (
                    <p className="text-[10px] text-muted-foreground italic">cost basis · load Live P&L for market value</p>
                  )}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">XIRR</span>
                      <XIRRBadge value={benchmark.yourXirr} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">First buy</span>
                      <span className="font-mono text-foreground">{benchmark.firstDate}</span>
                    </div>
                  </div>
                </div>

                {/* Nifty SIP */}
                {(() => {
                  const better = benchmark.sipValue >= benchmark.terminalValue;
                  return (
                    <div className={`rounded-lg border p-4 space-y-2 ${better ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Nifty — Same Dates
                      </p>
                      <p className={`text-xl font-mono font-bold ${better ? "text-emerald-500" : "text-red-500"}`}>
                        ₹{fmt(benchmark.sipValue)}
                      </p>
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">XIRR</span>
                          <XIRRBadge value={benchmark.sipXirr} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">vs you</span>
                          {outperformanceVsSip !== null ? (
                            <span className={`font-mono font-semibold text-xs ${outperformanceVsSip >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {outperformanceVsSip >= 0 ? "You +" : "Nifty +"}
                              {Math.abs(outperformanceVsSip).toFixed(2)}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Nifty lump sum */}
                {(() => {
                  const better = benchmark.lumpSumValue !== null && benchmark.lumpSumValue >= benchmark.terminalValue;
                  return (
                    <div className={`rounded-lg border p-4 space-y-2 ${better ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Nifty — Lump Sum
                      </p>
                      <p className={`text-xl font-mono font-bold ${better ? "text-emerald-500" : "text-red-500"}`}>
                        {benchmark.lumpSumValue !== null ? `₹${fmt(benchmark.lumpSumValue)}` : "—"}
                      </p>
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">XIRR</span>
                          <XIRRBadge value={benchmark.lumpSumXirr} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">vs you</span>
                          {outperformanceVsLumpSum !== null ? (
                            <span className={`font-mono font-semibold text-xs ${outperformanceVsLumpSum >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {outperformanceVsLumpSum >= 0 ? "You +" : "Nifty +"}
                              {Math.abs(outperformanceVsLumpSum).toFixed(2)}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Visual bar chart */}
              {(() => {
                const vals = [benchmark.terminalValue, benchmark.sipValue, benchmark.lumpSumValue ?? 0];
                const max = Math.max(...vals);
                const bars = [
                  { label: "Your Portfolio", value: benchmark.terminalValue, color: "bg-primary" },
                  { label: "Nifty (same dates)", value: benchmark.sipValue, color: benchmark.sipValue >= totalStock ? "bg-emerald-500" : "bg-red-500" },
                  { label: "Nifty (lump sum)", value: benchmark.lumpSumValue ?? 0, color: (benchmark.lumpSumValue ?? 0) >= totalStock ? "bg-emerald-500" : "bg-red-500" },
                ];
                return (
                  <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Value Comparison</p>
                    {bars.map((b) => (
                      <div key={b.label}>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-muted-foreground">{b.label}</span>
                          <span className="font-semibold">₹{fmt(b.value)}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${b.color}`} style={{ width: `${max > 0 ? (b.value / max) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Portfolio shows cost basis. For market value, see Live P&L.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
