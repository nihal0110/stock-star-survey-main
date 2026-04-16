import { useEffect, useMemo } from "react";
import { InvestmentEntry, DividendEntry } from "@/types/investment";
import { calculatePortfolio } from "@/lib/calculations";
import { useLivePrices } from "@/hooks/useLivePrices";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
} from "lucide-react";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries: DividendEntry[];
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export default function LiveMarket({ entries, dividendEntries }: Props) {
  const { totalInvested, stocks } = calculatePortfolio(entries, dividendEntries);

  const symbols = useMemo(() => stocks.map((s) => s.stockName), [stocks]);
  const { prices, loading, lastUpdated, fetchPrices } = useLivePrices();

  // Auto-fetch on mount
  useEffect(() => {
    if (symbols.length > 0) fetchPrices(symbols);
  }, [symbols.join(",")]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Activity className="h-12 w-12 mb-4 opacity-30" />
        <p>No stocks found. Add stock entries first.</p>
      </div>
    );
  }

  // Compute totals from live prices
  let totalCurrentValue = 0;
  let hasPrices = false;

  const rows = stocks
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((stock) => {
      const live = prices[stock.stockName];
      const currentPrice = live?.price ?? null;
      const currentValue = currentPrice !== null ? currentPrice * stock.totalQuantity : null;
      if (currentValue !== null) {
        totalCurrentValue += currentValue;
        hasPrices = true;
      }
      const pnlAbs = currentValue !== null ? currentValue - stock.totalAmount : null;
      const pnlPct = pnlAbs !== null && stock.totalAmount > 0 ? (pnlAbs / stock.totalAmount) * 100 : null;
      const totalReturn =
        pnlAbs !== null ? pnlAbs + stock.totalDividend : null;
      const totalReturnPct =
        totalReturn !== null && stock.totalAmount > 0
          ? (totalReturn / stock.totalAmount) * 100
          : null;

      return { ...stock, live, currentPrice, currentValue, pnlAbs, pnlPct, totalReturn, totalReturnPct };
    });

  const totalPnl = hasPrices ? totalCurrentValue - totalInvested : null;
  const totalPnlPct = totalPnl !== null && totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;
  const totalDividends = dividendEntries.reduce((s, d) => s + d.amount, 0);
  const totalOverallReturn = totalPnl !== null ? totalPnl + totalDividends : null;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live Market</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Last updated: {lastUpdated.toLocaleTimeString("en-IN")}
            </p>
          )}
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

      {/* Summary Cards */}
      {hasPrices && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Total Invested
            </p>
            <p className="text-2xl font-mono font-bold text-primary">
              ₹{fmt(totalInvested)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Market Value
            </p>
            <p className="text-2xl font-mono font-bold">₹{fmt(totalCurrentValue)}</p>
          </div>

          <div
            className={`rounded-lg border bg-card p-4 ${
              (totalPnl ?? 0) >= 0 ? "border-green-500/40" : "border-red-500/40"
            }`}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Unrealized P&amp;L
            </p>
            <p
              className={`text-2xl font-mono font-bold ${
                (totalPnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {totalPnl !== null ? (totalPnl >= 0 ? "+" : "") + "₹" + fmt(totalPnl) : "—"}
            </p>
            {totalPnlPct !== null && (
              <p
                className={`text-xs font-mono mt-0.5 ${
                  totalPnlPct >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {pct(totalPnlPct)}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Total Return (incl. Div)
            </p>
            <p
              className={`text-2xl font-mono font-bold ${
                (totalOverallReturn ?? 0) >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {totalOverallReturn !== null
                ? (totalOverallReturn >= 0 ? "+" : "") + "₹" + fmt(totalOverallReturn)
                : "—"}
            </p>
            {totalDividends > 0 && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                incl. ₹{fmt(totalDividends)} dividends
              </p>
            )}
          </div>
        </div>
      )}

      {/* Per-stock table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Stock</th>
                <th className="px-4 py-3 text-right">Shares</th>
                <th className="px-4 py-3 text-right">Avg Cost</th>
                <th className="px-4 py-3 text-right">Curr Price</th>
                <th className="px-4 py-3 text-right">Day Chg</th>
                <th className="px-4 py-3 text-right">Invested</th>
                <th className="px-4 py-3 text-right">Mkt Value</th>
                <th className="px-4 py-3 text-right">P&amp;L ₹</th>
                <th className="px-4 py-3 text-right">P&amp;L %</th>
                <th className="px-4 py-3 text-right">Dividends</th>
                <th className="px-4 py-3 text-right">Total Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isProfit = (row.pnlAbs ?? 0) >= 0;
                const isLoading = loading && !row.live;
                const hasError = row.live?.error && !row.live?.price;

                return (
                  <tr
                    key={row.stockName}
                    className="border-t border-border hover:bg-secondary/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-primary">
                          {row.stockName}
                        </span>
                        {hasError && (
                          <AlertCircle className="h-3.5 w-3.5 text-yellow-500" title={row.live?.error} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{row.sector}</p>
                    </td>

                    <td className="px-4 py-3 font-mono text-right">{row.totalQuantity}</td>

                    <td className="px-4 py-3 font-mono text-right">
                      ₹{fmt(row.avgPrice)}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {isLoading ? (
                        <span className="text-muted-foreground text-xs">…</span>
                      ) : row.currentPrice !== null ? (
                        <span className={isProfit ? "text-green-500" : "text-red-500"}>
                          ₹{fmt(row.currentPrice)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {row.live?.changePercent !== null && row.live?.changePercent !== undefined ? (
                        <span
                          className={`flex items-center justify-end gap-1 ${
                            (row.live.changePercent ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {(row.live.changePercent ?? 0) >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {pct(row.live.changePercent ?? 0)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      ₹{fmt(row.totalAmount)}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {row.currentValue !== null ? `₹${fmt(row.currentValue)}` : "—"}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {row.pnlAbs !== null ? (
                        <span className={isProfit ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                          {isProfit ? "+" : ""}₹{fmt(row.pnlAbs)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {row.pnlPct !== null ? (
                        <span className={isProfit ? "text-green-500" : "text-red-500"}>
                          {pct(row.pnlPct)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {row.totalDividend > 0 ? (
                        <span className="text-green-500">₹{fmt(row.totalDividend)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-right">
                      {row.totalReturn !== null ? (
                        <span
                          className={`font-semibold ${
                            row.totalReturn >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {row.totalReturn >= 0 ? "+" : ""}₹{fmt(row.totalReturn)}
                          {row.totalReturnPct !== null && (
                            <span className="block text-xs font-normal">
                              {pct(row.totalReturnPct)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {hasPrices && (
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-3 text-xs uppercase tracking-wider" colSpan={5}>
                    Total
                  </td>
                  <td className="px-4 py-3 font-mono text-right">₹{fmt(totalInvested)}</td>
                  <td className="px-4 py-3 font-mono text-right">₹{fmt(totalCurrentValue)}</td>
                  <td className="px-4 py-3 font-mono text-right">
                    {totalPnl !== null && (
                      <span className={totalPnl >= 0 ? "text-green-500" : "text-red-500"}>
                        {totalPnl >= 0 ? "+" : ""}₹{fmt(totalPnl)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-right">
                    {totalPnlPct !== null && (
                      <span className={totalPnlPct >= 0 ? "text-green-500" : "text-red-500"}>
                        {pct(totalPnlPct)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-green-500">
                    {totalDividends > 0 ? `₹${fmt(totalDividends)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-right">
                    {totalOverallReturn !== null && (
                      <span
                        className={`font-bold ${totalOverallReturn >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {totalOverallReturn >= 0 ? "+" : ""}₹{fmt(totalOverallReturn)}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Prices sourced from Yahoo Finance (NSE). Append <span className="font-mono">.BO</span> suffix to stock name for BSE stocks (e.g. <span className="font-mono">RELIANCE.BO</span>). Data may be delayed 15 minutes.
      </p>
    </div>
  );
}
