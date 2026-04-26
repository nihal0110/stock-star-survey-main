import { useMemo, useState } from "react";
import { InvestmentEntry, DividendEntry, Target as TargetType } from "@/types/investment";
import { calculatePortfolio, xirr } from "@/lib/calculations";
import { fmt, pct, daysHeld, cagr } from "@/lib/format";
import { LivePriceData } from "@/hooks/useLivePrices";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Repeat2 } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import LiveMarketTable from "@/components/LiveMarketTable";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries: DividendEntry[];
  targets: Record<string, TargetType>;
  onSaveTarget: (stockName: string, price: number | null) => void;
  prices: Record<string, LivePriceData>;
  loading: boolean;
  lastUpdated: Date | null;
  fetchPrices: (symbols: string[]) => void;
}

export default function LiveMarket({
  entries,
  dividendEntries,
  targets,
  onSaveTarget,
  prices,
  loading,
  lastUpdated,
  fetchPrices,
}: Props) {
  const { stocks } = useMemo(
    () => calculatePortfolio(entries, dividendEntries),
    [entries, dividendEntries],
  );

  const [editingTarget, setEditingTarget] = useState<string | null>(null);

  const handleSaveTarget = (stockName: string, value: string) => {
    const parsed = parseFloat(value);
    onSaveTarget(stockName, isNaN(parsed) || value === "" ? null : parsed);
    setEditingTarget(null);
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Activity className="h-12 w-12 mb-4 opacity-30" />
        <p>No stocks found. Add entries first.</p>
      </div>
    );
  }

  let totalCurrentValue = 0;
  let priceCount = 0;

  const rows = stocks
    .filter((s) => s.totalQuantity > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((stock) => {
      const live = prices[stock.stockName];
      const currentPrice = live?.price ?? null;
      const currentValue = currentPrice !== null ? currentPrice * stock.totalQuantity : null;
      if (currentValue !== null) { totalCurrentValue += currentValue; priceCount++; }

      const pnlAbs = currentValue !== null ? currentValue - stock.totalAmount : null;
      const pnlPct = pnlAbs !== null && stock.totalAmount > 0 ? (pnlAbs / stock.totalAmount) * 100 : null;

      const days = daysHeld(stock.firstPurchaseDate);
      const divYield = stock.totalDividend > 0 && stock.totalAmount > 0
        ? (stock.totalDividend / stock.totalAmount) * 100
        : null;
      const cagrVal = currentValue !== null ? cagr(stock.totalAmount, currentValue, days) : null;

      const target = targets[stock.stockName] ?? null;
      const targetPrice = target?.price ?? null;
      const targetGap = targetPrice !== null && currentPrice !== null
        ? ((targetPrice - currentPrice) / currentPrice) * 100
        : null;

      return {
        ...stock,
        live,
        currentPrice,
        currentValue,
        pnlAbs,
        pnlPct,
        days,
        cagrVal,
        divYield,
        targetPrice,
        targetSetAt: target?.setAt ?? null,
        targetHistory: target?.history ?? [],
        targetGap,
      };
    });

  const symbols = rows.map((r) => r.stockName);
  const liveInvested = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  const hasPrices = priceCount > 0;
  const totalPnl = hasPrices ? totalCurrentValue - liveInvested : null;
  const totalPnlPct = totalPnl !== null && liveInvested > 0 ? (totalPnl / liveInvested) * 100 : null;
  const totalDividends = dividendEntries.reduce((s, d) => s + d.amount, 0);
  const portfolioDivYield = totalDividends > 0 && liveInvested > 0
    ? (totalDividends / liveInvested) * 100
    : null;

  const xirrVal = hasPrices ? xirr([
    ...entries
      .filter((e) => e.status !== "sold" && rows.some((r) => r.stockName === e.stockName.trim().toUpperCase()))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: e.date, amount: -e.amount })),
    { date: new Date().toISOString().split("T")[0], amount: totalCurrentValue },
  ]) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live Market</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString("en-IN")}`
              : "Click Refresh to load live prices"}
          </p>
        </div>
        <Button
          onClick={() => fetchPrices(symbols)}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Fetching..." : "Refresh Prices"}
        </Button>
      </div>

      {hasPrices && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Invested" value={`₹${fmt(liveInvested)}`} valueClass="text-primary" />
          <StatCard label="Market Value" value={`₹${fmt(totalCurrentValue)}`} />
          <StatCard
            label="Unrealized P&L"
            value={totalPnl !== null ? `${totalPnl >= 0 ? "+" : ""}₹${fmt(totalPnl)}` : "—"}
            sub={totalPnlPct !== null ? pct(totalPnlPct) : undefined}
            valueClass={(totalPnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"}
            borderClass={(totalPnl ?? 0) >= 0 ? "border-green-500/40" : "border-red-500/40"}
          />
          <StatCard
            label="XIRR"
            value={xirrVal !== null ? `${xirrVal >= 0 ? "+" : ""}${xirrVal.toFixed(2)}%` : "—"}
            sub="true annualised return"
            valueClass={xirrVal !== null ? (xirrVal >= 0 ? "text-green-500" : "text-red-500") : undefined}
          />
          <StatCard
            label="Dividends Reinvested"
            value={totalDividends > 0 ? `₹${fmt(totalDividends)}` : "—"}
            sub={portfolioDivYield !== null ? `${pct(portfolioDivYield, false)} yield on portfolio` : undefined}
            icon={<Repeat2 className="h-3 w-3" />}
          />
        </div>
      )}

      <LiveMarketTable
        rows={rows}
        totals={{ liveInvested, totalCurrentValue, totalPnl, totalPnlPct, totalDividends }}
        loading={loading}
        hasPrices={hasPrices}
        editingTarget={editingTarget}
        setEditingTarget={setEditingTarget}
        onSaveTarget={handleSaveTarget}
      />
    </div>
  );
}
