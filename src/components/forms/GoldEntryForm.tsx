import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldEntry } from "@/types/investment";
import { GoldPriceData } from "@/hooks/useGoldPrice";
import { calculateGoldRealizedPnL } from "@/lib/calculations";
import { fmt } from "@/lib/format";
import { Plus, Pencil, RefreshCw, TrendingUp, TrendingDown, Check, X } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface Props {
  onAdd: (entry: Omit<GoldEntry, "id">) => void;
  onEdit: (entry: GoldEntry) => void;
  entries: GoldEntry[];
  onDelete: (id: string) => void;
  goldPrice: GoldPriceData | null;
  loadingPrice: boolean;
  onRefreshPrice: () => void;
}

interface SellFormState {
  sellDate: string;
  sellAmount: string;
  sellCharges: string;
  sellNotes: string;
}

export default function GoldEntryForm({ onAdd, onEdit, entries, onDelete, goldPrice, loadingPrice, onRefreshPrice }: Props) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    quality: "22K" as "18K" | "22K" | "24K",
    quantity: "",
    charges: "",
    amount: "",
    tax: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellForm, setSellForm] = useState<SellFormState>({
    sellDate: new Date().toISOString().split("T")[0],
    sellAmount: "",
    sellCharges: "",
    sellNotes: "",
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [submittingSell, setSubmittingSell] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const openEntries = useMemo(() => entries.filter((e) => e.status !== "sold"), [entries]);
  const trades = useMemo(() => calculateGoldRealizedPnL(entries), [entries]);

  const handleEdit = (entry: GoldEntry) => {
    setSellingId(null);
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      quality: entry.quality ?? "22K",
      quantity: String(entry.quantity),
      charges: String(entry.charges),
      amount: String(entry.amount),
      tax: String(entry.tax),
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ date: new Date().toISOString().split("T")[0], quality: "22K", quantity: "", charges: "", amount: "", tax: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.quantity) return;
    if (editingId) {
      const existing = entries.find((e) => e.id === editingId);
      onEdit({
        id: editingId,
        date: form.date,
        quality: form.quality,
        quantity: parseFloat(form.quantity),
        charges: parseFloat(form.charges) || 0,
        amount: parseFloat(form.amount),
        tax: parseFloat(form.tax) || 0,
        status: existing?.status ?? "hold",
      });
      setEditingId(null);
    } else {
      onAdd({
        date: form.date,
        quality: form.quality,
        quantity: parseFloat(form.quantity),
        charges: parseFloat(form.charges) || 0,
        amount: parseFloat(form.amount),
        tax: parseFloat(form.tax) || 0,
      });
    }
    setForm((prev) => ({ ...prev, quantity: "", charges: "", amount: "", tax: "" }));
  };

  const startSell = (entry: GoldEntry) => {
    setEditingId(null);
    setSellingId(entry.id);
    setSellForm({
      sellDate: new Date().toISOString().split("T")[0],
      sellAmount: "",
      sellCharges: "",
      sellNotes: "",
    });
  };

  const handleConfirmSell = async (entry: GoldEntry) => {
    if (!sellForm.sellAmount || submittingSell) return;
    setSubmittingSell(true);
    onEdit({
      ...entry,
      status: "sold",
      sellDate: sellForm.sellDate,
      sellAmount: parseFloat(sellForm.sellAmount),
      sellCharges: parseFloat(sellForm.sellCharges) || 0,
      sellNotes: sellForm.sellNotes.trim() || undefined,
    });
    setSellingId(null);
    setSubmittingSell(false);
  };

  const handleUnsell = (entry: GoldEntry) => {
    const { sellDate, sellAmount, sellCharges, sellNotes, status, ...rest } = entry;
    onEdit({ ...rest, status: "hold" });
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateSell = (field: keyof SellFormState, value: string) => setSellForm((p) => ({ ...p, [field]: value }));

  function liveRateForQuality(q?: string) {
    if (!goldPrice) return null;
    if (q === "24K") return goldPrice.retail24k;
    if (q === "18K") return goldPrice.retail18k;
    return goldPrice.retail22k;
  }

  const totalQty = openEntries.reduce((s, e) => s + e.quantity, 0);
  const totalInvested = openEntries.reduce((s, e) => s + e.amount, 0);
  const avgCostPerGram = totalQty > 0 ? totalInvested / totalQty : 0;
  const totalCurrentValue = goldPrice
    ? openEntries.reduce((s, e) => s + (liveRateForQuality(e.quality) ?? 0) * e.quantity, 0)
    : null;
  const totalPnl = totalCurrentValue !== null ? totalCurrentValue - totalInvested : null;
  const totalPnlPct = totalPnl !== null && totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;

  const totalRealizedPnl = trades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="space-y-5">

      {/* Live price banner */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🥇</span>
            <h3 className="font-semibold text-sm">Live Gold Price</h3>
            <span className="text-xs text-muted-foreground hidden sm:inline">(NSE market price + import duty + GST)</span>
          </div>
          <button
            onClick={onRefreshPrice}
            disabled={loadingPrice}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loadingPrice ? "animate-spin" : ""}`} />
            {loadingPrice ? "Loading…" : goldPrice ? "Refresh" : "Load Price"}
          </button>
        </div>
        {goldPrice ? (
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">24K / gram</p>
                <p className="font-mono font-bold text-xl">₹{fmt(goldPrice.retail24k)}</p>
                <p className="text-[11px] text-muted-foreground">retail incl. GST</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">22K / gram</p>
                <p className="font-mono font-bold text-xl text-primary">₹{fmt(goldPrice.retail22k)}</p>
                <p className="text-[11px] text-muted-foreground">retail incl. GST</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">18K / gram</p>
                <p className="font-mono font-bold text-xl">₹{fmt(goldPrice.retail18k)}</p>
                <p className="text-[11px] text-muted-foreground">retail incl. GST</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Day change (24K)</p>
                <p className={`font-mono font-bold text-xl ${!goldPrice.changePct ? "" : goldPrice.changePct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {goldPrice.changePct !== null ? `${goldPrice.changePct >= 0 ? "+" : ""}${goldPrice.changePct.toFixed(2)}%` : "—"}
                </p>
                {goldPrice.change !== null && (
                  <p className="text-[11px] text-muted-foreground">
                    {goldPrice.change >= 0 ? "+" : ""}₹{fmt(Math.abs(goldPrice.change))}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Spot ₹{fmt(goldPrice.spot24k)}/g · {goldPrice.source} · Updated {new Date(goldPrice.updatedAt).toLocaleTimeString("en-IN")} · Making charges not included
            </p>
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-muted-foreground text-center">
            {loadingPrice ? "Fetching live gold price…" : "Click \"Load Price\" above to fetch current gold rate"}
          </div>
        )}
      </div>

      {/* Summary stats — open positions only */}
      {openEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
            <p className="font-mono font-bold text-lg text-primary">₹{fmt(totalInvested)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{totalQty.toFixed(3)} g open</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Avg Cost / g</p>
            <p className="font-mono font-bold text-lg">₹{fmt(avgCostPerGram)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">blended avg</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Current Value</p>
            <p className="font-mono font-bold text-lg">{totalCurrentValue !== null ? `₹${fmt(totalCurrentValue)}` : "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">per-quality rate</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Unrealized P&L</p>
            <p className={`font-mono font-bold text-lg ${totalPnl === null ? "" : totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {totalPnl !== null ? `${totalPnl >= 0 ? "+" : "−"}₹${fmt(Math.abs(totalPnl))}` : "—"}
            </p>
            {totalPnlPct !== null && (
              <p className={`text-[11px] font-mono mt-0.5 ${totalPnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
              </p>
            )}
          </div>
        </div>
      )}

      {/* Realized P&L summary (when any gold is sold) */}
      {trades.length > 0 && (
        <div className={`rounded-xl border px-5 py-3.5 ${totalRealizedPnl >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Realized P&L (gold sold)</p>
            <p className={`font-mono font-bold text-lg ${totalRealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {totalRealizedPnl >= 0 ? "+" : "−"}₹{fmt(Math.abs(totalRealizedPnl))}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{trades.length} sale{trades.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* Add / Edit form */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold text-sm">{editingId ? "Edit Purchase" : "Add Purchase"}</h3>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="p-5 grid grid-cols-2 md:grid-cols-7 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
            <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className="bg-secondary border-border font-mono" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quality</Label>
            <select
              value={form.quality}
              onChange={(e) => update("quality", e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="22K">22K</option>
              <option value="24K">24K</option>
              <option value="18K">18K</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity (g)</Label>
            <Input type="number" step="0.001" min="0" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} placeholder="0.000" className="bg-secondary border-border font-mono" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Amount (₹)</Label>
            <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0.00" className="bg-secondary border-border font-mono" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Charges (₹)</Label>
            <Input type="number" step="0.01" min="0" value={form.charges} onChange={(e) => update("charges", e.target.value)} placeholder="0.00" className="bg-secondary border-border font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tax (₹)</Label>
            <Input type="number" step="0.01" min="0" value={form.tax} onChange={(e) => update("tax", e.target.value)} placeholder="0.00" className="bg-secondary border-border font-mono" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 gap-1.5">
              {editingId ? <><Pencil className="h-3.5 w-3.5" /> Save</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
            </Button>
            {editingId && <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>}
          </div>
        </form>
      </div>

      {/* Open positions table */}
      {openEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-sm">Open Positions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Quality</th>
                  <th className="px-4 py-3 text-right">Qty (g)</th>
                  <th className="px-4 py-3 text-right">Invested</th>
                  <th className="px-4 py-3 text-right">Cost / g</th>
                  {goldPrice && <th className="px-4 py-3 text-right">Curr. Value</th>}
                  {goldPrice && <th className="px-4 py-3 text-right">P&L</th>}
                  <th className="px-4 py-3 text-right">Charges</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...openEntries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => {
                  const costPerGram = entry.quantity > 0 ? entry.amount / entry.quantity : 0;
                  const entryRate = liveRateForQuality(entry.quality);
                  const currValue = entryRate !== null ? entryRate * entry.quantity : null;
                  const pnl = currValue !== null ? currValue - entry.amount : null;
                  const pnlPct = pnl !== null && entry.amount > 0 ? (pnl / entry.amount) * 100 : null;
                  const isSelling = sellingId === entry.id;
                  return (
                    <>
                      <tr key={entry.id} className="border-t border-border hover:bg-secondary/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-muted-foreground">{entry.date}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{entry.quality ?? "22K"}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-right">{entry.quantity.toFixed(3)}</td>
                        <td className="px-4 py-3 font-mono text-right">₹{fmt(entry.amount)}</td>
                        <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(costPerGram)}</td>
                        {goldPrice && (
                          <td className="px-4 py-3 font-mono text-right">{currValue !== null ? `₹${fmt(currValue)}` : "—"}</td>
                        )}
                        {goldPrice && (
                          <td className="px-4 py-3 font-mono text-right">
                            {pnl !== null ? (
                              <div className="flex items-center justify-end gap-1">
                                {pnl >= 0
                                  ? <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                                  : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />}
                                <span className={pnl >= 0 ? "text-emerald-500" : "text-red-500"}>
                                  {pnl >= 0 ? "+" : "−"}₹{fmt(Math.abs(pnl))}
                                </span>
                                {pnlPct !== null && (
                                  <span className={`text-[11px] ${pnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                    ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            ) : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(entry.charges)}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isSelling ? (
                            <button onClick={() => setSellingId(null)} className="text-muted-foreground hover:text-foreground text-xs font-medium">Cancel</button>
                          ) : (
                            <>
                              <button onClick={() => handleEdit(entry)} className="text-primary hover:text-primary/80 text-xs font-medium mr-3">Edit</button>
                              <button onClick={() => startSell(entry)} className="text-amber-500 hover:text-amber-400 text-xs font-medium mr-3">Sell</button>
                              <button onClick={() => setPendingDeleteId(entry.id)} className="text-destructive hover:text-destructive/80 text-xs font-medium">Delete</button>
                            </>
                          )}
                        </td>
                      </tr>

                      {isSelling && (
                        <tr key={`${entry.id}-sell`} className="border-t border-amber-500/30 bg-amber-500/5">
                          <td colSpan={goldPrice ? 9 : 7} className="px-4 py-3">
                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Sell Date</p>
                                <Input type="date" value={sellForm.sellDate} onChange={(e) => updateSell("sellDate", e.target.value)}
                                  className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Sale Amount (₹)</p>
                                <Input type="number" step="0.01" min="0" value={sellForm.sellAmount}
                                  onChange={(e) => updateSell("sellAmount", e.target.value)}
                                  placeholder="total proceeds" className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Charges (₹)</p>
                                <Input type="number" step="0.01" min="0" value={sellForm.sellCharges}
                                  onChange={(e) => updateSell("sellCharges", e.target.value)}
                                  placeholder="0" className="bg-secondary border-border font-mono h-8 text-sm w-28" />
                              </div>
                              <div className="space-y-1 flex-1 min-w-40">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes (optional)</p>
                                <Input value={sellForm.sellNotes} onChange={(e) => updateSell("sellNotes", e.target.value)}
                                  placeholder="reason…" className="bg-secondary border-border h-8 text-sm" />
                              </div>
                              {sellForm.sellAmount && (
                                <div className="text-xs font-mono pb-1 text-muted-foreground">
                                  P&L:{" "}
                                  {(() => {
                                    const net = parseFloat(sellForm.sellAmount) - (parseFloat(sellForm.sellCharges) || 0) - entry.amount;
                                    return (
                                      <span className={net >= 0 ? "text-emerald-500" : "text-red-500"}>
                                        {net >= 0 ? "+" : ""}₹{fmt(net)}
                                      </span>
                                    );
                                  })()}
                                </div>
                              )}
                              <Button size="sm" className="gap-1 h-8 bg-amber-500 hover:bg-amber-400 text-white"
                                onClick={() => handleConfirmSell(entry)}
                                disabled={!sellForm.sellAmount || submittingSell}>
                                <Check className="h-3.5 w-3.5" /> {submittingSell ? "Saving…" : "Confirm Sell"}
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

      {/* Closed positions (realized trades) */}
      {trades.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Closed Positions</h3>
            <span className={`text-sm font-mono font-bold ${totalRealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {totalRealizedPnl >= 0 ? "+" : "−"}₹{fmt(Math.abs(totalRealizedPnl))} realized
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground">
                  <th className="px-4 py-3 text-left">Buy Date</th>
                  <th className="px-4 py-3 text-left">Sell Date</th>
                  <th className="px-4 py-3 text-center">Quality</th>
                  <th className="px-4 py-3 text-right">Qty (g)</th>
                  <th className="px-4 py-3 text-right">Buy Amt</th>
                  <th className="px-4 py-3 text-right">Net Proceeds</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3 text-right">Days Held</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const entry = entries.find((e) => e.id === t.id);
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{t.buyDate}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{t.sellDate}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{t.quality ?? "22K"}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-right">{t.quantity.toFixed(3)}</td>
                      <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(t.buyAmount)}</td>
                      <td className="px-4 py-3 font-mono text-right">₹{fmt(t.netSellAmount)}</td>
                      <td className="px-4 py-3 font-mono text-right">
                        <span className={t.pnl >= 0 ? "text-emerald-500" : "text-red-500"}>
                          {t.pnl >= 0 ? "+" : ""}₹{fmt(t.pnl)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-muted-foreground">{t.holdDays}d</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => entry && handleUnsell(entry)}
                          title="Undo sell"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete gold entry?"
        description="This will permanently remove this gold purchase record."
        onConfirm={() => { onDelete(pendingDeleteId!); setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
