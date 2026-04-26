import { useState, useMemo } from "react";
import { InvestmentEntry } from "@/types/investment";
import { calculateRealizedPnL } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, X, Check } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface Props {
  entries: InvestmentEntry[];
  onAdd: (entry: Omit<InvestmentEntry, "id">) => Promise<void>;
  onEdit: (entry: InvestmentEntry) => Promise<void>;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SellFormState {
  sellDate: string;
  sellQty: string;
  sellAmount: string;
  sellCharges: string;
  sellNotes: string;
}

interface Holding {
  stockName: string;
  totalQty: number;
  totalAmount: number;
  avgPrice: number;
  lots: InvestmentEntry[];
}

export default function SellForm({ entries, onAdd, onEdit }: Props) {
  const [sellingStock, setSellingStock] = useState<string | null>(null);
  const [form, setForm] = useState<SellFormState>({
    sellDate: new Date().toISOString().split("T")[0],
    sellQty: "",
    sellAmount: "",
    sellCharges: "",
    sellNotes: "",
  });
  const [pendingUnsellId, setPendingUnsellId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const holdEntries = useMemo(() => entries.filter((e) => e.status !== "sold"), [entries]);
  const trades = useMemo(() => calculateRealizedPnL(entries), [entries]);

  // Consolidated holdings grouped by stock name
  const holdings = useMemo<Holding[]>(() => {
    const map = new Map<string, Holding>();
    for (const e of holdEntries) {
      const key = e.stockName.trim().toUpperCase();
      if (!map.has(key)) {
        map.set(key, { stockName: e.stockName.trim(), totalQty: 0, totalAmount: 0, avgPrice: 0, lots: [] });
      }
      const h = map.get(key)!;
      h.totalQty += e.quantity;
      h.totalAmount += e.amount;
      h.lots.push(e);
    }
    for (const h of map.values()) {
      h.avgPrice = h.totalQty > 0 ? h.totalAmount / h.totalQty : 0;
      // Sort oldest first for FIFO
      h.lots.sort((a, b) => a.date.localeCompare(b.date));
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [holdEntries]);

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const stcgTotal = trades.filter((t) => !t.isLongTerm).reduce((s, t) => s + t.pnl, 0);
  const ltcgTotal = trades.filter((t) => t.isLongTerm).reduce((s, t) => s + t.pnl, 0);

  const startSell = (holding: Holding) => {
    setSellingStock(holding.stockName.trim().toUpperCase());
    setForm({
      sellDate: new Date().toISOString().split("T")[0],
      sellQty: String(holding.totalQty),
      sellAmount: "",
      sellCharges: "",
      sellNotes: "",
    });
  };

  // FIFO allocation across lots
  const handleSell = async (holding: Holding) => {
    if (!form.sellAmount || submitting) return;
    setSubmitting(true);

    const sellQty = Math.min(parseFloat(form.sellQty) || holding.totalQty, holding.totalQty);
    const totalSellAmount = parseFloat(form.sellAmount);
    const totalCharges = parseFloat(form.sellCharges) || 0;
    const sellNotes = form.sellNotes.trim() || undefined;

    let remaining = sellQty;
    for (const lot of holding.lots) {
      if (remaining <= 0) break;
      const lotSellQty = Math.min(remaining, lot.quantity);
      const ratio = lotSellQty / sellQty;
      const lotSellAmount = totalSellAmount * ratio;
      const lotSellCharges = totalCharges * ratio;

      if (lotSellQty === lot.quantity) {
        await onEdit({ ...lot, status: "sold", sellDate: form.sellDate, sellAmount: lotSellAmount, sellCharges: lotSellCharges, sellNotes });
      } else {
        const costRatio = lotSellQty / lot.quantity;
        const soldCost = lot.amount * costRatio;
        await onAdd({
          stockName: lot.stockName, sector: lot.sector, date: lot.date,
          amount: soldCost, quantity: lotSellQty, charges: lot.charges * costRatio,
          notes: lot.notes,
          status: "sold", sellDate: form.sellDate, sellAmount: lotSellAmount, sellCharges: lotSellCharges, sellNotes,
        });
        await onEdit({ ...lot, quantity: lot.quantity - lotSellQty, amount: lot.amount - soldCost, charges: lot.charges * (1 - costRatio) });
      }
      remaining -= lotSellQty;
    }

    setSubmitting(false);
    setSellingStock(null);
  };

  const handleUnsell = (entry: InvestmentEntry) => {
    const { sellDate, sellAmount, sellCharges, sellNotes, status, ...rest } = entry;
    onEdit({ ...rest, status: "hold" });
    setPendingUnsellId(null);
  };

  const update = (field: keyof SellFormState, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mb-4 opacity-30" />
        <p>No stock entries yet. Add stocks first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Open positions — consolidated */}
      {holdings.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary border-b border-border">
            <h3 className="text-sm font-semibold">Open Positions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3 text-right">Total Invested</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Lots</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const key = holding.stockName.trim().toUpperCase();
                  const isOpen = sellingStock === key;
                  return (
                    <>
                      <tr key={key} className="border-t border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-primary">{holding.stockName}</td>
                        <td className="px-4 py-3 font-mono text-right">{holding.totalQty}</td>
                        <td className="px-4 py-3 font-mono text-right">₹{fmt(holding.totalAmount)}</td>
                        <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(holding.avgPrice)}</td>
                        <td className="px-4 py-3 font-mono text-right text-muted-foreground">{holding.lots.length}</td>
                        <td className="px-4 py-3 text-center">
                          {isOpen ? (
                            <button onClick={() => setSellingStock(null)} className="text-muted-foreground hover:text-foreground text-xs font-medium">Cancel</button>
                          ) : (
                            <button onClick={() => startSell(holding)} className="text-primary hover:text-primary/80 text-xs font-medium transition-colors">
                              Sell
                            </button>
                          )}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${key}-sell`} className="border-t border-primary/30 bg-primary/5">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Sell Date</p>
                                <Input type="date" value={form.sellDate} onChange={(e) => update("sellDate", e.target.value)}
                                  className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Qty (max {holding.totalQty})</p>
                                <Input type="number" step="1" min="1" max={holding.totalQty} value={form.sellQty}
                                  onChange={(e) => update("sellQty", e.target.value)}
                                  className="bg-secondary border-border font-mono h-8 text-sm w-24" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Sale Amount (₹)</p>
                                <Input type="number" step="0.01" min="0" value={form.sellAmount}
                                  onChange={(e) => update("sellAmount", e.target.value)}
                                  placeholder="e.g. 15000" className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Charges (₹)</p>
                                <Input type="number" step="0.01" min="0" value={form.sellCharges}
                                  onChange={(e) => update("sellCharges", e.target.value)}
                                  placeholder="0" className="bg-secondary border-border font-mono h-8 text-sm w-28" />
                              </div>
                              <div className="space-y-1 flex-1 min-w-40">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes (optional)</p>
                                <Input value={form.sellNotes} onChange={(e) => update("sellNotes", e.target.value)}
                                  placeholder="why sold…" className="bg-secondary border-border h-8 text-sm" />
                              </div>
                              {form.sellAmount && (
                                <div className="text-xs font-mono pb-1 text-muted-foreground">
                                  P&L:{" "}
                                  {(() => {
                                    const qty = Math.min(parseFloat(form.sellQty) || holding.totalQty, holding.totalQty);
                                    const costBasis = holding.totalAmount * (qty / holding.totalQty);
                                    const net = parseFloat(form.sellAmount) - (parseFloat(form.sellCharges) || 0) - costBasis;
                                    return (
                                      <span className={net >= 0 ? "text-green-500" : "text-red-500"}>
                                        {net >= 0 ? "+" : ""}₹{fmt(net)}
                                      </span>
                                    );
                                  })()}
                                </div>
                              )}
                              <Button size="sm" className="gap-1 h-8" onClick={() => handleSell(holding)}
                                disabled={!form.sellAmount || submitting}>
                                <Check className="h-3.5 w-3.5" /> {submitting ? "Saving…" : "Confirm Sell"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {trades.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Realized P&L", value: totalPnl, sub: `${trades.length} trades` },
            { label: "STCG (< 1 yr)", value: stcgTotal, sub: `${trades.filter(t => !t.isLongTerm).length} trades · 15% tax` },
            { label: "LTCG (> 1 yr)", value: ltcgTotal, sub: `${trades.filter(t => t.isLongTerm).length} trades · 10% above ₹1L` },
            { label: "Net after est. tax", value: totalPnl - Math.max(0, stcgTotal) * 0.15 - Math.max(0, ltcgTotal - 100000) * 0.10, sub: "rough estimate" },
          ].map(({ label, value, sub }) => (
            <div key={label} className={`rounded-lg border p-4 ${value >= 0 ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={`font-mono font-semibold text-lg mt-1 ${value >= 0 ? "text-green-500" : "text-red-500"}`}>
                {value >= 0 ? "+" : ""}₹{fmt(value)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Closed positions */}
      {trades.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary border-b border-border">
            <h3 className="text-sm font-semibold">Closed Positions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Buy Date</th>
                  <th className="px-4 py-3 text-left">Sell Date</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Buy Amt</th>
                  <th className="px-4 py-3 text-right">Sell Amt</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-muted-foreground">{t.stockName}</span>
                      {t.sellNotes && <p className="text-xs text-muted-foreground/60 italic mt-0.5 truncate max-w-xs" title={t.sellNotes}>{t.sellNotes}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{t.buyDate}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{t.sellDate}</td>
                    <td className="px-4 py-3 font-mono text-right">{t.quantity}</td>
                    <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(t.costBasis)}</td>
                    <td className="px-4 py-3 font-mono text-right">₹{fmt(t.sellAmount)}</td>
                    <td className="px-4 py-3 font-mono text-right">
                      <span className={t.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                        {t.pnl >= 0 ? "+" : ""}₹{fmt(t.pnl)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">({t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%)</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.isLongTerm ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"}`}>
                        {t.isLongTerm ? "LTCG" : "STCG"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setPendingUnsellId(t.id)}
                        className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trades.length === 0 && holdings.length > 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
          <p>No sold positions yet. Click "Sell" on any holding above.</p>
        </div>
      )}

      <ConfirmDialog
        open={pendingUnsellId !== null}
        title="Undo sell?"
        description="This will restore the entry to an active holding and remove all sell data."
        onConfirm={() => {
          const entry = entries.find((e) => e.id === pendingUnsellId);
          if (entry) handleUnsell(entry);
        }}
        onCancel={() => setPendingUnsellId(null)}
      />
    </div>
  );
}
