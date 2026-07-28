import { useMemo, useState } from "react";
import { InvestmentEntry, DividendEntry, GoldEntry, SellEntry } from "@/types/investment";
import { calculatePortfolio, xirr, computeActiveEntries, calculateRealizedPnLFromSells } from "@/lib/calculations";
import { fmt, pct, cagr, daysHeld } from "@/lib/format";
import { LivePriceData } from "@/hooks/useLivePrices";
import { GoldPriceData } from "@/hooks/useGoldPrice";
import { TrendingUp, TrendingDown, BarChart3, Sparkles } from "lucide-react";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries: DividendEntry[];
  goldEntries: GoldEntry[];
  sellEntries: SellEntry[];
  prices: Record<string, LivePriceData>;
  goldPrice: GoldPriceData | null;
  loading: boolean;
  mfRealizedPnl?: number;
}

function StatCard({
  label, value, sub, valueColor = "", dimmed = false,
}: { label: string; value: string; sub?: string; valueColor?: string; dimmed?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${dimmed ? "opacity-50" : ""}`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-mono font-bold mt-1.5 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs font-mono text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function goldRateForEntry(entry: GoldEntry, goldPrice: GoldPriceData): number {
  if (entry.quality === "24K") return goldPrice.retail24k;
  if (entry.quality === "18K") return goldPrice.retail18k;
  return goldPrice.retail22k;
}

export default function Dashboard({ entries, dividendEntries, goldEntries, sellEntries, prices, goldPrice, loading, mfRealizedPnl = 0 }: Props) {
  const [view, setView] = useState<"stocks" | "combined">("stocks");

  // Active holdings: all buy records FIFO-minus all sell records
  const holdEntries = useMemo(() => computeActiveEntries(entries, sellEntries), [entries, sellEntries]);

  const { totalInvested, stocks, sectors, totalDividends } = useMemo(
    () => calculatePortfolio(holdEntries, dividendEntries),
    [holdEntries, dividendEntries],
  );

  // Realized P&L from the sells[] array (plus any legacy status=sold entries)
  const trades = useMemo(() => calculateRealizedPnLFromSells(entries, sellEntries), [entries, sellEntries]);
  const realizedPnl      = trades.reduce((s, t) => s + t.pnl, 0);
  const realizedStcg     = trades.filter(t => !t.isLongTerm).reduce((s, t) => s + t.pnl, 0);
  const realizedLtcg     = trades.filter(t =>  t.isLongTerm).reduce((s, t) => s + t.pnl, 0);
  const realizedTaxEst   = Math.max(0, realizedStcg) * 0.15 + Math.max(0, realizedLtcg - 100_000) * 0.10;

  // Gold aggregates — open positions only
  const openGoldEntries = useMemo(() => goldEntries.filter((e) => e.status !== "sold"), [goldEntries]);
  const totalGoldQty = openGoldEntries.reduce((s, e) => s + e.quantity, 0);
  const totalGoldInvested = openGoldEntries.reduce((s, e) => s + e.amount, 0);
  const goldCurrentValue = goldPrice
    ? openGoldEntries.reduce((s, e) => s + goldRateForEntry(e, goldPrice) * e.quantity, 0)
    : null;
  const goldPnl = goldCurrentValue !== null ? goldCurrentValue - totalGoldInvested : null;
  const goldPnlPct = goldPnl !== null && totalGoldInvested > 0 ? (goldPnl / totalGoldInvested) * 100 : null;

  // Stocks market value — only price stocks with quantity > 0 to avoid phantom losses
  const { totalStocksValue, totalInvestedPriced, priceCount, stocksWithLive } = useMemo(() => {
    let totalStocksValue = 0;
    let totalInvestedPriced = 0;
    let priceCount = 0;
    const stocksWithLive = stocks.map((s) => {
      const live = prices[s.stockName];
      const currentPrice = live?.price ?? null;
      // Only assign a current value when we have a price AND the stock has units to value
      const currentValue = (currentPrice !== null && s.totalQuantity > 0)
        ? currentPrice * s.totalQuantity
        : null;
      if (currentValue !== null) {
        totalStocksValue += currentValue;
        totalInvestedPriced += s.totalAmount;
        priceCount++;
      }
      const pnlAbs = currentValue !== null ? currentValue - s.totalAmount : null;
      const pnlPct = pnlAbs !== null && s.totalAmount > 0 ? (pnlAbs / s.totalAmount) * 100 : null;
      const days = daysHeld(s.firstPurchaseDate);
      const cagrVal = currentValue !== null ? cagr(s.totalAmount, currentValue, days) : null;
      return { ...s, currentPrice, currentValue, pnlAbs, pnlPct, days, cagrVal };
    });
    return { totalStocksValue, totalInvestedPriced, priceCount, stocksWithLive };
  }, [stocks, prices]);

  const hasPrices = priceCount > 0;

  // Sector-wise live P&L: aggregate priced stocks per sector
  const sectorLive = useMemo(() => {
    const map = new Map<string, { invested: number; investedPriced: number; currentValue: number }>();
    for (const s of stocksWithLive) {
      if (!map.has(s.sector)) map.set(s.sector, { invested: 0, investedPriced: 0, currentValue: 0 });
      const d = map.get(s.sector)!;
      d.invested += s.totalAmount;
      if (s.currentValue !== null) {
        d.investedPriced += s.totalAmount;
        d.currentValue += s.currentValue;
      }
    }
    return Array.from(map.entries())
      .map(([sector, d]) => {
        const has = d.investedPriced > 0;
        const pnl = has ? d.currentValue - d.investedPriced : null;
        const pnlPct = has && d.investedPriced > 0 ? (pnl! / d.investedPriced) * 100 : null;
        return { sector, invested: d.invested, pnl, pnlPct };
      })
      .sort((a, b) => b.invested - a.invested);
  }, [stocksWithLive]);

  // ── Stocks-only stats (P&L only against what we can actually price) ──
  const stocksPnl = hasPrices ? totalStocksValue - totalInvestedPriced : null;
  const stocksPnlPct = stocksPnl !== null && totalInvestedPriced > 0 ? (stocksPnl / totalInvestedPriced) * 100 : null;

  // Stocks XIRR (no dividends)
  const stocksXirr = useMemo(() => {
    if (!hasPrices || holdEntries.length === 0) return null;
    const flows = [...holdEntries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: e.date, amount: -e.amount }));
    return xirr([...flows, { date: new Date().toISOString().split("T")[0], amount: totalStocksValue }]);
  }, [holdEntries, totalStocksValue, hasPrices]);

  // Stocks XIRR with dividends (dividends = inflows, reduce effective cost)
  const stocksDividendXirr = useMemo(() => {
    if (!hasPrices || holdEntries.length === 0) return null;
    const buyFlows = holdEntries.map((e) => ({ date: e.date, amount: -e.amount }));
    const divFlows = dividendEntries.map((d) => ({ date: d.date, amount: d.amount }));
    const today = new Date().toISOString().split("T")[0];
    return xirr(
      [...buyFlows, ...divFlows, { date: today, amount: totalStocksValue }]
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  }, [holdEntries, dividendEntries, totalStocksValue, hasPrices]);

  const totalReturnsWithDiv = stocksPnl !== null ? stocksPnl + totalDividends : null;
  const totalReturnsWithDivPct =
    totalReturnsWithDiv !== null && totalInvestedPriced > 0
      ? (totalReturnsWithDiv / totalInvestedPriced) * 100
      : null;

  // ── Combined (stocks + gold) stats ──
  // Use totalInvestedPriced for stock component so 0-qty entries don't distort combined P&L
  const combinedInvestedPriced = totalInvestedPriced + (goldCurrentValue !== null ? totalGoldInvested : 0);
  const combinedValue = totalStocksValue + (goldCurrentValue ?? 0);
  const combinedPnlCalc = hasPrices ? stocksPnl! + (goldPnl ?? 0) : null;
  const combinedPnlPct =
    combinedPnlCalc !== null && combinedInvestedPriced > 0
      ? (combinedPnlCalc / combinedInvestedPriced) * 100
      : null;

  const combinedXirr = useMemo(() => {
    if (!hasPrices || holdEntries.length === 0) return null;
    const stockFlows = holdEntries.map((e) => ({ date: e.date, amount: -e.amount }));
    const goldFlows = openGoldEntries.map((e) => ({ date: e.date, amount: -e.amount }));
    const today = new Date().toISOString().split("T")[0];
    return xirr(
      [...stockFlows, ...goldFlows, { date: today, amount: combinedValue }]
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  }, [holdEntries, openGoldEntries, combinedValue, hasPrices]);

  const combinedDividendXirr = useMemo(() => {
    if (!hasPrices || holdEntries.length === 0) return null;
    const stockFlows = holdEntries.map((e) => ({ date: e.date, amount: -e.amount }));
    const goldFlows = openGoldEntries.map((e) => ({ date: e.date, amount: -e.amount }));
    const divFlows = dividendEntries.map((d) => ({ date: d.date, amount: d.amount }));
    const today = new Date().toISOString().split("T")[0];
    return xirr(
      [...stockFlows, ...goldFlows, ...divFlows, { date: today, amount: combinedValue }]
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  }, [holdEntries, openGoldEntries, dividendEntries, combinedValue, hasPrices]);

  const combinedReturnsWithDiv = combinedPnlCalc !== null ? combinedPnlCalc + totalDividends : null;
  const combinedReturnsWithDivPct =
    combinedReturnsWithDiv !== null && combinedInvestedPriced > 0
      ? (combinedReturnsWithDiv / combinedInvestedPriced) * 100
      : null;

  const gainers = stocksWithLive.filter((s) => s.pnlPct !== null).sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  const best = gainers[0] ?? null;
  const worst = gainers.length > 1 ? gainers[gainers.length - 1] : null;

  const recentEntries = useMemo(
    () => [...holdEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [holdEntries],
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-muted-foreground">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <BarChart3 className="h-10 w-10 text-primary opacity-60" />
        </div>
        <p className="text-lg font-semibold text-foreground">Welcome to StockStar</p>
        <p className="text-sm mt-1.5">Go to Buy → add your first stock entry to get started</p>
      </div>
    );
  }

  const combinedInvested = totalInvested + totalGoldInvested;

  const isStocks = view === "stocks";
  const displayInvested = isStocks ? totalInvested : combinedInvested;
  const displayValue = isStocks ? totalStocksValue : combinedValue;
  const displayPnl = isStocks ? stocksPnl : combinedPnlCalc;
  const displayPnlPct = isStocks ? stocksPnlPct : combinedPnlPct;
  const displayXirr = isStocks ? stocksXirr : combinedXirr;
  const displayDivXirr = isStocks ? stocksDividendXirr : combinedDividendXirr;
  const displayTotalReturns = isStocks ? totalReturnsWithDiv : combinedReturnsWithDiv;
  const displayTotalReturnsPct = isStocks ? totalReturnsWithDivPct : combinedReturnsWithDivPct;

  return (
    <div className="space-y-6">

      {/* View switcher */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit">
        <button
          onClick={() => setView("stocks")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            isStocks ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Stocks
        </button>
        <button
          onClick={() => setView("combined")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
            !isStocks ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Stocks + Gold</span>
          {openGoldEntries.length > 0 && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 rounded-full font-mono">
              {totalGoldQty.toFixed(1)}g
            </span>
          )}
        </button>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Invested"
          value={`₹${fmt(displayInvested)}`}
          sub={isStocks
            ? `${stocks.length} stocks`
            : `${stocks.length} stocks · ${totalGoldQty.toFixed(2)}g gold`}
        />
        <StatCard
          label="Portfolio Value"
          value={hasPrices ? `₹${fmt(displayValue)}` : "—"}
          sub={!hasPrices ? (loading ? "Fetching prices…" : "Open Live P&L to load") : undefined}
        />
        <StatCard
          label="Unrealized P&L"
          value={displayPnl !== null ? `${displayPnl >= 0 ? "+" : ""}₹${fmt(Math.abs(displayPnl))}` : "—"}
          sub={displayPnlPct !== null ? pct(displayPnlPct) : undefined}
          valueColor={displayPnl !== null ? (displayPnl >= 0 ? "text-green-500" : "text-red-500") : ""}
        />
        <StatCard
          label="XIRR"
          value={displayXirr !== null ? `${displayXirr >= 0 ? "+" : ""}${displayXirr.toFixed(2)}%` : "—"}
          sub="annualised return"
          valueColor={displayXirr !== null ? (displayXirr >= 0 ? "text-green-500" : "text-red-500") : ""}
        />
      </div>

      {/* Realized gains section */}
      {trades.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Realized Gains — {trades.length} closed trade{trades.length !== 1 ? "s" : ""}
            </h3>
            {displayPnl !== null && (
              <p className="text-xs text-muted-foreground font-mono">
                Total return (unrealized + realized):{" "}
                <span className={`font-bold ${(displayPnl + realizedPnl) >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {(displayPnl + realizedPnl) >= 0 ? "+" : ""}₹{fmt(Math.abs(displayPnl + realizedPnl))}
                </span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Realized P&L</p>
              <p className={`font-mono font-bold text-xl ${realizedPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {realizedPnl >= 0 ? "+" : ""}₹{fmt(Math.abs(realizedPnl))}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">STCG (&lt; 1 yr)</p>
              <p className={`font-mono font-bold text-xl ${realizedStcg >= 0 ? "text-green-500" : "text-red-500"}`}>
                {realizedStcg >= 0 ? "+" : ""}₹{fmt(Math.abs(realizedStcg))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">15% tax</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">LTCG (&gt; 1 yr)</p>
              <p className={`font-mono font-bold text-xl ${realizedLtcg >= 0 ? "text-green-500" : "text-red-500"}`}>
                {realizedLtcg >= 0 ? "+" : ""}₹{fmt(Math.abs(realizedLtcg))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">10% above ₹1L</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Net after Est. Tax</p>
              <p className={`font-mono font-bold text-xl ${(realizedPnl - realizedTaxEst) >= 0 ? "text-green-500" : "text-red-500"}`}>
                {(realizedPnl - realizedTaxEst) >= 0 ? "+" : ""}₹{fmt(Math.abs(realizedPnl - realizedTaxEst))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Est. tax ₹{fmt(realizedTaxEst)}</p>
            </div>
          </div>
        </div>
      )}

      {/* With-dividend section */}
      {totalDividends > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider text-xs">
              Including Dividends
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Total Dividends Received</p>
              <p className="font-mono font-bold text-xl text-primary">₹{fmt(totalDividends)}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Total Returns (P&L + Div)</p>
              <p className={`font-mono font-bold text-xl ${displayTotalReturns === null ? "" : displayTotalReturns >= 0 ? "text-green-500" : "text-red-500"}`}>
                {displayTotalReturns !== null
                  ? `${displayTotalReturns >= 0 ? "+" : ""}₹${fmt(Math.abs(displayTotalReturns))}`
                  : "—"}
              </p>
              {displayTotalReturnsPct !== null && (
                <p className={`text-xs font-mono mt-0.5 ${displayTotalReturnsPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {pct(displayTotalReturnsPct)}
                </p>
              )}
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">XIRR (incl. Dividends)</p>
              <p className={`font-mono font-bold text-xl ${displayDivXirr === null ? "" : displayDivXirr >= 0 ? "text-green-500" : "text-red-500"}`}>
                {displayDivXirr !== null ? `${displayDivXirr >= 0 ? "+" : ""}${displayDivXirr.toFixed(2)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">annualised</p>
            </div>
          </div>
        </div>
      )}

      {/* Gold summary row (combined view only) */}
      {!isStocks && openGoldEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="text-sm">🥇</span>
            <h3 className="font-semibold text-sm">Gold Holdings</h3>
            {goldPrice && (
              <span className="text-xs text-muted-foreground">
                · 24K ₹{fmt(goldPrice.retail24k)}/g · 22K ₹{fmt(goldPrice.retail22k)}/g
              </span>
            )}
          </div>
          <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Invested</p>
              <p className="font-mono font-semibold">₹{fmt(totalGoldInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Quantity</p>
              <p className="font-mono font-semibold">{totalGoldQty.toFixed(3)} g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current Value</p>
              <p className="font-mono font-semibold">
                {goldCurrentValue !== null ? `₹${fmt(goldCurrentValue)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">P&L</p>
              <p className={`font-mono font-semibold ${goldPnl === null ? "" : goldPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {goldPnl !== null ? `${goldPnl >= 0 ? "+" : "−"}₹${fmt(Math.abs(goldPnl))}` : "—"}
              </p>
              {goldPnlPct !== null && (
                <p className={`text-[11px] font-mono mt-0.5 ${goldPnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {pct(goldPnlPct)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wealth Generated — booked profits across all asset classes */}
      {(() => {
        const hasMfPnl = mfRealizedPnl !== 0;
        const hasGoldPnl = goldPnl !== null;
        const hasAnything = realizedPnl !== 0 || totalDividends > 0 || hasMfPnl || hasGoldPnl;
        if (!hasAnything) return null;
        const total = realizedPnl + totalDividends + mfRealizedPnl + (goldPnl ?? 0);
        const items = [
          { label: "Stocks Realized", value: realizedPnl, show: realizedPnl !== 0 },
          { label: "Dividends", value: totalDividends, show: totalDividends > 0 },
          { label: "MF Realized", value: mfRealizedPnl, show: hasMfPnl },
          { label: "Gold (live)", value: goldPnl ?? 0, show: hasGoldPnl },
        ].filter(i => i.show);
        return (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Wealth Generated</h3>
              <span className={`font-mono font-bold text-sm ${total >= 0 ? "text-green-500" : "text-red-500"}`}>
                {total >= 0 ? "+" : ""}₹{fmt(Math.abs(total))} total
              </span>
            </div>
            <div className={`grid divide-y sm:divide-y-0 sm:divide-x divide-border`}
              style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
              {items.map(({ label, value }) => (
                <div key={label} className="px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`font-mono font-bold text-lg ${value >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {value >= 0 ? "+" : ""}₹{fmt(Math.abs(value))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Holdings + Sectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-sm">Top Holdings</h3>
          </div>
          <div className="divide-y divide-border">
            {stocksWithLive
              .sort((a, b) => b.totalAmount - a.totalAmount)
              .slice(0, 6)
              .map((s) => (
                <div key={s.stockName} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-mono font-semibold text-sm text-primary truncate">{s.stockName}</p>
                    <p className="text-xs text-muted-foreground">{s.sector}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-semibold">₹{fmt(s.totalAmount)}</p>
                    <div className="flex items-center justify-end gap-2 mt-0.5">
                      <div className="w-14 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                        {s.percentage.toFixed(1)}%
                      </span>
                    </div>
                    {s.pnlPct !== null && (
                      <p className={`text-xs font-mono mt-0.5 ${s.pnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {pct(s.pnlPct)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Sector-wise live P&L */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Sector P&L</h3>
            {!hasPrices && (
              <span className="text-xs text-muted-foreground">open Live P&L to load prices</span>
            )}
          </div>
          <div className="divide-y divide-border">
            {sectorLive.map((s) => {
              const alloc = totalInvested > 0 ? (s.invested / totalInvested) * 100 : 0;
              return (
                <div key={s.sector} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{s.sector}</span>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-muted-foreground">₹{fmt(s.invested)}</span>
                      {s.pnl !== null && (
                        <span className={`font-semibold ${s.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {s.pnl >= 0 ? "+" : ""}₹{fmt(Math.abs(s.pnl))}
                        </span>
                      )}
                      {s.pnlPct !== null && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.pnlPct >= 0 ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                        }`}>
                          {s.pnlPct >= 0 ? "+" : ""}{s.pnlPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        s.pnl === null ? "bg-primary" : s.pnl >= 0 ? "bg-green-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(alloc, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">{alloc.toFixed(1)}% allocation</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Best / Worst performers */}
      {hasPrices && best && worst && best.stockName !== worst.stockName && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Best Performer</span>
            </div>
            <p className="font-mono font-bold text-primary text-xl">{best.stockName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{best.sector}</p>
            <p className="font-mono font-bold text-green-500 text-3xl mt-2">{pct(best.pnlPct ?? 0)}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {best.pnlAbs !== null ? `${best.pnlAbs >= 0 ? "+" : ""}₹${fmt(best.pnlAbs)}` : ""}
              {best.cagrVal !== null ? ` · ${pct(best.cagrVal)} CAGR` : ""}
            </p>
          </div>
          <div className={`rounded-xl border p-5 ${(worst.pnlPct ?? 0) < 0 ? "border-red-500/25 bg-red-500/5" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${(worst.pnlPct ?? 0) < 0 ? "bg-red-500/15" : "bg-secondary"}`}>
                <TrendingDown className={`h-4 w-4 ${(worst.pnlPct ?? 0) < 0 ? "text-red-500" : "text-muted-foreground"}`} />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Needs Attention</span>
            </div>
            <p className="font-mono font-bold text-primary text-xl">{worst.stockName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{worst.sector}</p>
            <p className={`font-mono font-bold text-3xl mt-2 ${(worst.pnlPct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
              {pct(worst.pnlPct ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {worst.pnlAbs !== null ? `${worst.pnlAbs >= 0 ? "+" : ""}₹${fmt(worst.pnlAbs)}` : ""}
              {worst.cagrVal !== null ? ` · ${pct(worst.cagrVal)} CAGR` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Stocks Held",   value: String(stocks.length) },
          { label: "Closed Trades", value: trades.length > 0 ? String(trades.length) : "—" },
          { label: "Dividends",     value: totalDividends > 0 ? `₹${fmt(totalDividends)}` : "—" },
          { label: "Gold",          value: totalGoldQty > 0 ? `${totalGoldQty.toFixed(2)} g` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="font-mono font-bold text-xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent buy activity */}
      {recentEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Recent Activity</h3>
          </div>
          <div className="divide-y divide-border">
            {recentEntries.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-primary">{e.stockName}</span>
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{e.sector}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">₹{fmt(e.amount)}</p>
                  <p className="text-xs text-muted-foreground">{e.quantity} shares</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
