import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { fmt, pct } from "@/lib/format";
import { LivePriceData } from "@/hooks/useLivePrices";

export interface LiveRow {
  stockName: string;
  sector: string;
  totalQuantity: number;
  avgPrice: number;
  totalAmount: number;
  totalDividend: number;
  live: LivePriceData | undefined;
  currentPrice: number | null;
  currentValue: number | null;
  pnlAbs: number | null;
  pnlPct: number | null;
  days: number;
  cagrVal: number | null;
  divYield: number | null;
  targetPrice: number | null;
  targetSetAt: string | null;
  targetHistory: { price: number; setAt: string }[];
  targetGap: number | null;
}

export interface LiveTotals {
  liveInvested: number;
  totalCurrentValue: number;
  totalPnl: number | null;
  totalPnlPct: number | null;
  totalDividends: number;
}

interface Props {
  rows: LiveRow[];
  totals: LiveTotals;
  loading: boolean;
  hasPrices: boolean;
  editingTarget: string | null;
  setEditingTarget: (name: string | null) => void;
  onSaveTarget: (stockName: string, value: string) => void;
}

export default function LiveMarketTable({
  rows,
  totals,
  loading,
  hasPrices,
  editingTarget,
  setEditingTarget,
  onSaveTarget,
}: Props) {
  const { liveInvested, totalCurrentValue, totalPnl, totalPnlPct, totalDividends } = totals;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">LTP</th>
              <th className="px-4 py-3 text-right">Day Chg</th>
              <th className="px-4 py-3 text-right">Invested</th>
              <th className="px-4 py-3 text-right">Mkt Value</th>
              <th className="px-4 py-3 text-right">P&amp;L ₹</th>
              <th className="px-4 py-3 text-right">P&amp;L %</th>
              <th className="px-4 py-3 text-right">CAGR</th>
              <th className="px-4 py-3 text-right">Days</th>
              <th className="px-4 py-3 text-right">Div Yield</th>
              <th className="px-4 py-3 text-center">Target ₹</th>
              <th className="px-4 py-3 text-right">52W Range</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isProfit = (row.pnlAbs ?? 0) >= 0;
              const targetReached =
                row.targetPrice !== null &&
                row.currentPrice !== null &&
                row.currentPrice >= row.targetPrice;

              return (
                <tr
                  key={row.stockName}
                  className="border-t border-border hover:bg-secondary/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-primary">{row.stockName}</span>
                    <p className="text-xs text-muted-foreground">{row.sector}</p>
                  </td>

                  <td className="px-4 py-3 font-mono text-right">{row.totalQuantity}</td>

                  <td className="px-4 py-3 font-mono text-right">₹{fmt(row.avgPrice)}</td>

                  <td className="px-4 py-3 font-mono text-right">
                    {loading && !row.live ? (
                      <span className="text-muted-foreground text-xs">…</span>
                    ) : row.currentPrice !== null ? (
                      <span className={isProfit ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                        ₹{fmt(row.currentPrice)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-mono text-right">
                    {row.live?.changePercent != null ? (
                      <span
                        className={`flex items-center justify-end gap-1 ${row.live.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {row.live.changePercent >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {pct(row.live.changePercent)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-mono text-right">₹{fmt(row.totalAmount)}</td>

                  <td className="px-4 py-3 font-mono text-right">
                    {row.currentValue !== null ? `₹${fmt(row.currentValue)}` : <span className="text-muted-foreground">—</span>}
                  </td>

                  <td className="px-4 py-3 font-mono text-right">
                    {row.pnlAbs !== null ? (
                      <span className={`font-semibold ${isProfit ? "text-green-500" : "text-red-500"}`}>
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
                    {row.cagrVal !== null ? (
                      <span className={row.cagrVal >= 0 ? "text-green-500" : "text-red-500"}>
                        {pct(row.cagrVal)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-mono text-right text-muted-foreground">{row.days}d</td>

                  <td className="px-4 py-3 font-mono text-right">
                    {row.divYield !== null ? (
                      <div>
                        <span className="text-foreground">{pct(row.divYield, false)}</span>
                        <p className="text-[10px] text-muted-foreground">₹{fmt(row.totalDividend)} ↺</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {editingTarget === row.stockName ? (
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={row.targetPrice ?? ""}
                        autoFocus
                        className="h-7 w-24 text-xs font-mono text-center bg-secondary"
                        onBlur={(e) => onSaveTarget(row.stockName, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSaveTarget(row.stockName, (e.target as HTMLInputElement).value);
                          if (e.key === "Escape") setEditingTarget(null);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingTarget(row.stockName)}
                        className="flex flex-col items-center gap-0.5 mx-auto text-xs font-mono"
                      >
                        {row.targetPrice !== null ? (
                          <>
                            <span className={targetReached ? "text-green-500 font-semibold" : "text-accent"}>
                              {targetReached && "✓ "}₹{fmt(row.targetPrice)}
                              {row.targetGap !== null && !targetReached && (
                                <span className="text-muted-foreground ml-1">({pct(row.targetGap)} away)</span>
                              )}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {row.targetSetAt}
                              {row.targetHistory.length > 0 && ` · ${row.targetHistory.length} prev`}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" /> Set
                          </span>
                        )}
                      </button>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {row.live?.high52 && row.live?.low52 ? (
                      <div className="text-xs font-mono text-muted-foreground">
                        <span className="text-red-400">₹{fmt(row.live.low52)}</span>
                        <span className="mx-1">–</span>
                        <span className="text-green-400">₹{fmt(row.live.high52)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {hasPrices && (
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/50 font-semibold text-sm">
                <td className="px-4 py-3 text-xs uppercase tracking-wider" colSpan={5}>
                  Total
                </td>
                <td className="px-4 py-3 font-mono text-right">₹{fmt(liveInvested)}</td>
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
                <td colSpan={3} className="px-4 py-3 font-mono text-right">
                  {totalDividends > 0 && <span className="text-green-500">₹{fmt(totalDividends)}</span>}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
