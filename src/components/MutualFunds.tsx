import { useState, useMemo, useRef, useEffect, useCallback, Fragment } from "react";
import { MutualFundEntry, MfSellEntry, MfHoldingData } from "@/types/investment";
import { mutualFundCodes, MF_CATEGORIES } from "@/constants/mutualFundCodes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/format";
import {
  Plus, Pencil, Check, X, TrendingUp, TrendingDown, RefreshCw,
} from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

const API = "http://localhost:3001";

interface Props {
  mfEntries: MutualFundEntry[];
  mfSellEntries: MfSellEntry[];
  mfHoldings: MfHoldingData[];
  onAdd: (entry: Omit<MutualFundEntry, "id">) => Promise<void>;
  onEdit: (entry: MutualFundEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddSell: (entry: Omit<MfSellEntry, "id">) => Promise<void>;
  onDeleteSell: (id: string) => Promise<void>;
}

interface MfNav { price: number | null; }
type NavMap = Record<string, MfNav>;

interface BuyForm {
  fundName: string; code: string; category: string;
  date: string; units: string; nav: string; amount: string; charges: string; notes: string;
}

interface SellForm {
  sellDate: string; units: string; sellAmount: string; sellCharges: string; sellNotes: string;
}

const EMPTY_BUY: BuyForm = {
  fundName: "", code: "", category: "Index Fund",
  date: new Date().toISOString().split("T")[0],
  units: "", nav: "", amount: "", charges: "", notes: "",
};

const EMPTY_SELL: SellForm = {
  sellDate: new Date().toISOString().split("T")[0],
  units: "", sellAmount: "", sellCharges: "", sellNotes: "",
};

function pnlColor(n: number) { return n >= 0 ? "text-emerald-500" : "text-red-500"; }
function sign(n: number) { return n >= 0 ? "+" : ""; }

// FIFO realized P&L from buys + mfSells
function calcMfPnL(buys: MutualFundEntry[], sells: MfSellEntry[]) {
  const byFund = new Map<string, { entry: MutualFundEntry; rem: number }[]>();
  for (const b of buys) {
    const key = b.fundName.trim().toUpperCase();
    if (!byFund.has(key)) byFund.set(key, []);
    byFund.get(key)!.push({ entry: b, rem: b.units });
  }
  for (const arr of byFund.values()) arr.sort((a, b) => a.entry.date.localeCompare(b.entry.date));

  const trades: {
    id: string; sellId: string; fundName: string; buyDate: string; sellDate: string;
    units: number; avgBuyNav: number; sellNav: number; cost: number; proceeds: number;
    pnl: number; pnlPct: number; holdDays: number; isLongTerm: boolean; sellNotes?: string;
  }[] = [];

  const sortedSells = [...sells].sort((a, b) => a.sellDate.localeCompare(b.sellDate));
  for (const sell of sortedSells) {
    const key = sell.fundName.trim().toUpperCase();
    const lots = byFund.get(key) ?? [];
    let rem = sell.units;
    const navPerUnit = sell.units > 0 ? sell.sellAmount / sell.units : 0;
    const chargesPerUnit = sell.units > 0 ? (sell.sellCharges ?? 0) / sell.units : 0;
    const netNavPerUnit = navPerUnit - chargesPerUnit;
    for (const lot of lots) {
      if (rem <= 0) break;
      if (lot.rem <= 0) continue;
      const matched = Math.min(rem, lot.rem);
      const costPerUnit = lot.entry.units > 0 ? lot.entry.amount / lot.entry.units : 0;
      const cost = costPerUnit * matched;
      const proceeds = netNavPerUnit * matched;
      const pnl = proceeds - cost;
      const holdDays = Math.max(0,
        (new Date(sell.sellDate).getTime() - new Date(lot.entry.date).getTime()) / 86400000);
      trades.push({
        id: `${sell.id}-${lot.entry.id}`,
        sellId: sell.id,
        fundName: sell.fundName,
        buyDate: lot.entry.date,
        sellDate: sell.sellDate,
        units: matched,
        avgBuyNav: costPerUnit,
        sellNav: navPerUnit,
        cost, proceeds, pnl,
        pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
        holdDays: Math.round(holdDays),
        isLongTerm: holdDays >= 365,
        sellNotes: sell.sellNotes,
      });
      lot.rem -= matched;
      rem -= matched;
    }
  }
  return trades.sort((a, b) => b.sellDate.localeCompare(a.sellDate));
}

export default function MutualFunds({
  mfEntries, mfSellEntries, mfHoldings,
  onAdd, onEdit, onDelete, onAddSell, onDeleteSell,
}: Props) {
  const [navMap, setNavMap] = useState<NavMap>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  const fetchNavs = useCallback(async (holdings: MfHoldingData[]) => {
    const codes = [...new Set(holdings.map(h => h.code).filter(Boolean))];
    if (!codes.length) return;
    setLoadingPrices(true);
    const results = await Promise.allSettled(
      codes.map(code =>
        fetch(`${API}/mf-nav/${encodeURIComponent(code)}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );
    const next: NavMap = {};
    codes.forEach((code, i) => {
      const val = results[i].status === "fulfilled" ? results[i].value : null;
      next[code.toUpperCase()] = { price: val?.price ?? null };
    });
    setNavMap(next);
    setLoadingPrices(false);
  }, []);

  useEffect(() => {
    if (mfHoldings.length) fetchNavs(mfHoldings);
  }, [mfHoldings.map(h => h.code).join(",")]);

  const handleRefresh = () => fetchNavs(mfHoldings);
  const [tab, setTab] = useState<"holdings" | "buy" | "history">("holdings");
  const [buyForm, setBuyForm] = useState<BuyForm>(EMPTY_BUY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sellingFund, setSellingFund] = useState<string | null>(null);
  const [sellForm, setSellForm] = useState<SellForm>(EMPTY_SELL);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingUnsellId, setPendingUnsellId] = useState<string | null>(null);
  const [expandedBuy, setExpandedBuy] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const trades = useMemo(() => calcMfPnL(mfEntries, mfSellEntries), [mfEntries, mfSellEntries]);

  const totalInvested = mfHoldings.reduce((s, h) => s + h.totalCost, 0);
  const totalRealizedPnL = trades.reduce((s, t) => s + t.pnl, 0);

  // Live NAV per holding — from internal navMap (fetched via /mf-nav/:code)
  const holdingsWithLive = useMemo(() => mfHoldings.map(h => {
    const code = h.code?.trim().toUpperCase();
    const currentNav = code ? (navMap[code]?.price ?? null) : null;
    const currentValue = currentNav !== null ? currentNav * h.units : null;
    const pnl = currentValue !== null ? currentValue - h.totalCost : null;
    const pnlPct = pnl !== null && h.totalCost > 0 ? (pnl / h.totalCost) * 100 : null;
    return { ...h, currentNav, currentValue, pnl, pnlPct };
  }), [mfHoldings, navMap]);

  const totalCurrentValue = holdingsWithLive.every(h => h.currentValue !== null)
    ? holdingsWithLive.reduce((s, h) => s + (h.currentValue ?? 0), 0)
    : null;
  const totalPnl = totalCurrentValue !== null ? totalCurrentValue - totalInvested : null;
  const totalPnlPct = totalPnl !== null && totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;

  // Buy lots per fund for FIFO breakdown in sell panel
  const lotsByFund = useMemo(() => {
    const map = new Map<string, { entry: MutualFundEntry; rem: number }[]>();
    // Compute remaining via FIFO
    const rem = new Map<string, number>();
    for (const e of mfEntries) rem.set(e.id, e.units);
    const sortedSells = [...mfSellEntries].sort((a, b) => a.sellDate.localeCompare(b.sellDate));
    const byFund = new Map<string, MutualFundEntry[]>();
    for (const e of mfEntries) {
      const k = e.fundName.trim().toUpperCase();
      if (!byFund.has(k)) byFund.set(k, []);
      byFund.get(k)!.push(e);
    }
    for (const arr of byFund.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
    for (const s of sortedSells) {
      const k = s.fundName.trim().toUpperCase();
      let toDeduct = s.units;
      for (const e of (byFund.get(k) ?? [])) {
        if (toDeduct <= 0) break;
        const r = rem.get(e.id) ?? 0;
        const d = Math.min(toDeduct, r);
        rem.set(e.id, r - d);
        toDeduct -= d;
      }
    }
    for (const e of mfEntries) {
      const k = e.fundName.trim().toUpperCase();
      const r = rem.get(e.id) ?? 0;
      if (r <= 0) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({ entry: e, rem: r });
    }
    return map;
  }, [mfEntries, mfSellEntries]);

  const upd = (f: keyof BuyForm, v: string) => setBuyForm(p => ({ ...p, [f]: v }));
  const updS = (f: keyof SellForm, v: string) => setSellForm(p => ({ ...p, [f]: v }));

  // Auto-fill code from fund name
  const handleFundNameChange = (name: string) => {
    const code = mutualFundCodes[name] ?? "";
    setBuyForm(p => ({ ...p, fundName: name, code: code || p.code }));
  };

  // Auto-fill amount when units + nav both present
  const handleUnitsOrNavChange = (field: "units" | "nav", val: string) => {
    setBuyForm(p => {
      const next = { ...p, [field]: val };
      const u = parseFloat(field === "units" ? val : p.units);
      const n = parseFloat(field === "nav" ? val : p.nav);
      if (!isNaN(u) && !isNaN(n)) next.amount = String((u * n).toFixed(2));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyForm.fundName || !buyForm.units || !buyForm.amount) return;
    setSubmitting(true);
    const entry = {
      fundName: buyForm.fundName.trim(),
      code: buyForm.code.trim().toUpperCase(),
      category: buyForm.category,
      date: buyForm.date,
      units: parseFloat(buyForm.units),
      nav: parseFloat(buyForm.nav) || 0,
      amount: parseFloat(buyForm.amount),
      charges: parseFloat(buyForm.charges) || 0,
      notes: buyForm.notes.trim() || undefined,
    };
    if (editingId) {
      await onEdit({ ...entry, id: editingId });
      setEditingId(null);
    } else {
      await onAdd(entry);
    }
    setBuyForm(EMPTY_BUY);
    setSubmitting(false);
  };

  const startEdit = (e: MutualFundEntry) => {
    setEditingId(e.id);
    setBuyForm({
      fundName: e.fundName, code: e.code, category: e.category,
      date: e.date, units: String(e.units), nav: String(e.nav),
      amount: String(e.amount), charges: String(e.charges), notes: e.notes ?? "",
    });
    setTab("buy");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const startSell = (h: MfHoldingData) => {
    setSellingFund(h.fundName.trim().toUpperCase());
    setSellForm({ ...EMPTY_SELL, units: String(h.units) });
  };

  const handleSell = async (h: MfHoldingData) => {
    if (!sellForm.sellAmount || submitting) return;
    setSubmitting(true);
    await onAddSell({
      fundName: h.fundName, code: h.code, category: h.category,
      sellDate: sellForm.sellDate,
      units: Math.min(parseFloat(sellForm.units) || h.units, h.units),
      sellAmount: parseFloat(sellForm.sellAmount),
      sellCharges: parseFloat(sellForm.sellCharges) || 0,
      sellNotes: sellForm.sellNotes.trim() || undefined,
    });
    setSubmitting(false);
    setSellingFund(null);
  };


  if (mfEntries.length === 0 && mfHoldings.length === 0) {
    return (
      <div className="space-y-6">
        <BuyFormPanel
          form={buyForm} editingId={null} submitting={submitting}
          formRef={formRef} onSubmit={handleSubmit}
          onUpd={upd} onUnitsNav={handleUnitsOrNavChange}
          onFundName={handleFundNameChange} onCancel={() => setBuyForm(EMPTY_BUY)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Summary */}
      {mfHoldings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
            <p className="font-mono font-bold text-lg text-primary">₹{fmt(totalInvested)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{mfHoldings.length} funds</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Current Value</p>
            <p className="font-mono font-bold text-lg">{totalCurrentValue !== null ? `₹${fmt(totalCurrentValue)}` : "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">live NAV</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Unrealized P&L</p>
            <p className={`font-mono font-bold text-lg ${totalPnl === null ? "" : pnlColor(totalPnl)}`}>
              {totalPnl !== null ? `${sign(totalPnl)}₹${fmt(Math.abs(totalPnl))}` : "—"}
            </p>
            {totalPnlPct !== null && (
              <p className={`text-[11px] font-mono mt-0.5 ${pnlColor(totalPnlPct)}`}>
                {sign(totalPnlPct)}{totalPnlPct.toFixed(2)}%
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Realized P&L</p>
            <p className={`font-mono font-bold text-lg ${trades.length ? pnlColor(totalRealizedPnL) : ""}`}>
              {trades.length ? `${sign(totalRealizedPnL)}₹${fmt(Math.abs(totalRealizedPnL))}` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{trades.length} trade{trades.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "holdings", label: `Holdings (${mfHoldings.length})` },
          { id: "buy",      label: editingId ? "Edit Entry" : "Buy / Add" },
          { id: "history",  label: `Sell History (${trades.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HOLDINGS TAB ── */}
      {tab === "holdings" && (
        <div className="space-y-4">
          {mfHoldings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3 rounded-xl border border-border">
              <TrendingUp className="h-10 w-10 opacity-20" />
              <p className="text-sm">No holdings yet. Add a purchase in the Buy tab.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">Current Holdings</h3>
                <button onClick={handleRefresh} disabled={loadingPrices}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loadingPrices ? "animate-spin" : ""}`} />
                  {loadingPrices ? "Loading…" : "Refresh NAV"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/30 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-4 py-3 text-left">Fund</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-right">Units</th>
                      <th className="px-4 py-3 text-right">Avg NAV</th>
                      <th className="px-4 py-3 text-right">Invested</th>
                      <th className="px-4 py-3 text-right">Curr NAV</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">P&L</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsWithLive.map(h => {
                      const key = h.fundName.trim().toUpperCase();
                      const isOpen = sellingFund === key;
                      const lots = lotsByFund.get(key) ?? [];
                      return (
                        <Fragment key={key}>
                          <tr className="border-t border-border hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-mono font-semibold text-primary">{h.fundName}</p>
                              {h.code && <p className="text-[10px] text-muted-foreground font-mono">{h.code}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{h.category}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-right">{h.units.toFixed(3)}</td>
                            <td className="px-4 py-3 font-mono text-right text-muted-foreground">₹{fmt(h.avgNav)}</td>
                            <td className="px-4 py-3 font-mono text-right">₹{fmt(h.totalCost)}</td>
                            <td className="px-4 py-3 font-mono text-right text-muted-foreground">
                              {h.currentNav !== null ? `₹${fmt(h.currentNav)}` : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-right">
                              {h.currentValue !== null ? `₹${fmt(h.currentValue)}` : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-right">
                              {h.pnl !== null ? (
                                <div>
                                  <span className={`font-semibold ${pnlColor(h.pnl)}`}>
                                    {sign(h.pnl)}₹{fmt(Math.abs(h.pnl))}
                                  </span>
                                  {h.pnlPct !== null && (
                                    <span className={`block text-[11px] ${pnlColor(h.pnlPct)}`}>
                                      {sign(h.pnlPct)}{h.pnlPct.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {isOpen
                                ? <button onClick={() => setSellingFund(null)} className="text-xs text-muted-foreground hover:text-foreground font-medium">Cancel</button>
                                : <button onClick={() => startSell(h)} className="text-xs text-red-500 hover:text-red-400 font-semibold">Sell</button>
                              }
                            </td>
                          </tr>

                          {/* Inline sell form */}
                          {isOpen && (
                            <tr className="border-t border-red-500/20 bg-red-500/5">
                              <td colSpan={9} className="px-5 py-4">
                                <div className="flex flex-wrap gap-3 items-end">
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Sell Date</p>
                                    <Input type="date" value={sellForm.sellDate} onChange={e => updS("sellDate", e.target.value)}
                                      className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Units (max {h.units.toFixed(3)})</p>
                                    <Input type="number" step="0.001" min="0.001" max={h.units} value={sellForm.units}
                                      onChange={e => updS("units", e.target.value)}
                                      className="bg-secondary border-border font-mono h-8 text-sm w-28" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Sale Amount (₹)</p>
                                    <Input type="number" step="0.01" value={sellForm.sellAmount}
                                      onChange={e => updS("sellAmount", e.target.value)}
                                      placeholder="total proceeds" className="bg-secondary border-border font-mono h-8 text-sm w-36" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Charges (₹)</p>
                                    <Input type="number" step="0.01" value={sellForm.sellCharges}
                                      onChange={e => updS("sellCharges", e.target.value)}
                                      placeholder="0" className="bg-secondary border-border font-mono h-8 text-sm w-24" />
                                  </div>
                                  <div className="space-y-1 flex-1 min-w-36">
                                    <p className="text-xs text-muted-foreground">Notes</p>
                                    <Input value={sellForm.sellNotes} onChange={e => updS("sellNotes", e.target.value)}
                                      placeholder="reason…" className="bg-secondary border-border h-8 text-sm" />
                                  </div>
                                  {sellForm.sellAmount && (
                                    <div className="text-xs font-mono pb-0.5">
                                      {(() => {
                                        const units = Math.min(parseFloat(sellForm.units) || h.units, h.units);
                                        const cost = h.totalCost * (units / h.units);
                                        const net = parseFloat(sellForm.sellAmount) - (parseFloat(sellForm.sellCharges) || 0) - cost;
                                        return (
                                          <span className={pnlColor(net)}>
                                            P&L: {sign(net)}₹{fmt(Math.abs(net))}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  )}
                                  <Button size="sm" className="h-8 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleSell(h)} disabled={!sellForm.sellAmount || submitting}>
                                    <Check className="h-3.5 w-3.5" />
                                    {submitting ? "Saving…" : "Confirm Sell"}
                                  </Button>
                                </div>

                                {/* FIFO lot breakdown */}
                                {lots.length > 0 && (
                                  <div className="mt-3 rounded-lg bg-secondary/50 border border-border overflow-hidden">
                                    <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border">FIFO Lots (oldest first · remaining units)</p>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground uppercase tracking-wider">
                                          <th className="px-3 py-1.5 text-left">Buy Date</th>
                                          <th className="px-3 py-1.5 text-right">Remaining Units</th>
                                          <th className="px-3 py-1.5 text-right">Cost Basis</th>
                                          <th className="px-3 py-1.5 text-right">Avg NAV</th>
                                          <th className="px-3 py-1.5 text-right">Held</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lots.map((l, i) => {
                                          const days = Math.round((Date.now() - new Date(l.entry.date).getTime()) / 86400000);
                                          return (
                                            <tr key={l.entry.id} className={`border-t border-border/50 ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                              <td className="px-3 py-1.5 font-mono">{l.entry.date} {i === 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">next</span>}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">{l.rem.toFixed(3)}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">₹{fmt(l.rem * (l.entry.units > 0 ? l.entry.amount / l.entry.units : 0))}</td>
                                              <td className="px-3 py-1.5 font-mono text-right">₹{fmt(l.entry.units > 0 ? l.entry.amount / l.entry.units : 0)}</td>
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

      {/* ── BUY TAB ── */}
      {tab === "buy" && (
        <div className="space-y-5">
          <BuyFormPanel
            form={buyForm} editingId={editingId} submitting={submitting}
            formRef={formRef} onSubmit={handleSubmit}
            onUpd={upd} onUnitsNav={handleUnitsOrNavChange}
            onFundName={handleFundNameChange}
            onCancel={() => { setBuyForm(EMPTY_BUY); setEditingId(null); }}
          />

          {/* All buy entries */}
          {mfEntries.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 bg-secondary/40 border-b border-border">
                <h3 className="text-sm font-semibold">All Buy Records ({mfEntries.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/20 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-4 py-2.5 text-left">Fund</th>
                      <th className="px-4 py-2.5 text-left">Category</th>
                      <th className="px-4 py-2.5 text-left">Date</th>
                      <th className="px-4 py-2.5 text-right">Units</th>
                      <th className="px-4 py-2.5 text-right">NAV</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Charges</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mfEntries].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                      <tr key={e.id} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-mono font-semibold text-primary">{e.fundName}</p>
                          {e.code && <p className="text-[10px] text-muted-foreground">{e.code}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{e.category}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">{e.date}</td>
                        <td className="px-4 py-2.5 font-mono text-right">{e.units.toFixed(3)}</td>
                        <td className="px-4 py-2.5 font-mono text-right text-muted-foreground">₹{fmt(e.nav)}</td>
                        <td className="px-4 py-2.5 font-mono text-right">₹{fmt(e.amount)}</td>
                        <td className="px-4 py-2.5 font-mono text-right text-muted-foreground">₹{fmt(e.charges)}</td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          <button onClick={() => startEdit(e)} className="text-primary hover:text-primary/80 text-xs font-medium mr-3">Edit</button>
                          <button onClick={() => setPendingDeleteId(e.id)} className="text-destructive hover:text-destructive/80 text-xs font-medium">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SELL HISTORY TAB ── */}
      {tab === "history" && (
        <div className="space-y-4">
          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3 rounded-xl border border-border">
              <TrendingDown className="h-10 w-10 opacity-20" />
              <p className="text-sm">No sell history yet.</p>
            </div>
          ) : (
            <>
              {/* Realized P&L banner */}
              <div className={`rounded-xl border px-5 py-3.5 flex items-center justify-between ${totalRealizedPnL >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Realized P&L</p>
                <p className={`font-mono font-bold text-lg ${pnlColor(totalRealizedPnL)}`}>
                  {sign(totalRealizedPnL)}₹{fmt(Math.abs(totalRealizedPnL))}
                </p>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/20 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                        <th className="px-4 py-2.5 text-left">Fund</th>
                        <th className="px-4 py-2.5 text-left">Buy Date</th>
                        <th className="px-4 py-2.5 text-left">Sell Date</th>
                        <th className="px-4 py-2.5 text-right">Units</th>
                        <th className="px-4 py-2.5 text-right">Buy NAV</th>
                        <th className="px-4 py-2.5 text-right">Sell NAV</th>
                        <th className="px-4 py-2.5 text-right">Cost</th>
                        <th className="px-4 py-2.5 text-right">Proceeds</th>
                        <th className="px-4 py-2.5 text-right">P&L</th>
                        <th className="px-4 py-2.5 text-center">Type</th>
                        <th className="px-4 py-2.5 text-center">Undo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map(t => (
                        <tr key={t.id} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-mono font-semibold text-primary">{t.fundName}</p>
                            {t.sellNotes && <p className="text-[10px] text-muted-foreground/60 italic truncate max-w-[140px]">{t.sellNotes}</p>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.buyDate}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.sellDate}</td>
                          <td className="px-4 py-2.5 font-mono text-right">{t.units.toFixed(3)}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">₹{fmt(t.avgBuyNav)}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">₹{fmt(t.sellNav)}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-muted-foreground">₹{fmt(t.cost)}</td>
                          <td className="px-4 py-2.5 font-mono text-right">₹{fmt(t.proceeds)}</td>
                          <td className={`px-4 py-2.5 font-mono text-right font-semibold ${pnlColor(t.pnl)}`}>
                            {sign(t.pnl)}₹{fmt(Math.abs(t.pnl))}
                            <span className={`block text-[11px] font-normal ${pnlColor(t.pnlPct)}`}>
                              {sign(t.pnlPct)}{t.pnlPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.isLongTerm ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"}`}>
                              {t.isLongTerm ? "LTCG" : "STCG"} · {t.holdDays}d
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => setPendingUnsellId(t.sellId)}
                              className="text-muted-foreground hover:text-red-500 transition-colors" title="Undo sell">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete buy record?"
        description="This will permanently remove this mutual fund purchase."
        onConfirm={() => { onDelete(pendingDeleteId!); setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ConfirmDialog
        open={pendingUnsellId !== null}
        title="Undo sell?"
        description="This will delete the sell record. Buy entries remain untouched."
        onConfirm={() => { onDeleteSell(pendingUnsellId!); setPendingUnsellId(null); }}
        onCancel={() => setPendingUnsellId(null)}
      />
    </div>
  );
}

// ── Buy / Edit form (extracted to avoid repetition) ───────────────────────────
function BuyFormPanel({ form, editingId, submitting, formRef, onSubmit, onUpd, onUnitsNav, onFundName, onCancel }: {
  form: BuyForm; editingId: string | null; submitting: boolean;
  formRef: React.RefObject<HTMLFormElement>;
  onSubmit: (e: React.FormEvent) => void;
  onUpd: (f: keyof BuyForm, v: string) => void;
  onUnitsNav: (f: "units" | "nav", v: string) => void;
  onFundName: (v: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <h3 className="font-semibold text-sm">{editingId ? "Edit Purchase" : "Add Purchase"}</h3>
      </div>
      <form ref={formRef} onSubmit={onSubmit} className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Fund Name</Label>
          <Input list="mf-names" value={form.fundName} onChange={e => onFundName(e.target.value)}
            placeholder="e.g. NIFTY BEES" className="bg-secondary border-border font-mono" required />
          <datalist id="mf-names">
            {Object.keys(mutualFundCodes).map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">NSE Code</Label>
          <Input value={form.code} onChange={e => onUpd("code", e.target.value.toUpperCase())}
            placeholder="e.g. NIFTYBEES" className="bg-secondary border-border font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Category</Label>
          <select value={form.category} onChange={e => onUpd("category", e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring">
            {MF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
          <Input type="date" value={form.date} onChange={e => onUpd("date", e.target.value)}
            className="bg-secondary border-border font-mono" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Units</Label>
          <Input type="number" step="0.001" min="0" value={form.units}
            onChange={e => onUnitsNav("units", e.target.value)}
            placeholder="0.000" className="bg-secondary border-border font-mono" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">NAV (₹)</Label>
          <Input type="number" step="0.0001" min="0" value={form.nav}
            onChange={e => onUnitsNav("nav", e.target.value)}
            placeholder="0.00" className="bg-secondary border-border font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Amount (₹)</Label>
          <Input type="number" step="0.01" min="0" value={form.amount}
            onChange={e => onUpd("amount", e.target.value)}
            placeholder="auto from units × NAV" className="bg-secondary border-border font-mono" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Charges (₹)</Label>
          <Input type="number" step="0.01" min="0" value={form.charges}
            onChange={e => onUpd("charges", e.target.value)}
            placeholder="0.00" className="bg-secondary border-border font-mono" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</Label>
          <Input value={form.notes} onChange={e => onUpd("notes", e.target.value)}
            placeholder="optional" className="bg-secondary border-border" />
        </div>
        <div className="col-span-2 flex gap-2 items-end">
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {editingId ? <><Pencil className="h-3.5 w-3.5" /> Save</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
          </Button>
          {editingId && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        </div>
      </form>
    </div>
  );
}
