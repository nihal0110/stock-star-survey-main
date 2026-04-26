import { useMemo } from "react";
import { InvestmentEntry, DividendEntry } from "@/types/investment";
import { calculatePortfolio } from "@/lib/calculations";
import { fmt, daysHeld } from "@/lib/format";
import { TrendingUp, PieChart, Gift } from "lucide-react";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries?: DividendEntry[];
  title?: string;
}

export default function PortfolioOverview({
  entries,
  dividendEntries = [],
  title = "Portfolio Overview",
}: Props) {
  const { totalInvested, stocks, sectors, totalDividends } = useMemo(
    () => calculatePortfolio(entries, dividendEntries),
    [entries, dividendEntries],
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <PieChart className="h-12 w-12 mb-4 opacity-30" />
        <p>No data to display. Add entries first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-muted-foreground text-sm uppercase tracking-wider">
              {title} — Total Invested
            </span>
          </div>
          <p className="text-4xl font-mono font-bold text-primary">₹{fmt(totalInvested)}</p>
        </div>

        {totalDividends > 0 && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-1">
              <Gift className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground text-sm uppercase tracking-wider">
                Dividends Reinvested
              </span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground">₹{fmt(totalDividends)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {((totalDividends / totalInvested) * 100).toFixed(2)}% yield · compounding via reinvestment
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Stock Breakdown
        </h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Sector</th>
                  <th className="px-4 py-3 text-right">Total Invested</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Days Held</th>
                  <th className="px-4 py-3 text-right">Dividends</th>
                  <th className="px-4 py-3 text-right">Allocation %</th>
                </tr>
              </thead>
              <tbody>
                {stocks
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((stock) => (
                    <tr
                      key={stock.stockName}
                      className="border-t border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {stock.stockName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{stock.sector}</td>
                      <td className="px-4 py-3 font-mono text-right">₹{fmt(stock.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono text-right">{stock.totalQuantity}</td>
                      <td className="px-4 py-3 font-mono text-right">₹{fmt(stock.avgPrice)}</td>
                      <td className="px-4 py-3 font-mono text-right text-muted-foreground">
                        {daysHeld(stock.firstPurchaseDate)}d
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {stock.totalDividend > 0 ? (
                          <div>
                            <span className="text-foreground">₹{fmt(stock.totalDividend)}</span>
                            <p className="text-[10px] text-muted-foreground">
                              {((stock.totalDividend / stock.totalAmount) * 100).toFixed(2)}% ↺
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(stock.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-accent w-14 text-right">
                            {stock.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Sector Allocation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors
            .sort((a, b) => b.percentage - a.percentage)
            .map((sector) => (
              <div key={sector.sector} className="rounded-lg border border-border bg-card p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{sector.sector}</span>
                  <span className="font-mono text-accent font-semibold">
                    {sector.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(sector.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  ₹{fmt(sector.totalAmount)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
