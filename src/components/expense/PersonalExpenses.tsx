import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { PersonalExpenseMonth, PersonalCats, PERSONAL_KEYS, PERSONAL_LABELS, PERSONAL_COLORS } from "@/types/expense";
import { emptyPersonalCats } from "@/hooks/usePersonalExpense";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, TrendingUp, BarChart2, Wallet, Calendar } from "lucide-react";
import MonthNav from "@/components/expense/MonthNav";
import StatCard from "@/components/common/StatCard";
import { fmtInr, monthLabel, ALL_MONTHS, MONTH_NAMES, CHART_TOOLTIP_STYLE } from "@/lib/expense-utils";

interface Props {
  months: PersonalExpenseMonth[];
  onSave: (m: PersonalExpenseMonth) => void;
}

const fmt      = (n: number) => fmtInr(n);
const fmtShort = (n: number) => fmtInr(n, true);

const FOOD_GROUP: (keyof PersonalCats)[] = ["breakfast","lunch","dinner","snacks","food","tea","beverages","grocery"];
const TRAVEL_GROUP: (keyof PersonalCats)[] = ["bus","cab","fuel","bikeRent","trainMetro"];
const SOCIAL_GROUP: (keyof PersonalCats)[] = ["friend","friendsOut","smoke","movies"];
const PERSONAL_GROUP: (keyof PersonalCats)[] = ["me","beauty","recharge","medicine","charges","product","dress","other"];

const GROUPS = [
  {
    label: "Food & Drinks", keys: FOOD_GROUP,
    accent: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)",
    textClass: "text-orange-500",
  },
  {
    label: "Travel", keys: TRAVEL_GROUP,
    accent: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)",
    textClass: "text-blue-500",
  },
  {
    label: "Social", keys: SOCIAL_GROUP,
    accent: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)",
    textClass: "text-purple-500",
  },
  {
    label: "Personal", keys: PERSONAL_GROUP,
    accent: "#ec4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)",
    textClass: "text-pink-500",
  },
];

// ── Entry panel ────────────────────────────────────────────────────────────────
function EntryPanel({ months, onSave }: Props) {
  const [selIdx, setSelIdx] = useState(Math.min(new Date().getMonth(), 11));
  const [entries, setEntries] = useState<PersonalCats>(emptyPersonalCats());
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (months.length === 0 && loadedRef.current) return;
    const m = months.find(x => x.month === ALL_MONTHS[selIdx]);
    setEntries({ ...emptyPersonalCats(), ...(m?.entries ?? {}) });
    setNotes(m?.notes ?? "");
    setSaved(false);
    if (!loadedRef.current) { setDirty(false); loadedRef.current = true; }
    else setDirty(false);
  }, [months, selIdx]);

  const total = PERSONAL_KEYS.reduce((s, k) => s + entries[k], 0);
  const hasData = months.some(m => m.month === ALL_MONTHS[selIdx]);

  const handleSave = () => {
    const existing = months.find(x => x.month === ALL_MONTHS[selIdx]);
    onSave({
      id: existing?.id ?? `pe-${ALL_MONTHS[selIdx]}`,
      month: ALL_MONTHS[selIdx],
      entries,
      notes,
    });
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (k: keyof PersonalCats, v: string) => {
    setEntries(e => ({ ...e, [k]: parseFloat(v) || 0 }));
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      {/* Month strip */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Top bar: month nav */}
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <MonthNav
            selectedIdx={selIdx}
            onChange={setSelIdx}
            hasData={m => months.some(x => x.month === m)}
          />
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">{monthLabel(ALL_MONTHS[selIdx])}</span>
              <span className="text-2xl font-bold text-foreground font-mono">{total > 0 ? fmtShort(total) : "₹0"}</span>
            </div>
            {hasData && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">saved</span>}
            {dirty && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20">unsaved</span>}
          </div>
          <div className="flex items-center gap-3">
            {/* Group mini pills */}
            <div className="hidden sm:flex items-center gap-1.5">
              {GROUPS.map(g => {
                const gt = g.keys.reduce((s, k) => s + entries[k], 0);
                return gt > 0 ? (
                  <span key={g.label} className="text-xs font-mono px-2 py-1 rounded-lg"
                    style={{ background: g.bg, color: g.accent, border: `1px solid ${g.border}` }}>
                    {g.label.split(" ")[0]}: {fmtShort(gt)}
                  </span>
                ) : null;
              })}
            </div>
            <Button size="sm" onClick={handleSave}
              className={`gap-1.5 transition-all ${saved ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}>
              <Save className="h-3.5 w-3.5" />{saved ? "Saved!" : "Save"}
            </Button>
          </div>
        </div>

        {/* Category group progress bars */}
        {total > 0 && (
          <div className="px-5 pb-3 flex gap-1.5 h-2">
            {GROUPS.map(g => {
              const gt = g.keys.reduce((s, k) => s + entries[k], 0);
              const pct = (gt / total) * 100;
              return pct > 0 ? (
                <div key={g.label} className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: g.accent, opacity: 0.7 }}
                  title={`${g.label}: ${pct.toFixed(1)}%`} />
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Category groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {GROUPS.map(g => {
          const groupTotal = g.keys.reduce((s, k) => s + entries[k], 0);
          const groupPct = total > 0 ? (groupTotal / total) * 100 : 0;

          return (
            <div key={g.label} className="rounded-2xl border bg-card overflow-hidden shadow-sm"
              style={{ borderColor: g.border }}>
              {/* Group header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: g.bg, borderBottom: `1px solid ${g.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: g.accent }} />
                  <span className="text-sm font-semibold" style={{ color: g.accent }}>{g.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {groupPct > 0 && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                      style={{ background: `${g.accent}20`, color: g.accent }}>
                      {groupPct.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-sm font-bold font-mono" style={{ color: g.accent }}>
                    {groupTotal > 0 ? fmtShort(groupTotal) : "—"}
                  </span>
                </div>
              </div>

              {/* Group progress bar */}
              <div className="h-1" style={{ background: `${g.accent}15` }}>
                <div className="h-full transition-all" style={{ width: `${groupPct}%`, background: g.accent, opacity: 0.5 }} />
              </div>

              {/* Category rows */}
              <div className="divide-y divide-border/40">
                {g.keys.map(k => {
                  const val = entries[k];
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  const groupPctOfCat = groupTotal > 0 ? (val / groupTotal) * 100 : 0;

                  return (
                    <div key={k} className="px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: PERSONAL_COLORS[k] }} />
                        <span className="text-sm text-foreground/90 flex-1">{PERSONAL_LABELS[k]}</span>
                        {pct > 0 && (
                          <span className="text-xs font-mono text-muted-foreground">{pct.toFixed(1)}%</span>
                        )}
                        <Input
                          type="number" step="0.01" value={val || ""}
                          onChange={e => update(k, e.target.value)}
                          placeholder="0"
                          className="w-28 h-7 text-right text-xs font-mono bg-secondary/60 border-border/60 focus:bg-background"
                        />
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-0.5 bg-border/30 rounded-full ml-4 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${groupPctOfCat}%`, background: PERSONAL_COLORS[k], opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notes</span>
        </div>
        <div className="p-4">
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setDirty(true); }}
            placeholder="Add any extra details, one-off spends, or clarifications..."
            rows={3}
            className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>
      </div>
    </div>
  );
}

// ── Charts panel ──────────────────────────────────────────────────────────────
function ChartsPanel({ months }: { months: PersonalExpenseMonth[] }) {
  const activeMonths = months.filter(m => PERSONAL_KEYS.some(k => (m.entries[k] || 0) > 0));

  const monthlyTotals = activeMonths.map(m => ({
    month: MONTH_NAMES[parseInt(m.month.split("-")[1]) - 1],
    Total: parseFloat(PERSONAL_KEYS.reduce((s, k) => s + (m.entries[k] || 0), 0).toFixed(2)),
  }));

  let cum = 0;
  const cumulativeData = activeMonths.map(m => {
    cum += PERSONAL_KEYS.reduce((s, k) => s + (m.entries[k] || 0), 0);
    return { month: MONTH_NAMES[parseInt(m.month.split("-")[1]) - 1], Cumulative: parseFloat(cum.toFixed(2)) };
  });

  const catTotals = PERSONAL_KEYS.map(k => ({
    name: PERSONAL_LABELS[k],
    key: k,
    value: parseFloat(activeMonths.reduce((s, m) => s + (m.entries[k] || 0), 0).toFixed(2)),
    color: PERSONAL_COLORS[k],
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const grandYTD = catTotals.reduce((s, d) => s + d.value, 0);

  const top8 = catTotals.slice(0, 8).map(d => d.name);
  const stackedData = activeMonths.map(m => {
    const row: Record<string, number | string> = { month: MONTH_NAMES[parseInt(m.month.split("-")[1]) - 1] };
    for (const k of PERSONAL_KEYS) {
      if (top8.includes(PERSONAL_LABELS[k])) row[PERSONAL_LABELS[k]] = parseFloat((m.entries[k] || 0).toFixed(2));
    }
    return row;
  });

  // Avg monthly spend
  const avgMonthly = activeMonths.length > 0 ? grandYTD / activeMonths.length : 0;
  const topCat = catTotals[0];
  const maxMonth = monthlyTotals.reduce((a, b) => a.Total > b.Total ? a : b, { month: "—", Total: 0 });

  if (activeMonths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-3">
        <BarChart2 className="h-12 w-12 opacity-20" />
        <p>No data yet — add entries in the Monthly Entry tab.</p>
      </div>
    );
  }

  const tooltipStyle = CHART_TOOLTIP_STYLE;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="YTD Spent"     value={fmtShort(grandYTD)}   sub={`${activeMonths.length} months`}
          iconBg="bg-indigo-500/10 text-indigo-500" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Monthly Avg"   value={fmtShort(avgMonthly)} sub="per month"
          iconBg="bg-emerald-500/10 text-emerald-500" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Top Category"  value={topCat?.name ?? "—"}  sub={topCat ? fmtShort(topCat.value) : "—"}
          iconBg="bg-orange-500/10 text-orange-500" icon={<BarChart2 className="h-5 w-5" />} />
        <StatCard label="Highest Month" value={maxMonth.month}        sub={fmtShort(maxMonth.Total)}
          iconBg="bg-pink-500/10 text-pink-500" icon={<Calendar className="h-5 w-5" />} />
      </div>

      {/* Monthly bar + cumulative */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold mb-4">Monthly Spending</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTotals} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtShort(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [fmt(v), "Spent"]} contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--secondary))" }} />
              <Bar dataKey="Total" fill="#6366f1" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold mb-4">Cumulative (YTD)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtShort(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [fmt(v), "Cumulative"]} contentStyle={tooltipStyle} />
              <Line dataKey="Cumulative" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stacked bar + pie + category ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold mb-4">Category Breakdown by Month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stackedData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtShort(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={8} />
              {PERSONAL_KEYS.filter(k => top8.includes(PERSONAL_LABELS[k])).map(k => (
                <Bar key={k} dataKey={PERSONAL_LABELS[k]} stackId="a" fill={PERSONAL_COLORS[k]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold mb-3">YTD Split</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={catTotals} cx="50%" cy="50%" innerRadius={36} outerRadius={65} dataKey="value" paddingAngle={2}>
                {catTotals.map(d => <Cell key={d.key} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [fmt(v), "Spent"]} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          {/* Category ranking list */}
          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {catTotals.map(d => {
              const pct = grandYTD > 0 ? (d.value / grandYTD) * 100 : 0;
              return (
                <div key={d.name}>
                  <div className="flex items-center gap-1.5 text-xs mb-0.5">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="flex-1 text-foreground/80 truncate">{d.name}</span>
                    <span className="font-mono text-muted-foreground">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-border/30 rounded-full ml-3.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Monthly Breakdown</p>
          <p className="text-xs text-muted-foreground">{activeMonths.length} month{activeMonths.length !== 1 ? "s" : ""} of data</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/20 text-muted-foreground border-b border-border">
                <th className="px-4 py-3 text-left sticky left-0 bg-secondary/20 z-10 min-w-[72px] font-semibold uppercase tracking-wider">Month</th>
                {PERSONAL_KEYS.map(k => (
                  <th key={k} className="px-3 py-3 text-right min-w-[76px] font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: PERSONAL_COLORS[k] }} />
                      {PERSONAL_LABELS[k]}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right min-w-[90px] font-bold text-foreground sticky right-0 bg-secondary/20">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeMonths.map(m => {
                const rowTotal = PERSONAL_KEYS.reduce((s, k) => s + (m.entries[k] || 0), 0);
                const cols = PERSONAL_KEYS.length + 2;
                return (
                  <Fragment key={m.month}>
                    <tr className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 font-semibold sticky left-0 bg-card z-10">{MONTH_NAMES[parseInt(m.month.split("-")[1]) - 1]}</td>
                      {PERSONAL_KEYS.map(k => (
                        <td key={k} className="px-3 py-2.5 font-mono text-right">
                          {(m.entries[k] || 0) > 0 ? (
                            <span className="text-foreground">{fmt(m.entries[k])}</span>
                          ) : <span className="text-border">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 font-mono text-right font-bold text-primary sticky right-0 bg-card">{fmt(rowTotal)}</td>
                    </tr>
                    <tr className="bg-secondary/10 border-b border-border/20">
                      <td className="px-4 py-1 sticky left-0 bg-secondary/10 text-muted-foreground italic z-10">%</td>
                      {PERSONAL_KEYS.map(k => {
                        const pct = rowTotal > 0 ? ((m.entries[k] || 0) / rowTotal) * 100 : 0;
                        return (
                          <td key={k} className="px-3 py-1 font-mono text-right text-muted-foreground">
                            {pct > 0 ? pct.toFixed(1) + "%" : ""}
                          </td>
                        );
                      })}
                      <td className="px-4 py-1 font-mono text-right text-muted-foreground sticky right-0 bg-secondary/10">100%</td>
                    </tr>
                    {m.notes && (
                      <tr className="border-b border-border/30 bg-emerald-500/5">
                        <td colSpan={cols} className="px-5 py-2">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{m.notes}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {/* Totals */}
              {(() => {
                const grandTotal = activeMonths.reduce((s, m) => s + PERSONAL_KEYS.reduce((x, k) => x + (m.entries[k] || 0), 0), 0);
                return (
                  <>
                    <tr className="border-t-2 border-border font-bold bg-secondary/40">
                      <td className="px-4 py-3 sticky left-0 bg-secondary/40 z-10">Total</td>
                      {PERSONAL_KEYS.map(k => {
                        const t = activeMonths.reduce((s, m) => s + (m.entries[k] || 0), 0);
                        return <td key={k} className="px-3 py-3 font-mono text-right">{t ? fmt(t) : "—"}</td>;
                      })}
                      <td className="px-4 py-3 font-mono text-right text-primary sticky right-0 bg-secondary/40">{fmt(grandTotal)}</td>
                    </tr>
                    <tr className="bg-secondary/20 border-b border-border">
                      <td className="px-4 py-1.5 sticky left-0 bg-secondary/20 text-muted-foreground italic z-10">% of YTD</td>
                      {PERSONAL_KEYS.map(k => {
                        const t = activeMonths.reduce((s, m) => s + (m.entries[k] || 0), 0);
                        const pct = grandTotal > 0 ? (t / grandTotal) * 100 : 0;
                        return (
                          <td key={k} className="px-3 py-1.5 font-mono text-right text-muted-foreground">
                            {pct > 0 ? pct.toFixed(1) + "%" : "—"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-1.5 font-mono text-right text-muted-foreground sticky right-0 bg-secondary/20">100%</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PersonalExpenses({ months, onSave }: Props) {
  const [tab, setTab] = useState<"entry" | "charts">("entry");
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border">
        {(["entry","charts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}>
            {t === "entry" ? "Monthly Entry" : "Charts & Summary"}
          </button>
        ))}
      </div>
      {tab === "entry"  && <EntryPanel months={months} onSave={onSave} />}
      {tab === "charts" && <ChartsPanel months={months} />}
    </div>
  );
}
