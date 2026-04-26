import { useState, useMemo } from "react";
import { Goal } from "@/types/investment";
import { LivePriceData } from "@/hooks/useLivePrices";
import { InvestmentEntry } from "@/types/investment";
import { Target, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface Props {
  goals: Goal[];
  entries: InvestmentEntry[];
  prices: Record<string, LivePriceData>;
  loadingPrices: boolean;
  fetchPrices: (symbols: string[]) => void;
  onAdd: (goal: Omit<Goal, "id" | "createdAt">) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function monthsRemaining(targetDate: string) {
  const now = new Date();
  const target = new Date(targetDate);
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
}

function requiredSIP(currentValue: number, targetAmount: number, months: number, annualRate = 0.12) {
  if (months <= 0) return 0;
  const r = annualRate / 12;
  // Current corpus also grows — only SIP the remaining gap after that growth
  const fvCurrent = currentValue * Math.pow(1 + r, months);
  const gap = targetAmount - fvCurrent;
  if (gap <= 0) return 0;
  return (gap * r) / (Math.pow(1 + r, months) - 1);
}

function projectedDate(currentValue: number, targetAmount: number, annualCagr: number) {
  if (currentValue <= 0 || annualCagr <= 0 || currentValue >= targetAmount) return null;
  const years = Math.log(targetAmount / currentValue) / Math.log(1 + annualCagr / 100);
  const d = new Date();
  d.setMonth(d.getMonth() + Math.round(years * 12));
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function portfolioCagr(entries: InvestmentEntry[], currentValue: number, hasPrices: boolean) {
  if (!hasPrices || entries.length === 0 || currentValue <= 0) return null;
  const earliest = entries.reduce((min, e) => e.date < min ? e.date : min, entries[0].date);
  const days = (Date.now() - new Date(earliest).getTime()) / 86400000;
  if (days < 30) return null;
  const totalInvested = entries.reduce((s, e) => s + e.amount, 0);
  if (totalInvested <= 0) return null;
  const years = days / 365;
  return (Math.pow(currentValue / totalInvested, 1 / years) - 1) * 100;
}

export default function GoalTracker({ goals, entries, prices, loadingPrices, fetchPrices, onAdd, onEdit, onDelete }: Props) {
  const [form, setForm] = useState({ name: "", targetAmount: "", targetDate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const symbols = useMemo(() => [...new Set(entries.map((e) => e.stockName))], [entries]);

  const { currentPortfolioValue, hasPrices } = useMemo(() => {
    const invested = entries.reduce((s, e) => s + e.amount, 0);
    const liveStocks = symbols;
    const has = liveStocks.some((s) => prices[s]);
    if (!has) return { currentPortfolioValue: invested, hasPrices: false };
    const value = liveStocks.reduce((sum, stock) => {
      const qty = entries.filter((e) => e.stockName === stock).reduce((s, e) => s + e.quantity, 0);
      const price = prices[stock]?.price ?? null;
      if (price === null) {
        return sum + entries.filter((e) => e.stockName === stock).reduce((s, e) => s + e.amount, 0);
      }
      return sum + qty * price;
    }, 0);
    return { currentPortfolioValue: value, hasPrices: true };
  }, [entries, prices, symbols]);

  const cagrRaw = useMemo(() => portfolioCagr(entries, currentPortfolioValue, hasPrices), [entries, currentPortfolioValue, hasPrices]);
  const cagr = (cagrRaw !== null && cagrRaw > 0) ? cagrRaw : 10;

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.targetAmount || !form.targetDate) return;
    const payload = { name: form.name.trim(), targetAmount: parseFloat(form.targetAmount), targetDate: form.targetDate };
    if (editingId) {
      onEdit({ ...payload, id: editingId, createdAt: goals.find((g) => g.id === editingId)!.createdAt });
      setEditingId(null);
    } else {
      onAdd(payload);
    }
    setForm({ name: "", targetAmount: "", targetDate: "" });
  };

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setForm({ name: goal.name, targetAmount: String(goal.targetAmount), targetDate: goal.targetDate });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ name: "", targetAmount: "", targetDate: "" });
  };

  return (
    <div className="space-y-8">
      {/* Add / Edit form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Goal Name</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Retirement Corpus" className="bg-secondary border-border" required />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Target Amount (₹)</Label>
          <Input type="number" min="0" step="1000" value={form.targetAmount}
            onChange={(e) => update("targetAmount", e.target.value)}
            placeholder="5000000" className="bg-secondary border-border font-mono" required />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Target Date</Label>
          <Input type="date" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)}
            className="bg-secondary border-border font-mono" required />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="gap-2 flex-1">
            {editingId ? <><Pencil className="h-4 w-4" /> Save</> : <><Plus className="h-4 w-4" /> Add Goal</>}
          </Button>
          {editingId && <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>}
        </div>
      </form>

      {/* Context banner */}
      <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 flex flex-wrap items-center gap-6 text-sm">
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            {hasPrices ? "Market Value" : "Total Invested"}
          </span>
          <p className="font-mono font-semibold text-primary mt-0.5">₹{fmt(currentPortfolioValue)}</p>
          {!hasPrices && <p className="text-xs text-muted-foreground">load live prices for market value</p>}
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Historical CAGR</span>
          <p className="font-mono font-semibold mt-0.5">
            {cagrRaw !== null ? `${cagrRaw.toFixed(1)}% p.a.` : "—"}
          </p>
          {cagrRaw === null && <p className="text-xs text-muted-foreground">using 10% default</p>}
        </div>
        <p className="text-xs text-muted-foreground self-center">SIP estimates assume {cagrRaw !== null && cagrRaw > 0 ? `${cagr.toFixed(1)}% (your CAGR)` : "10% p.a. (default)"}</p>
        {!hasPrices && (
          <Button
            variant="outline" size="sm" className="gap-2 ml-auto"
            onClick={() => fetchPrices(symbols)}
            disabled={loadingPrices}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingPrices ? "animate-spin" : ""}`} />
            {loadingPrices ? "Loading…" : "Load Live Prices"}
          </Button>
        )}
      </div>

      {/* Goals */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p>No goals yet. Add your first financial goal above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const progress = Math.min(100, (currentPortfolioValue / goal.targetAmount) * 100);
            const months = monthsRemaining(goal.targetDate);
            const sip = requiredSIP(currentPortfolioValue, goal.targetAmount, months, cagr / 100);
            const projDate = projectedDate(currentPortfolioValue, goal.targetAmount, cagr);
            const remaining = goal.targetAmount - currentPortfolioValue;
            const isAchieved = currentPortfolioValue >= goal.targetAmount;
            const isNear = progress >= 75 && !isAchieved;
            const isLate = months === 0 && !isAchieved;

            return (
              <div key={goal.id} className={`rounded-lg border p-5 space-y-4 ${
                isAchieved ? "border-green-500/50 bg-green-500/5"
                : isLate ? "border-red-500/40 bg-red-500/5"
                : isNear ? "border-yellow-500/40 bg-yellow-500/5"
                : "border-border bg-secondary/20"
              }`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {isAchieved
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : isLate
                        ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <h3 className="font-semibold">{goal.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Target: {new Date(goal.targetDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      {months > 0 && ` · ${months} months away`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(goal)} className="text-primary hover:text-primary/80 text-xs font-medium transition-colors px-2">Edit</button>
                    <button onClick={() => setPendingDeleteId(goal.id)} className="text-destructive hover:text-destructive/80 text-xs font-medium transition-colors px-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">₹{fmt(currentPortfolioValue)}</span>
                    <span className="font-semibold">₹{fmt(goal.targetAmount)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isAchieved ? "bg-green-500" : isLate ? "bg-red-500" : isNear ? "bg-yellow-500" : "bg-primary"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{progress.toFixed(1)}% complete</p>
                </div>

                {/* Stats */}
                {!isAchieved ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-md bg-secondary/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Still Needed</p>
                      <p className="font-mono text-sm font-semibold mt-0.5">₹{fmt(remaining)}</p>
                    </div>
                    <div className="rounded-md bg-secondary/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Monthly SIP</p>
                      <p className="font-mono text-sm font-semibold mt-0.5 text-primary">
                        {months > 0 ? `₹${fmt(sip)}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-md bg-secondary/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">At {cagr.toFixed(0)}% CAGR</p>
                      <p className="font-mono text-sm font-semibold mt-0.5">{projDate ?? "Soon"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-center">
                    <p className="text-green-500 font-semibold text-sm">Goal Achieved! 🎯</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You're ₹{fmt(currentPortfolioValue - goal.targetAmount)} above target
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete goal?"
        description="This will permanently remove this goal."
        onConfirm={() => { onDelete(pendingDeleteId!); setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
