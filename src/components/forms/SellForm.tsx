import { useState, useMemo, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from "recharts";
import { InvestmentEntry, SellEntry, HoldingData } from "@/types/investment";
import { computeActiveEntries, calculateRealizedPnLFromSells, RealizedTrade } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, X, Check, Trophy, AlertTriangle,
  BarChart2, Percent, DollarSign,
} from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { CHART_TOOLTIP_STYLE } from "@/lib/expense-utils";

interface Props {
  entries: InvestmentEntry[];         // all buy records (for FIFO lot breakdown)
  sellEntries: SellEntry[];
  holdings: HoldingData[];            // server-maintained current positions
  onAddSell: (entry: Omit<SellEntry, "id">) => Promise<void>;
  onDeleteSell: (id: string) => Promise<void>;
}

interface SellFormState {
  sellDate: string;
  sellQty: string;
  sellAmount: string;
  sellCharges: string;
  sellNotes: string;
}

// Per-stock lot breakdown computed from buy entries (for FIFO display when selling)
interface LotGroup {
  lots: InvestmentEntry[];
  remainingQty: number;
}

function fmtN(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtS(n: number, short = false) {
  if (short) {
    if (Math.abs(n) >= 100_000) return "₹" + (n / 100_000).toFixed(1) + "L";
    if (Math.abs(n) >= 1_000)   return "₹" + (n / 1_000).toFixed(1) + "K";
    return "₹" + n.toFixed(0);
  }
  return "₹" + fmtN(n);
}
function sign(n: number) { return n >= 0 ? "+" : ""; }
function pnlColor(n: number) { return n >= 0 ? "text-emerald-500" : "text-red-500"; }
function pnlBorder(n: number) { return n >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"; }

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, valueClass = "", icon }: {
  label: string; value: string; sub?: string; valueClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className={`font-mono font-bold text-xl ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

export default function SellForm({ entries, sellEntries, holdings, onAddSell, onDeleteSell }: Props) {
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [sellingStock, setSellingStock] = useState<string | null>(null);
  const [form, setForm] = useState<SellFormState>({
    sellDate: new Date().toISOString().split("T")[0],
    sellQty: "", sellAmount: "", sellCharges: "", sellNotes: "",
  });
  const [pendingUnsellId, setPendingUnsellId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());

  // Sell history — FIFO-matched P&L from buy records + sell records
  const trades = useMemo(() => calculateRealizedPnLFromSells(entries, sellEntries), [entries, sellEntries]);

  // FIFO lot groups per stock (for the lot breakdown when selling)
  const lotGroups = useMemo<Map<string, LotGroup>>(() => {
    const activeEntries = computeActiveEntries(entries, sellEntries);
    const map = new Map<string, LotGroup>();
    for (const e of activeEntries) {
      const key = e.stockName.trim().toUpperCase();
      if (!map.has(key)) map.set(key, { lots: [], remainingQty: 0 });
      const g = map.get(key)!;
      g.lots.push(e);
      g.remainingQty += e.quantity;
    }
    for (const g of map.values()) g.lots.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [entries, sellEntries]);

  // All unique sold stock names for the filter chips
  const allSoldStocks = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; name: string }[] = [];
    for (const t of trades) {
      const key = t.stockName.trim().toUpperCase();
      if (!seen.has(key)) { seen.add(key); list.push({ key, name: t.stockName.trim() }); }
    }
    return list.sort((a, b) => a.key.localeCompare(b.key));
  }, [trades]);

  const toggleStock = (key: string) =>
    setSelectedStocks(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // When selection is empty → show everything; otherwise filter
  const filteredTrades = useMemo(() =>
    selectedStocks.size === 0
      ? trades
      : trades.filter(t => selectedStocks.has(t.stockName.trim().toUpperCase())),
  [trades, selectedStocks]);

  // holdings prop = server-maintained current positions (bought - sold per stock)

  // ── Realized P&L analytics — scoped to filteredTrades ────────────────────
  const totalPnl   = filteredTrades.reduce((s, t) => s + t.pnl, 0);
  const stcgTotal  = filteredTrades.filter(t => !t.isLongTerm).reduce((s, t) => s + t.pnl, 0);
  const ltcgTotal  = filteredTrades.filter(t =>  t.isLongTerm).reduce((s, t) => s + t.pnl, 0);
  const taxEst     = Math.max(0, stcgTotal) * 0.15 + Math.max(0, ltcgTotal - 100_000) * 0.10;
  const netAfterTax = totalPnl - taxEst;

  const winTrades  = filteredTrades.filter(t => t.pnl > 0).length;
  const lossTrades = filteredTrades.filter(t => t.pnl < 0).length;
  const winRate    = filteredTrades.length > 0 ? (winTrades / filteredTrades.length) * 100 : 0;

  const bestTrade  = filteredTrades.length ? filteredTrades.reduce((b, t) => t.pnlPct > b.pnlPct ? t : b) : null;
  const worstTrade = filteredTrades.length > 1 ? filteredTrades.reduce((w, t) => t.pnlPct < w.pnlPct ? t : w) : null;

  const totalCostSold = filteredTrades.reduce((s, t) => s + t.costBasis, 0);
  const totalSellAmt  = filteredTrades.reduce((s, t) => s + t.sellAmount, 0);
  const avgHoldDays   = filteredTrades.length ? Math.round(filteredTrades.reduce((s, t) => s + t.holdDays, 0) / filteredTrades.length) : 0;

  // P&L grouped by sell month for bar chart
  const pnlByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTrades) {
      const m = t.sellDate.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + t.pnl);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, pnl]) => ({
        label: new Date(m + "-15").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        pnl: parseFloat(pnl.toFixed(2)),
      }));
  }, [filteredTrades]);

  // Per-stock realized summary
  const stockSummary = useMemo(() => {
    const map = new Map<string, {
      stockName: string; trades: number; costBasis: number;
      sellAmount: number; pnl: number; wins: number; stcg: number; ltcg: number;
    }>();
    for (const t of filteredTrades) {
      const key = t.stockName.trim().toUpperCase();
      if (!map.has(key))
        map.set(key, { stockName: t.stockName, trades: 0, costBasis: 0, sellAmount: 0, pnl: 0, wins: 0, stcg: 0, ltcg: 0 });
      const s = map.get(key)!;
      s.trades++;
      s.costBasis  += t.costBasis;
      s.sellAmount += t.sellAmount;
      s.pnl        += t.pnl;
      if (t.pnl > 0) s.wins++;
      if (t.isLongTerm) s.ltcg += t.pnl; else s.stcg += t.pnl;
    }
    return Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  // ── Sell actions ──────────────────────────────────────────────────────────
  const startSell = (h: HoldingData) => {
    setSellingStock(h.stockName.trim().toUpperCase());
    setForm({ sellDate: new Date().toISOString().split("T")[0], sellQty: String(h.qty), sellAmount: "", sellCharges: "", sellNotes: "" });
  };

  const handleSell = async (h: HoldingData) => {
    if (!form.sellAmount || submitting) return;
    setSubmitting(true);
    await onAddSell({
      stockName: h.stockName,
      sector: h.sector,
      sellDate: form.sellDate,
      quantity: Math.min(parseFloat(form.sellQty) || h.qty, h.qty),
      sellAmount: parseFloat(form.sellAmount),
      sellCharges: parseFloat(form.sellCharges) || 0,
      sellNotes: form.sellNotes.trim() || undefined,
    });
    setSubmitting(false);
    setSellingStock(null);
  };

  // Undo a sell by deleting the sell entry (trade.sellId for new-style; trade.id for legacy)
  const handleUnsell = async (trade: RealizedTrade) => {
    if (trade.sellId) {
      await onDeleteSell(trade.sellId);
    }
    setPendingUnsellId(null);
  };

  const update = (f: keyof SellFormState, v: string) => setForm(p => ({ ...p, [f]: v }));

  if (entries.length === 0 && holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <TrendingUp className="h-12 w-12 opacity-20" />
        <p>No stock entries yet. Add stocks in the Buy section first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Overall verdict banner ───────────────────────────────────────── */}
      {trades.length > 0 && (
        <div className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          totalPnl >= 0
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
              totalPnl >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"
            }`}>
              {totalPnl >= 0
                ? <TrendingUp className="h-6 w-6 text-emerald-500" />
                : <TrendingDown className="h-6 w-6 text-red-500" />}
            </div>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${
                totalPnl >= 0 ? "text-emerald-500" : "text-red-500"
              }`}>
                Overall {totalPnl >= 0 ? "Profit" : "Loss"}
              </p>
              <p className={`text-3xl font-bold font-mono ${pnlColor(totalPnl)}`}>
                {sign(totalPnl)}{fmtS(Math.abs(totalPnl))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                on {fmtS(totalCostSold, true)} invested · {trades.length} trade{trades.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Key ratio pills */}
          <div className="flex flex-wrap gap-3 shrink-0">
            <div className="rounded-lg bg-background/60 border border-border px-4 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Return</p>
              <p className={`text-xl font-bold font-mono ${pnlColor(totalPnl)}`}>
                {sign(totalCostSold > 0 ? totalPnl / totalCostSold * 100 : 0)}{totalCostSold > 0 ? (totalPnl / totalCostSold * 100).toFixed(1) : "0"}%
              </p>
            </div>
            <div className="rounded-lg bg-background/60 border border-border px-4 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Win Rate</p>
              <p className={`text-xl font-bold font-mono ${winRate >= 50 ? "text-emerald-500" : "text-amber-500"}`}>
                {winRate.toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground">{winTrades}W · {lossTrades}L</p>
            </div>
            <div className="rounded-lg bg-background/60 border border-border px-4 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net after Tax</p>
              <p className={`text-xl font-bold font-mono ${pnlColor(netAfterTax)}`}>
                {sign(netAfterTax)}{fmtS(Math.abs(netAfterTax), true)}
              </p>
              <p className="text-[10px] text-muted-foreground">tax ~{fmtS(taxEst, true)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary metric strip ─────────────────────────────────────────── */}
      {trades.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Sell P&L" icon={<DollarSign className="h-3.5 w-3.5" />}
            value={`${sign(totalPnl)}${fmtS(Math.abs(totalPnl), true)}`}
            sub={`${trades.length} trade${trades.length !== 1 ? "s" : ""}`}
            valueClass={pnlColor(totalPnl)}
          />
          <MetricCard
            label="STCG < 1yr" icon={<BarChart2 className="h-3.5 w-3.5" />}
            value={`${sign(stcgTotal)}${fmtS(Math.abs(stcgTotal), true)}`}
            sub={`${trades.filter(t => !t.isLongTerm).length} trades · 15% tax`}
            valueClass={pnlColor(stcgTotal)}
          />
          <MetricCard
            label="LTCG > 1yr" icon={<BarChart2 className="h-3.5 w-3.5" />}
            value={`${sign(ltcgTotal)}${fmtS(Math.abs(ltcgTotal), true)}`}
            sub={`${trades.filter(t => t.isLongTerm).length} trades · 10% >₹1L`}
            valueClass={pnlColor(ltcgTotal)}
          />
          <MetricCard
            label="Sell Return %" icon={<Percent className="h-3.5 w-3.5" />}
            value={`${sign(totalCostSold > 0 ? totalPnl/totalCostSold*100 : 0)}${totalCostSold > 0 ? (totalPnl/totalCostSold*100).toFixed(1) : "0"}%`}
            sub="sell P&L only"
            valueClass={pnlColor(totalPnl)}
          />
          <MetricCard
            label="Avg Hold"
            value={`${avgHoldDays}d`}
            sub={`${fmtS(totalCostSold, true)} cost`}
          />
        </div>
      )}

      {/* ── Tab nav ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "open",    label: `Open Positions (${holdings.length})` },
          { id: "history", label: `Sell History (${trades.length} trades)` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* OPEN POSITIONS TAB                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "open" && (
        <div className="space-y-4">
          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
              <TrendingUp className="h-10 w-10 opacity-20" />
              <p className="text-sm">No open positions. All holdings have been sold.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">Current Holdings</h3>
                <p className="text-xs text-muted-foreground">
                  {holdings.length} stocks · ₹{fmtN(holdings.reduce((s, h) => s + h.totalCost, 0))} invested
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/30 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-4 py-3 text-left">Stock</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Invested</th>
                      <th className="px-4 py-3 text-right">Avg Price</th>
                      <th className="px-4 py-3 text-right">Lots</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map(h => {
                      const key = h.stockName.trim().toUpperCase();
                      const isOpen = sellingStock === key;
                      const lotGroup = lotGroups.get(key);
                      const lots = lotGroup?.lots ?? [];
                      return (
                        <Fragment key={key}>
                          <tr className="border-t border-border hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-primary">{h.stockName}</td>
                            <td className="px-4 py-3 font-mono text-right">{h.qty}</td>
                            <td className="px-4 py-3 font-mono text-right">₹{fmtN(h.totalCost)}</td>
                            <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmtN(h.avgPrice)}</td>
                            <td className="px-4 py-3 font-mono text-right text-muted-foreground">{lots.length}</td>
                            <td className="px-4 py-3 text-center">
                              {isOpen
                                ? <button onClick={() => setSellingStock(null)} className="text-xs text-muted-foreground hover:text-foreground font-medium">Cancel</button>
                                : <button onClick={() => startSell(h)} className="text-xs text-red-500 hover:text-red-400 font-semibold transition-colors">Sell</button>
                              }
                            </td>
                          </tr>

                          {/* Inline sell form */}
                          {isOpen && (
                            <tr className="border-t border-red-500/20 bg-red-500/5">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="flex flex-wrap gap-3 items-end">
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Sell Date</p>
                                    <Input type="date" value={form.sellDate} onChange={e => update("sellDate", e.target.value)}
                                      className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Qty (max {h.qty})</p>
                                    <Input type="number" step="1" min="1" max={h.qty} value={form.sellQty}
                                      onChange={e => update("sellQty", e.target.value)}
                                      className="bg-secondary border-border font-mono h-8 text-sm w-24" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Total Sale Amount (₹)</p>
                                    <Input type="number" step="0.01" value={form.sellAmount}
                                      onChange={e => update("sellAmount", e.target.value)}
                                      placeholder="e.g. 15000" className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Charges (₹)</p>
                                    <Input type="number" step="0.01" value={form.sellCharges}
                                      onChange={e => update("sellCharges", e.target.value)}
                                      placeholder="0" className="bg-secondary border-border font-mono h-8 text-sm w-24" />
                                  </div>
                                  <div className="space-y-1 flex-1 min-w-36">
                                    <p className="text-xs text-muted-foreground">Notes</p>
                                    <Input value={form.sellNotes} onChange={e => update("sellNotes", e.target.value)}
                                      placeholder="reason for selling…" className="bg-secondary border-border h-8 text-sm" />
                                  </div>

                                  {/* Live P&L preview */}
                                  {form.sellAmount && (
                                    <div className="text-sm font-mono pb-0.5">
                                      {(() => {
                                        const qty    = Math.min(parseFloat(form.sellQty) || h.qty, h.qty);
                                        const cost   = h.totalCost * (qty / h.qty);
                                        const net    = parseFloat(form.sellAmount) - (parseFloat(form.sellCharges) || 0) - cost;
                                        const netPct = cost > 0 ? (net / cost) * 100 : 0;
                                        return (
                                          <div className={`rounded-lg px-3 py-1.5 border text-xs ${pnlBorder(net)}`}>
                                            <span className="text-muted-foreground">P&L: </span>
                                            <span className={`font-bold ${pnlColor(net)}`}>{sign(net)}₹{fmtN(Math.abs(net))}</span>
                                            <span className={`ml-1 ${pnlColor(netPct)}`}>({sign(netPct)}{netPct.toFixed(1)}%)</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}

                                  <Button size="sm" className="gap-1.5 h-8 bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleSell(h)} disabled={!form.sellAmount || submitting}>
                                    <Check className="h-3.5 w-3.5" />
                                    {submitting ? "Saving…" : "Confirm Sell"}
                                  </Button>
                                </div>

                                {/* FIFO lot breakdown */}
                                {lots.length > 0 && (
                                  <div className="mt-3 rounded-lg bg-secondary/50 border border-border overflow-hidden">
                                    <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border">FIFO Lots (oldest sold first · remaining qty shown)</p>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground uppercase tracking-wider">
                                          <th className="px-3 py-1.5 text-left">Buy Date</th>
                                          <th className="px-3 py-1.5 text-right">Remaining Qty</th>
                                          <th className="px-3 py-1.5 text-right">Cost Basis</th>
                                          <th className="px-3 py-1.5 text-right">Avg Price</th>
                                          <th className="px-3 py-1.5 text-right">Holding</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lots.map((lot, i) => {
                                          const days = Math.round((Date.now() - new Date(lot.date).getTime()) / 86400000);
                                          return (
                                            <tr key={lot.id} className={`border-t border-border/50 ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                              <td className="px-3 py-1.5 font-mono">{lot.date} {i === 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">next</span>}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">{lot.quantity}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">₹{fmtN(lot.amount)}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">₹{fmtN(lot.quantity > 0 ? lot.amount / lot.quantity : 0)}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">
                                                <span className={days >= 365 ? "text-blue-500" : "text-orange-500"}>{days}d · {days >= 365 ? "LTCG" : "STCG"}</span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SELL HISTORY TAB                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="space-y-5">

          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
              <BarChart2 className="h-10 w-10 opacity-20" />
              <p className="text-sm">No closed positions yet. Sell a stock to see history here.</p>
            </div>
          ) : (
            <>
              {/* ── Stock filter chips ──────────────────────────────────── */}
              {allSoldStocks.length > 1 && (
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">Filter:</span>
                    {allSoldStocks.map(({ key, name }) => {
                      const active = selectedStocks.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleStock(key)}
                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border transition-all ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                    {selectedStocks.size > 0 && (
                      <button
                        onClick={() => setSelectedStocks(new Set())}
                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" /> Clear
                      </button>
                    )}
                  </div>
                  {selectedStocks.size > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Showing {selectedStocks.size} of {allSoldStocks.length} stocks
                      · {filteredTrades.length} trade{filteredTrades.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}

              {/* Best / Worst trade */}
              {(bestTrade || worstTrade) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {bestTrade && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Trophy className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Best Trade</p>
                        <p className="font-mono font-bold text-primary">{bestTrade.stockName}</p>
                        <p className="text-xs text-muted-foreground">{bestTrade.buyDate} → {bestTrade.sellDate} · {bestTrade.holdDays}d</p>
                        <p className="font-mono font-bold text-emerald-500 text-lg mt-1">+{fmtS(bestTrade.pnl, true)} (+{bestTrade.pnlPct.toFixed(1)}%)</p>
                      </div>
                    </div>
                  )}
                  {worstTrade && (
                    <div className={`rounded-xl border p-4 flex items-start gap-3 ${pnlBorder(worstTrade.pnl)}`}>
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${worstTrade.pnl < 0 ? "bg-red-500/15" : "bg-secondary"}`}>
                        <AlertTriangle className={`h-4 w-4 ${worstTrade.pnl < 0 ? "text-red-500" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Worst Trade</p>
                        <p className="font-mono font-bold text-primary">{worstTrade.stockName}</p>
                        <p className="text-xs text-muted-foreground">{worstTrade.buyDate} → {worstTrade.sellDate} · {worstTrade.holdDays}d</p>
                        <p className={`font-mono font-bold text-lg mt-1 ${pnlColor(worstTrade.pnl)}`}>
                          {sign(worstTrade.pnl)}{fmtS(Math.abs(worstTrade.pnl), true)} ({sign(worstTrade.pnlPct)}{worstTrade.pnlPct.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* P&L by month chart */}
              {pnlByMonth.length > 1 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm font-semibold mb-4">Monthly Realized P&L</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={pnlByMonth} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => fmtS(v, true)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [fmtS(v), "P&L"]} contentStyle={CHART_TOOLTIP_STYLE} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {pnlByMonth.map((d, i) => (
                          <Cell key={i} fill={d.pnl >= 0 ? "#10b981" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Per-stock realized P&L + Dividends summary */}
              {stockSummary.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Stock-wise Returns</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Sell P&L per stock · sorted by P&L</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtS(totalCostSold, true)} → {fmtS(totalSellAmt, true)}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/20 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                          <th className="px-4 py-2.5 text-left">Stock</th>
                          <th className="px-4 py-2.5 text-right">Cost Basis</th>
                          <th className="px-4 py-2.5 text-right">Sell P&L</th>
                          <th className="px-4 py-2.5 text-right">Return %</th>
                          <th className="px-4 py-2.5 text-right">W/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockSummary.map(s => {
                          const retPct = s.costBasis > 0 ? (s.pnl / s.costBasis) * 100 : 0;
                          return (
                            <tr key={s.stockName} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="font-mono font-semibold text-primary">{s.stockName}</p>
                                <p className="text-[10px] text-muted-foreground">{s.trades} trade{s.trades !== 1 ? "s" : ""}</p>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">₹{fmtN(s.costBasis)}</td>
                              <td className={`px-4 py-2.5 font-mono text-right font-semibold ${pnlColor(s.pnl)}`}>
                                {sign(s.pnl)}₹{fmtN(Math.abs(s.pnl))}
                              </td>
                              <td className={`px-4 py-2.5 font-mono text-right font-bold ${pnlColor(retPct)}`}>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                                  retPct >= 0 ? "bg-emerald-500/10 border-emerald-500/25" : "bg-red-500/10 border-red-500/25"
                                }`}>
                                  {sign(retPct)}{retPct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-right text-xs text-muted-foreground">
                                <span className="text-emerald-500">{s.wins}W</span>
                                {" · "}
                                <span className="text-red-500">{s.trades - s.wins}L</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Totals footer */}
                      <tfoot>
                        <tr className="border-t-2 border-border bg-secondary/40 font-semibold text-sm">
                          <td className="px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Total</td>
                          <td className="px-4 py-3 font-mono text-right text-muted-foreground text-xs">₹{fmtN(totalCostSold)}</td>
                          <td className={`px-4 py-3 font-mono text-right ${pnlColor(totalPnl)}`}>{sign(totalPnl)}₹{fmtN(Math.abs(totalPnl))}</td>
                          <td className={`px-4 py-3 font-mono text-right font-bold ${pnlColor(totalPnl)}`}>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                              totalPnl >= 0 ? "bg-emerald-500/10 border-emerald-500/25" : "bg-red-500/10 border-red-500/25"
                            }`}>
                              {sign(totalCostSold > 0 ? totalPnl/totalCostSold*100 : 0)}{totalCostSold > 0 ? (totalPnl/totalCostSold*100).toFixed(1) : "0"}%
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-right text-xs text-muted-foreground">
                            <span className="text-emerald-500">{winTrades}W</span> · <span className="text-red-500">{lossTrades}L</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed trade log */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-3 bg-secondary/40 border-b border-border">
                  <h3 className="text-sm font-semibold">Trade Log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/20 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                        <th className="px-4 py-2.5 text-left">Stock</th>
                        <th className="px-4 py-2.5 text-left">Buy Date</th>
                        <th className="px-4 py-2.5 text-left">Sell Date</th>
                        <th className="px-4 py-2.5 text-right">Qty</th>
                        <th className="px-4 py-2.5 text-right">Buy Price</th>
                        <th className="px-4 py-2.5 text-right">Sell Price</th>
                        <th className="px-4 py-2.5 text-right">Cost Basis</th>
                        <th className="px-4 py-2.5 text-right">Sell Amt</th>
                        <th className="px-4 py-2.5 text-right">P&L</th>
                        <th className="px-4 py-2.5 text-right">Return</th>
                        <th className="px-4 py-2.5 text-center">Type</th>
                        <th className="px-4 py-2.5 text-center">Undo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrades.map(t => (
                        <tr key={t.id} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-mono font-semibold text-primary">{t.stockName}</p>
                            {t.sellNotes && <p className="text-[10px] text-muted-foreground/60 italic truncate max-w-[140px]" title={t.sellNotes}>{t.sellNotes}</p>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.buyDate}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.sellDate}</td>
                          <td className="px-4 py-2.5 font-mono text-right">{t.quantity}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">₹{fmtN(t.avgBuyPrice)}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">₹{fmtN(t.sellPrice)}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-muted-foreground">₹{fmtN(t.costBasis)}</td>
                          <td className="px-4 py-2.5 font-mono text-right">₹{fmtN(t.sellAmount)}</td>
                          <td className={`px-4 py-2.5 font-mono text-right font-semibold ${pnlColor(t.pnl)}`}>
                            {sign(t.pnl)}₹{fmtN(Math.abs(t.pnl))}
                          </td>
                          <td className={`px-4 py-2.5 font-mono text-right text-xs ${pnlColor(t.pnlPct)}`}>
                            {sign(t.pnlPct)}{t.pnlPct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.isLongTerm ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"}`}>
                              {t.isLongTerm ? "LTCG" : "STCG"} · {t.holdDays}d
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {t.sellId && (
                              <button onClick={() => setPendingUnsellId(t.sellId!)}
                                className="text-muted-foreground hover:text-red-500 transition-colors" title="Undo sell">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                        <td className="px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider" colSpan={6}>Total</td>
                        <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmtN(totalCostSold)}</td>
                        <td className="px-4 py-3 font-mono text-right">₹{fmtN(totalSellAmt)}</td>
                        <td className={`px-4 py-3 font-mono text-right font-bold ${pnlColor(totalPnl)}`}>
                          {sign(totalPnl)}₹{fmtN(Math.abs(totalPnl))}
                        </td>
                        <td className={`px-4 py-3 font-mono text-right text-sm ${pnlColor(totalPnl)}`}>
                          {sign(totalCostSold > 0 ? (totalPnl / totalCostSold) * 100 : 0)}
                          {totalCostSold > 0 ? ((totalPnl / totalCostSold) * 100).toFixed(1) : "0"}%
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingUnsellId !== null}
        title="Undo sell?"
        description="This will delete the sell record. The original buy entries remain untouched."
        onConfirm={() => {
          const trade = trades.find(t => t.sellId === pendingUnsellId);
          if (trade) handleUnsell(trade);
          else setPendingUnsellId(null);
        }}
        onCancel={() => setPendingUnsellId(null)}
      />
    </div>
  );
}
