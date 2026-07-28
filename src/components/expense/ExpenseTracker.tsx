import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Area, AreaChart,
} from "recharts";
import { ExpenseMonth, ExpenseConfig, ExpenseCats, ExpenseSpend, CAT_KEYS, CAT_LABELS, BalanceRow } from "@/types/expense";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, TrendingUp, Wallet, PiggyBank, BarChart3, Calculator } from "lucide-react";
import PersonalExpenses from "@/components/expense/PersonalExpenses";
import { usePersonalExpense } from "@/hooks/usePersonalExpense";
import MonthNav from "@/components/expense/MonthNav";
import StatCard from "@/components/common/StatCard";
import { fmtInr, monthLabel, ALL_MONTHS, CHART_TOOLTIP_STYLE } from "@/lib/expense-utils";

interface Props {
  months: ExpenseMonth[];
  config: ExpenseConfig;
  onSaveMonth: (m: ExpenseMonth) => void;
  onSaveConfig: (c: ExpenseConfig) => void;
}

type View = "overview" | "monthly" | "summary" | "balance" | "personal" | "calculator" | "settings";

const CAT_COLORS: Record<keyof ExpenseCats, string> = {
  investment:      "#6366f1",
  policies:        "#f59e0b",
  family:          "#10b981",
  savings:         "#3b82f6",
  emergencyFund:   "#ef4444",
  gold:            "#f97316",
  personalExpenses:"#8b5cf6",
};

const fmt = fmtInr;

function emptyCats(): ExpenseCats {
  return { investment: 0, policies: 0, family: 0, savings: 0, emergencyFund: 0, gold: 0, personalExpenses: 0 };
}

function emptySpend(): ExpenseSpend { return { ...emptyCats(), leftOver: 0 }; }

function computeBalance(config: ExpenseConfig, months: ExpenseMonth[]): BalanceRow[] {
  const rows: BalanceRow[] = [];
  let prev = { ...config.initialBalance };
  let prevLeftOver = 0;
  const initTotal = CAT_KEYS.reduce((s, k) => s + prev[k], 0);
  rows.push({ month: "2025", label: "Year 2025 (Opening)", balance: { ...prev }, leftOver: 0, total: initTotal });
  for (const m of months.filter(m => m.totalSalary > 0)) {
    const balance = {} as ExpenseCats;
    for (const k of CAT_KEYS) balance[k] = parseFloat(((prev[k] + m.allocation[k] - m.spend[k]) || 0).toFixed(4));
    const incomeDiff = m.totalSalary - m.salary;
    const leftOver = parseFloat((prevLeftOver + incomeDiff - m.spend.leftOver).toFixed(2));
    const total = CAT_KEYS.reduce((s, k) => s + balance[k], 0) + leftOver;
    rows.push({ month: m.month, label: monthLabel(m.month), balance, leftOver, total: parseFloat(total.toFixed(2)) });
    prev = { ...balance };
    prevLeftOver = leftOver;
  }
  return rows;
}

// ── Overview / Dashboard ──────────────────────────────────────────────────────
function Overview({ months, config }: { months: ExpenseMonth[]; config: ExpenseConfig }) {
  const activeMonths = months.filter(m => m.totalSalary > 0);
  const balanceRows = useMemo(() => computeBalance(config, months), [config, months]);
  const latestBalance = balanceRows[balanceRows.length - 1];

  const ytdSalary   = activeMonths.reduce((s, m) => s + m.totalSalary, 0);
  const ytdSpent    = activeMonths.reduce((s, m) => s + CAT_KEYS.reduce((x, k) => x + m.spend[k], 0) + m.spend.leftOver, 0);
  const ytdSaved    = ytdSalary - ytdSpent;
  const totalBalance = latestBalance?.total ?? 0;

  // Bar chart data: allocated vs spent per month
  const barData = activeMonths.map(m => ({
    month: monthLabel(m.month, true),
    Allocated: parseFloat(CAT_KEYS.reduce((s, k) => s + m.allocation[k], 0).toFixed(0)),
    Spent: parseFloat((CAT_KEYS.reduce((s, k) => s + m.spend[k], 0) + m.spend.leftOver).toFixed(0)),
  }));

  // Pie: category breakdown of total spend
  const pieData = CAT_KEYS.map(k => ({
    name: CAT_LABELS[k],
    value: parseFloat(activeMonths.reduce((s, m) => s + m.spend[k], 0).toFixed(0)),
    color: CAT_COLORS[k],
  })).filter(d => d.value > 0);

  // Line chart: balance trend
  const lineData = balanceRows.slice(1).map(r => ({
    month: r.label.slice(0, 6),
    Balance: parseFloat(r.total.toFixed(0)),
  }));

  // Stacked bar per category
  const stackData = activeMonths.map(m => {
    const row: Record<string, number | string> = { month: monthLabel(m.month, true) };
    for (const k of CAT_KEYS) row[CAT_LABELS[k]] = parseFloat(m.spend[k].toFixed(0));
    return row;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="YTD Total Salary" value={fmt(ytdSalary, true)} sub={`${activeMonths.length} months`}
          iconBg="bg-blue-500/10 text-blue-500" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="YTD Total Spent" value={fmt(ytdSpent, true)} sub={`${((ytdSpent/ytdSalary)*100||0).toFixed(1)}% of salary`}
          iconBg="bg-orange-500/10 text-orange-500" icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard label="YTD Net Saved" value={fmt(ytdSaved, true)} sub={`${((ytdSaved/ytdSalary)*100||0).toFixed(1)}% saved`}
          iconBg="bg-emerald-500/10 text-emerald-500" icon={<PiggyBank className="h-5 w-5" />} />
        <StatCard label="Current Balance" value={fmt(totalBalance, true)} sub="Cumulative unspent"
          iconBg="bg-purple-500/10 text-purple-500" icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Allocated vs Spent bar */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Monthly: Allocated vs Spent</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => fmt(v, true)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Allocated" fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="Spent" fill="#f97316" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-2">Spend by Category (YTD)</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="truncate">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stacked spend + Balance line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Spend Breakdown by Category</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stackData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => fmt(v, true)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={CHART_TOOLTIP_STYLE} />
              {CAT_KEYS.map(k => (
                <Bar key={k} dataKey={CAT_LABELS[k]} stackId="a" fill={CAT_COLORS[k]} radius={k === "personalExpenses" ? [4,4,0,0] : [0,0,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Cumulative Balance Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => fmt(v, true)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={CHART_TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="Balance" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Monthly Entry ─────────────────────────────────────────────────────────────
function MonthlyEntry({ months, onSave }: { months: ExpenseMonth[]; onSave: (m: ExpenseMonth) => void }) {
  const [selIdx, setSelIdx] = useState(Math.min(new Date().getMonth(), 11));
  const selectedMonth = ALL_MONTHS[selIdx];

  const [totalSalary, setTotalSalary] = useState("0");
  const [salary, setSalary] = useState("0");
  const [split, setSplit] = useState<ExpenseCats>(emptyCats());
  const [allocation, setAllocation] = useState<ExpenseCats>(emptyCats());
  const [spend, setSpend] = useState<ExpenseSpend>(emptySpend());
  const [autoAlloc, setAutoAlloc] = useState(true);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (months.length === 0) return;
    const m = months.find(x => x.month === ALL_MONTHS[selIdx]);
    setTotalSalary(String(m?.totalSalary ?? 0));
    setSalary(String(m?.salary ?? 0));
    setSplit(m?.split ?? emptyCats());
    setAllocation(m?.allocation ?? emptyCats());
    setSpend(m?.spend ?? emptySpend());
    setNotes(m?.notes ?? "");
    setSaved(false);
    if (!loadedRef.current) { setDirty(false); loadedRef.current = true; }
  }, [months, selIdx]);

  const recalcAllocation = (sal: number, sp: ExpenseCats) => {
    if (!autoAlloc) return;
    const a = {} as ExpenseCats;
    for (const k of CAT_KEYS) a[k] = parseFloat((sal * sp[k] / 100).toFixed(2));
    setAllocation(a);
  };

  const updateSplit = (k: keyof ExpenseCats, v: string) => {
    const n = parseFloat(v) || 0;
    const ns = { ...split, [k]: n };
    setSplit(ns);
    recalcAllocation(parseFloat(salary) || 0, ns);
    setDirty(true);
  };

  const updateSalary = (v: string) => {
    setSalary(v);
    recalcAllocation(parseFloat(v) || 0, split);
    setDirty(true);
  };

  const incomeDiff = (parseFloat(totalSalary) || 0) - (parseFloat(salary) || 0);
  const splitTotal = CAT_KEYS.reduce((s, k) => s + split[k], 0);
  const totalAlloc = CAT_KEYS.reduce((s, k) => s + allocation[k], 0);
  const totalSpend = CAT_KEYS.reduce((s, k) => s + spend[k], 0) + spend.leftOver;

  const handleSave = () => {
    const existing = months.find(x => x.month === selectedMonth);
    const m: ExpenseMonth = {
      id: existing?.id ?? `exp-${selectedMonth}`,
      month: selectedMonth,
      totalSalary: parseFloat(totalSalary) || 0,
      salary: parseFloat(salary) || 0,
      split, allocation, spend,
      notes,
    };
    onSave(m);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Month selector */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <MonthNav
          selectedIdx={selIdx}
          onChange={setSelIdx}
          hasData={m => !!(months.find(x => x.month === m)?.totalSalary)}
        />
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">{monthLabel(selectedMonth)}</p>
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>}
            <Button onClick={handleSave} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />{saved ? "Saved!" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Salary & Plan ─────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 bg-secondary/40 border-b border-border flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1 — Salary & Allocation Plan</p>
        </div>

        {/* Salary row */}
        <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Total Salary (₹)</p>
            <Input type="number" value={totalSalary}
              onChange={e => { setTotalSalary(e.target.value); setDirty(true); }}
              className="bg-secondary border-border font-mono" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Salary for split (₹)</p>
            <Input type="number" value={salary} onChange={e => updateSalary(e.target.value)}
              className="bg-secondary border-border font-mono" />
          </div>
          <div className="rounded-lg bg-secondary px-4 py-3 flex flex-col justify-center">
            <p className="text-xs text-muted-foreground">Extra Income</p>
            <p className={`font-mono font-bold text-sm mt-0.5 ${incomeDiff >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmt(incomeDiff)}</p>
          </div>
          <div className="rounded-lg bg-secondary px-4 py-3 flex flex-col justify-center">
            <p className="text-xs text-muted-foreground">Split % Total</p>
            <p className={`font-mono font-bold text-sm mt-0.5 ${Math.abs(splitTotal - 100) < 0.01 ? "text-emerald-500" : "text-amber-500"}`}>{splitTotal.toFixed(2)}%</p>
          </div>
        </div>

        {/* Split % + Allocation table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border bg-secondary/20">
                <th className="px-4 py-2.5 text-left min-w-[160px]">Category</th>
                <th className="px-4 py-2.5 text-right min-w-[110px]">Split %</th>
                <th className="px-4 py-2.5 text-right min-w-[150px]">
                  <div className="flex items-center justify-end gap-1.5">
                    Allocated (₹)
                    <label className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground/70 cursor-pointer">
                      <input type="checkbox" checked={autoAlloc} onChange={e => setAutoAlloc(e.target.checked)} className="rounded w-3 h-3" />
                      auto
                    </label>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {CAT_KEYS.map(k => (
                <tr key={k} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[k] }} />
                      <span className="font-medium">{CAT_LABELS[k]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Input type="number" step="0.01" value={split[k] || ""}
                      onChange={e => updateSplit(k, e.target.value)}
                      className="bg-secondary border-border font-mono h-8 text-right text-xs w-24 ml-auto" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input type="number" step="0.01" value={allocation[k] || ""}
                      onChange={e => { setAllocation(a => ({ ...a, [k]: parseFloat(e.target.value) || 0 })); setDirty(true); }}
                      className="bg-secondary border-border font-mono h-8 text-right text-xs w-36 ml-auto disabled:opacity-60"
                      disabled={autoAlloc} />
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-secondary/30 font-semibold text-sm">
                <td className="px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wider">Total</td>
                <td className="px-4 py-2.5 font-mono text-right text-xs">{splitTotal.toFixed(2)}%</td>
                <td className="px-4 py-2.5 font-mono text-right text-primary">{fmt(totalAlloc)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 2: Actual Spend ──────────────────── */}
      <div className="rounded-xl border-2 border-orange-500/30 bg-card overflow-hidden">
        <div className="px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Step 2 — Record Actual Spend (end of month)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border bg-secondary/20">
                <th className="px-4 py-2.5 text-left min-w-[160px]">Category</th>
                <th className="px-4 py-2.5 text-right min-w-[110px]">Allocated</th>
                <th className="px-4 py-2.5 text-right min-w-[150px]">Spent (₹) — edit here</th>
                <th className="px-4 py-2.5 text-right min-w-[120px]">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {CAT_KEYS.map(k => {
                const rem = allocation[k] - spend[k];
                const pct = allocation[k] > 0 ? Math.min((spend[k] / allocation[k]) * 100, 100) : 0;
                const over = spend[k] > allocation[k] && allocation[k] > 0;
                return (
                  <tr key={k} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[k] }} />
                        <span className="font-medium">{CAT_LABELS[k]}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden w-full max-w-[140px]">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, background: over ? "#ef4444" : pct > 90 ? "#f59e0b" : CAT_COLORS[k] }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">{fmt(allocation[k])}</td>
                    <td className="px-4 py-2.5">
                      <Input type="number" step="0.01" value={spend[k] || ""}
                        onChange={e => { setSpend(s => ({ ...s, [k]: parseFloat(e.target.value) || 0 })); setDirty(true); }}
                        className="bg-orange-500/5 border-orange-500/30 font-mono h-8 text-right text-xs w-36 ml-auto focus:border-orange-500" />
                    </td>
                    <td className={`px-4 py-2.5 font-mono text-right font-semibold ${rem < 0 ? "text-red-500" : rem > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {rem !== 0 ? (rem < 0 ? "−" : "+") + fmt(Math.abs(rem)) : "—"}
                    </td>
                  </tr>
                );
              })}

              {/* Misc row */}
              <tr className="border-t border-dashed border-border bg-secondary/10">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-gray-400" />
                    <span className="font-medium text-muted-foreground">Misc / Left Over Cash</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 ml-4">cash kept outside categories</p>
                </td>
                <td className="px-4 py-2.5 font-mono text-right text-muted-foreground text-xs">{fmt(incomeDiff)}</td>
                <td className="px-4 py-2.5">
                  <Input type="number" step="0.01" value={spend.leftOver || ""}
                    onChange={e => { setSpend(s => ({ ...s, leftOver: parseFloat(e.target.value) || 0 })); setDirty(true); }}
                    className="bg-orange-500/5 border-orange-500/30 font-mono h-8 text-right text-xs w-36 ml-auto focus:border-orange-500" />
                </td>
                <td className={`px-4 py-2.5 font-mono text-right font-semibold ${(incomeDiff - spend.leftOver) < 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {fmt(Math.abs(incomeDiff - spend.leftOver))}
                </td>
              </tr>

              {/* Totals */}
              <tr className="border-t-2 border-border font-bold bg-secondary/40">
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                <td className="px-4 py-3 font-mono text-right">{fmt(totalAlloc + incomeDiff)}</td>
                <td className="px-4 py-3 font-mono text-right text-orange-500">{fmt(totalSpend)}</td>
                <td className={`px-4 py-3 font-mono text-right ${(totalAlloc + incomeDiff - totalSpend) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {fmt(Math.abs(totalAlloc + incomeDiff - totalSpend))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 bg-secondary/40 border-b border-border flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes / Personal Breakdown</p>
        </div>
        <div className="p-4">
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setDirty(true); }}
            placeholder={`e.g.\nPersonal Expenses: Groceries 4000, Dining 3000, Fuel 2000\nFamily: Vegetables 800, Milk 600\nGold: 2 grams @ 7200/g`}
            rows={5}
            className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2 px-6">
          <Save className="h-4 w-4" />{saved ? "Saved!" : "Save Month"}
        </Button>
      </div>
    </div>
  );
}

// ── Annual Summary ────────────────────────────────────────────────────────────
function AnnualSummary({ months }: { months: ExpenseMonth[] }) {
  const activeMonths = months.filter(m => m.totalSalary > 0);
  const totals = useMemo(() => {
    const t = { totalSalary: 0, salary: 0, leftOver: 0, allocation: emptyCats(), spend: { ...emptyCats(), leftOver: 0 } };
    for (const m of activeMonths) {
      t.totalSalary += m.totalSalary;
      t.salary += m.salary;
      t.leftOver += m.totalSalary - m.salary;
      for (const k of CAT_KEYS) { t.allocation[k] += m.allocation[k]; t.spend[k] += m.spend[k]; }
      t.spend.leftOver += m.spend.leftOver;
    }
    return t;
  }, [months]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Allocation by Month</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="px-3 py-3 text-left sticky left-0 bg-secondary z-10 min-w-[100px]">Month</th>
                <th className="px-3 py-3 text-right min-w-[90px]">Salary</th>
                {CAT_KEYS.map(k => (
                  <th key={k} className="px-3 py-3 text-right min-w-[100px]">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[k] }} />
                      {CAT_LABELS[k]}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-right min-w-[90px]">Misc</th>
                <th className="px-3 py-3 text-right min-w-[90px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeMonths.map(m => {
                const misc = m.totalSalary - m.salary;
                const total = CAT_KEYS.reduce((s, k) => s + m.allocation[k], 0) + misc;
                const cols = CAT_KEYS.length + 4; // month + salary + cats + misc + total
                return (
                  <Fragment key={m.month}>
                    <tr className="border-t border-border/60 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium sticky left-0 bg-card">{monthLabel(m.month, true)} {m.month.split("-")[0]}</td>
                      <td className="px-3 py-2.5 font-mono text-right">{m.salary ? fmt(m.salary) : "—"}</td>
                      {CAT_KEYS.map(k => <td key={k} className="px-3 py-2.5 font-mono text-right">{m.allocation[k] ? fmt(m.allocation[k]) : "—"}</td>)}
                      <td className="px-3 py-2.5 font-mono text-right">{misc ? fmt(misc) : "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-right font-semibold text-primary">{total ? fmt(total) : "—"}</td>
                    </tr>
                    {m.notes && (
                      <tr className="border-b border-border/40 bg-emerald-500/5">
                        <td colSpan={cols} className="px-4 py-2">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{m.notes}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-border font-bold bg-secondary/50">
                <td className="px-3 py-3 sticky left-0 bg-secondary/50">Total</td>
                <td className="px-3 py-3 font-mono text-right">{fmt(totals.salary)}</td>
                {CAT_KEYS.map(k => <td key={k} className="px-3 py-3 font-mono text-right">{fmt(totals.allocation[k])}</td>)}
                <td className="px-3 py-3 font-mono text-right">{fmt(totals.leftOver)}</td>
                <td className="px-3 py-3 font-mono text-right text-primary">{fmt(CAT_KEYS.reduce((s, k) => s + totals.allocation[k], 0) + totals.leftOver)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Actual Spend by Month</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="px-3 py-3 text-left sticky left-0 bg-secondary z-10 min-w-[100px]">Month</th>
                {CAT_KEYS.map(k => (
                  <th key={k} className="px-3 py-3 text-right min-w-[100px]">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[k] }} />
                      {CAT_LABELS[k]}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-right min-w-[80px]">Misc</th>
                <th className="px-3 py-3 text-right min-w-[90px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeMonths.map(m => {
                const total = CAT_KEYS.reduce((s, k) => s + m.spend[k], 0) + m.spend.leftOver;
                const cols = CAT_KEYS.length + 3; // month + cats + misc + total
                return (
                  <Fragment key={m.month}>
                    <tr className="border-t border-border/60 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium sticky left-0 bg-card">{monthLabel(m.month, true)} {m.month.split("-")[0]}</td>
                      {CAT_KEYS.map(k => <td key={k} className="px-3 py-2.5 font-mono text-right">{m.spend[k] ? fmt(m.spend[k]) : "—"}</td>)}
                      <td className="px-3 py-2.5 font-mono text-right">{m.spend.leftOver ? fmt(m.spend.leftOver) : "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-right font-semibold text-orange-500">{total ? fmt(total) : "—"}</td>
                    </tr>
                    {m.notes && (
                      <tr className="border-b border-border/40 bg-emerald-500/5">
                        <td colSpan={cols} className="px-4 py-2">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{m.notes}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-border font-bold bg-secondary/50">
                <td className="px-3 py-3 sticky left-0 bg-secondary/50">Total</td>
                {CAT_KEYS.map(k => <td key={k} className="px-3 py-3 font-mono text-right">{fmt(totals.spend[k])}</td>)}
                <td className="px-3 py-3 font-mono text-right">{fmt(totals.spend.leftOver)}</td>
                <td className="px-3 py-3 font-mono text-right text-orange-500">
                  {fmt(CAT_KEYS.reduce((s, k) => s + totals.spend[k], 0) + totals.spend.leftOver)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────
function BalanceSheet({ config, months }: { config: ExpenseConfig; months: ExpenseMonth[] }) {
  const rows = useMemo(() => computeBalance(config, months), [config, months]);
  const openingTotal = CAT_KEYS.reduce((s, k) => s + config.initialBalance[k], 0);
  return (
    <div className="space-y-3">
    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-600 dark:text-blue-400">
      <span className="font-semibold">Note:</span> This balance sheet starts from your 2025 opening balance ({fmt(openingTotal)}) and adds/subtracts each month's allocation vs spend. The Annual Summary only shows 2026 month-by-month data, so the totals will differ by that opening amount.
    </div>
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="px-3 py-3 text-left sticky left-0 bg-secondary z-10 min-w-[120px]">Month</th>
            {CAT_KEYS.map(k => (
              <th key={k} className="px-3 py-3 text-right min-w-[110px]">
                <div className="flex items-center justify-end gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[k] }} />
                  {CAT_LABELS[k]}
                </div>
              </th>
            ))}
            <th className="px-3 py-3 text-right min-w-[90px]">Left Over</th>
            <th className="px-3 py-3 text-right min-w-[110px]">Total Unspent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const note = months.find(m => m.month === row.month)?.notes;
            const cols = CAT_KEYS.length + 3; // month + cats + leftOver + total
            return (
              <Fragment key={row.month}>
                <tr className={`border-t border-border/60 hover:bg-secondary/30 transition-colors ${i === 0 ? "bg-secondary/20 font-semibold" : ""}`}>
                  <td className="px-3 py-2.5 font-medium sticky left-0 bg-card text-xs">{row.label}</td>
                  {CAT_KEYS.map(k => (
                    <td key={k} className={`px-3 py-2.5 font-mono text-right ${row.balance[k] < 0 ? "text-red-500" : row.balance[k] > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {row.balance[k] !== 0 ? fmt(row.balance[k]) : "—"}
                    </td>
                  ))}
                  <td className={`px-3 py-2.5 font-mono text-right ${row.leftOver < 0 ? "text-red-500" : row.leftOver > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {row.leftOver !== 0 ? fmt(row.leftOver) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right font-bold text-primary">
                    {fmt(row.total)}
                  </td>
                </tr>
                {note && (
                  <tr className="border-b border-border/40 bg-emerald-500/5">
                    <td colSpan={cols} className="px-4 py-2">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{note}</p>
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
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsView({ config, onSave }: { config: ExpenseConfig; onSave: (c: ExpenseConfig) => void }) {
  const [bal, setBal] = useState<ExpenseConfig["initialBalance"]>({ ...config.initialBalance });
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    onSave({ initialBalance: bal });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">Carry-forward balances from Year 2025 (starting point for Jan 2026).</p>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {CAT_KEYS.map(k => (
          <div key={k} className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-48 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[k] }} />
              <span className="text-sm">{CAT_LABELS[k]}</span>
            </div>
            <Input type="number" step="0.01" value={bal[k] || ""}
              onChange={e => setBal(b => ({ ...b, [k]: parseFloat(e.target.value) || 0 }))}
              className="bg-secondary border-border font-mono" />
          </div>
        ))}
      </div>
      <Button onClick={handleSave} className="gap-2">
        <Save className="h-4 w-4" />{saved ? "Saved!" : "Save Opening Balances"}
      </Button>
    </div>
  );
}

// ── Calculator ────────────────────────────────────────────────────────────────
function CalculatorView({ months, config }: { months: ExpenseMonth[]; config: ExpenseConfig }) {
  const [category, setCategory]   = useState<keyof ExpenseCats>("savings");
  const [salary, setSalary]       = useState("");
  const [pct, setPct]             = useState("");
  const [numMonths, setNumMonths] = useState("");

  const balanceRows = useMemo(() => computeBalance(config, months), [config, months]);
  const latestRow   = balanceRows.length > 1 ? balanceRows[balanceRows.length - 1] : balanceRows[0];
  const existingBalance = latestRow?.balance[category] ?? 0;

  const S = parseFloat(salary)    || 0;
  const P = parseFloat(pct)       || 0;
  const n = parseInt(numMonths)   || 0;

  const monthlyAlloc = parseFloat(((S * P) / 100).toFixed(2));
  const totalNew     = parseFloat((monthlyAlloc * n).toFixed(2));
  const grandTotal   = parseFloat((totalNew + existingBalance).toFixed(2));

  const rows = useMemo(() => {
    if (!monthlyAlloc || !n) return [];
    return Array.from({ length: n }, (_, i) => ({
      month: i + 1,
      alloc: monthlyAlloc,
      cumulative: parseFloat((monthlyAlloc * (i + 1)).toFixed(2)),
      withExisting: parseFloat((monthlyAlloc * (i + 1) + existingBalance).toFixed(2)),
    }));
  }, [monthlyAlloc, n, existingBalance]);

  const chartData = rows.map(r => ({
    month: `M${r.month}`,
    "Cumulative Saved": r.cumulative,
    "With Existing": r.withExisting,
  }));

  const fmtR = (v: number) => v ? fmt(v) : "—";
  const catColor = CAT_COLORS[category];
  const tooltipStyle = CHART_TOOLTIP_STYLE;

  const ready = S > 0 && P > 0 && n > 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Input + current balance side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Savings Planner</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Category</p>
                <select value={category} onChange={e => setCategory(e.target.value as keyof ExpenseCats)}
                  className="w-full h-10 rounded-xl border-2 font-semibold text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  style={{ borderColor: catColor, background: `${catColor}10`, color: catColor }}>
                  {CAT_KEYS.map(k => (
                    <option key={k} value={k} style={{ color: "inherit", background: "hsl(var(--card))" }}>{CAT_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Number of Months</p>
                <Input type="number" step="1" value={numMonths}
                  onChange={e => setNumMonths(e.target.value)}
                  placeholder="e.g. 12"
                  className="font-mono bg-secondary border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Base Salary (₹)</p>
                <Input type="number" step="100" value={salary}
                  onChange={e => setSalary(e.target.value)}
                  placeholder="e.g. 60000"
                  className="font-mono bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Allocation %</p>
                <Input type="number" step="0.5" value={pct}
                  onChange={e => setPct(e.target.value)}
                  placeholder="e.g. 15"
                  className="font-mono bg-secondary border-border" />
              </div>
            </div>
            {/* Live formula */}
            {S > 0 && P > 0 && (
              <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm"
                style={{ background: `${catColor}10`, border: `1px solid ${catColor}30` }}>
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: catColor }} />
                <span className="text-muted-foreground text-xs">Monthly:</span>
                <span className="font-bold font-mono text-sm" style={{ color: catColor }}>
                  {fmtR(S)} × {P}% = {fmtR(monthlyAlloc)} / month
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Current balance — always visible as soon as category is chosen */}
        <div className="rounded-2xl overflow-hidden shadow-sm flex flex-col"
          style={{ background: `${catColor}10`, border: `2px solid ${catColor}35` }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: `${catColor}25`, background: `${catColor}15` }}>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="h-3 w-3 rounded-full" style={{ background: catColor }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: catColor }}>{CAT_LABELS[category]}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Current amount in hand</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 gap-1">
            <p className="text-4xl font-bold font-mono" style={{ color: catColor }}>
              {existingBalance > 0 ? fmtR(existingBalance) : "₹0"}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              as of {latestRow?.label ?? "balance sheet"}
            </p>
          </div>
          {ready && (
            <div className="px-5 pb-5 space-y-2 border-t pt-4" style={{ borderColor: `${catColor}25` }}>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">+ New savings</span>
                <span className="font-mono font-semibold text-blue-500">{fmtR(totalNew)}</span>
              </div>
              <div className="h-px" style={{ background: `${catColor}30` }} />
              <div className="flex justify-between text-sm">
                <span className="font-semibold" style={{ color: catColor }}>Total after {n}m</span>
                <span className="font-bold font-mono" style={{ color: catColor }}>{fmtR(grandTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {ready && (
        <>
          {/* Result stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Monthly Allocation",         value: fmtR(monthlyAlloc), sub: `${P}% of ${fmtR(S)}`,          color: "#6366f1" },
              { label: `New over ${n} months`,       value: fmtR(totalNew),     sub: `${n} × ${fmtR(monthlyAlloc)}`, color: "#3b82f6" },
              { label: "Current Balance",            value: fmtR(existingBalance), sub: latestRow?.label ?? "—",     color: catColor  },
              { label: "Grand Total",                value: fmtR(grandTotal),   sub: "new + existing",               color: "#10b981" },
            ].map(card => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: card.color }} />
                  <p className="text-xs text-muted-foreground leading-snug">{card.label}</p>
                </div>
                <p className="text-xl font-bold font-mono">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Grand total banner */}
          <div className="rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4"
            style={{ background: `${catColor}10`, border: `2px solid ${catColor}35` }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: catColor }}>
                Total {CAT_LABELS[category]} after {n} months
              </p>
              <p className="text-4xl font-bold font-mono" style={{ color: catColor }}>{fmtR(grandTotal)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {fmtR(totalNew)} new savings&nbsp;&nbsp;+&nbsp;&nbsp;{fmtR(existingBalance)} already in {CAT_LABELS[category]}
              </p>
            </div>
            <div className="flex flex-col gap-3 text-right">
              <div>
                <p className="text-xs text-muted-foreground">Current in {CAT_LABELS[category]}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: catColor }}>{fmtR(existingBalance)}</p>
              </div>
              <div className="text-xs px-3 py-1 rounded-lg" style={{ background: `${catColor}15`, color: catColor }}>
                {fmtR(monthlyAlloc)}/mo × {n} months
              </div>
            </div>
          </div>

          {/* Area chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold mb-1">Cumulative Savings Growth</p>
            <p className="text-xs text-muted-foreground mb-4">Blue = new savings only · Colored = including current {CAT_LABELS[category]} balance</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={catColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={catColor} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.ceil(n / 12) - 1)} />
                <YAxis tickFormatter={v => fmt(v, true)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="Cumulative Saved" stroke="#3b82f6" fill="url(#gradCum)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="With Existing" stroke={catColor} fill="url(#gradTotal)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Month-by-month table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Month-by-Month</p>
              <p className="text-xs text-muted-foreground">{fmtR(monthlyAlloc)}/month · {n} months</p>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-secondary/80 text-muted-foreground border-b border-border uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left min-w-[80px]">Month</th>
                    <th className="px-4 py-2.5 text-right min-w-[110px]">This Month</th>
                    <th className="px-4 py-2.5 text-right min-w-[130px]">New Cumulative</th>
                    <th className="px-4 py-2.5 text-right min-w-[150px]">Total with Existing</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const isYearly = r.month % 12 === 0;
                    const isFinal  = r.month === n;
                    return (
                      <tr key={r.month}
                        className={`border-t border-border/40 transition-colors ${
                          isFinal ? "font-bold" : isYearly ? "bg-primary/5 font-semibold" : "hover:bg-secondary/20"
                        }`}
                        style={isFinal ? { background: `${catColor}10` } : undefined}>
                        <td className="px-4 py-2.5 font-mono">
                          {isFinal ? `M${r.month} ★` : isYearly ? `M${r.month} (${r.month/12}yr)` : `M${r.month}`}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-right text-muted-foreground">{fmtR(r.alloc)}</td>
                        <td className="px-4 py-2.5 font-mono text-right text-blue-500">{fmtR(r.cumulative)}</td>
                        <td className="px-4 py-2.5 font-mono text-right font-bold" style={{ color: catColor }}>{fmtR(r.withExisting)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!ready && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 flex flex-col items-center gap-2 text-muted-foreground">
          <p className="text-sm">Enter salary, allocation %, and number of months to see the projection.</p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExpenseTracker({ months, config, onSaveMonth, onSaveConfig }: Props) {
  const [view, setView] = useState<View>("overview");
  const { months: personalMonths, saveMonth: savePersonalMonth } = usePersonalExpense();

  const tabs: { id: View; label: string }[] = [
    { id: "overview",    label: "Overview" },
    { id: "monthly",     label: "Monthly Entry" },
    { id: "summary",     label: "Annual Summary" },
    { id: "balance",     label: "Balance Sheet" },
    { id: "personal",    label: "Personal Expenses" },
    { id: "calculator",  label: "Calculator" },
    { id: "settings",    label: "Opening Balances" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Tab nav */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
              view === t.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "overview"  && <Overview months={months} config={config} />}
      {view === "monthly"   && <MonthlyEntry months={months} onSave={onSaveMonth} />}
      {view === "summary"   && <AnnualSummary months={months} />}
      {view === "balance"   && <BalanceSheet config={config} months={months} />}
      {view === "personal"   && <PersonalExpenses months={personalMonths} onSave={savePersonalMonth} />}
      {view === "calculator" && <CalculatorView months={months} config={config} />}
      {view === "settings"   && <SettingsView config={config} onSave={onSaveConfig} />}
    </div>
  );
}
