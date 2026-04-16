import { InvestmentEntry, GoldEntry } from "@/types/investment";
import { BarChart3, TrendingUp } from "lucide-react";

interface Props {
  stockEntries: InvestmentEntry[];
  goldEntries: GoldEntry[];
}

export default function Comparison({ stockEntries, goldEntries }: Props) {
  const totalStock = stockEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalGold = goldEntries.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = totalStock + totalGold;
  const stockPct = grandTotal > 0 ? (totalStock / grandTotal) * 100 : 0;
  const goldPct = grandTotal > 0 ? (totalGold / grandTotal) * 100 : 0;
  const totalGoldQty = goldEntries.reduce((sum, e) => sum + e.quantity, 0);
  const goldAvgPrice = totalGoldQty > 0 ? totalGold / totalGoldQty : 0;

  if (grandTotal === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
        <p>No data. Add stock or gold entries first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Grand Total */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm uppercase tracking-wider">Total Portfolio Value</span>
        </div>
        <p className="text-4xl font-mono font-bold text-primary">
          ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Stocks
            </h3>
            <span className="font-mono text-2xl font-bold text-primary">{stockPct.toFixed(1)}%</span>
          </div>
          <p className="text-2xl font-mono font-bold">₹{totalStock.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stockPct}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">{stockEntries.length} entries across {new Set(stockEntries.map(e => e.stockName)).size} stocks</p>
        </div>

        {/* Gold Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ borderColor: 'hsl(43, 80%, 50%)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-xl">🥇</span> Gold
            </h3>
            <span className="font-mono text-2xl font-bold" style={{ color: 'hsl(43, 80%, 42%)' }}>{goldPct.toFixed(1)}%</span>
          </div>
          <p className="text-2xl font-mono font-bold">₹{totalGold.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${goldPct}%`, backgroundColor: 'hsl(43, 80%, 50%)' }} />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{totalGoldQty.toFixed(3)}g total</span>
            <span>Avg: ₹{goldAvgPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}/g</span>
          </div>
        </div>
      </div>

      {/* Visual Bar */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Allocation Split</h3>
        <div className="flex h-10 rounded-lg overflow-hidden">
          {stockPct > 0 && (
            <div className="bg-primary flex items-center justify-center text-primary-foreground text-sm font-mono font-semibold transition-all" style={{ width: `${stockPct}%` }}>
              {stockPct > 10 && `Stocks ${stockPct.toFixed(1)}%`}
            </div>
          )}
          {goldPct > 0 && (
            <div className="flex items-center justify-center text-sm font-mono font-semibold transition-all" style={{ width: `${goldPct}%`, backgroundColor: 'hsl(43, 80%, 50%)', color: 'white' }}>
              {goldPct > 10 && `Gold ${goldPct.toFixed(1)}%`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
