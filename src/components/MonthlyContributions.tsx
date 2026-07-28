import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, CalendarDays, ChevronRight, Layers } from "lucide-react";
import { InvestmentEntry } from "@/types/investment";

interface Props { entries: InvestmentEntry[]; }

interface MonthData {
  key: string;
  label: string;
  total: number;
  cumulative: number;
  trades: InvestmentEntry[];
  sectors: { sector: string; amount: number; pct: number }[];
  stocks: { name: string; sector: string; amount: number; qty: number; pct: number }[];
  tradeCount: number;
  mom: number | null;
}

const PALETTE = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#14b8a6","#f97316","#ec4899","#06b6d4","#84cc16",
  "#a78bfa","#fb923c","#34d399","#60a5fa","#f472b6",
];

function sectorColor(sector: string, allSectors: string[]): string {
  const idx = allSectors.indexOf(sector);
  return PALETTE[idx % PALETTE.length];
}

function fmt(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildMonthList(entries: InvestmentEntry[]): MonthData[] {
  const map = new Map<string, InvestmentEntry[]>();
  for (const e of entries) {
    const k = e.date.slice(0, 7);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(e);
  }

  const sortedKeys = Array.from(map.keys()).sort();
  const result: MonthData[] = [];
  let cumulative = 0;

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const trades = map.get(key)!;
    const total = trades.reduce((s, e) => s + e.amount, 0);
    cumulative += total;

    const sectorMap = new Map<string, number>();
    for (const e of trades) sectorMap.set(e.sector, (sectorMap.get(e.sector) ?? 0) + e.amount);
    const sectors = Array.from(sectorMap.entries())
      .map(([sector, amount]) => ({ sector, amount, pct: (amount / total) * 100 }))
      .sort((a, b) => b.amount - a.amount);

    const stockMap = new Map<string, { sector: string; amount: number; qty: number }>();
    for (const e of trades) {
      const sk = e.stockName.trim().toUpperCase();
      const ex = stockMap.get(sk);
      stockMap.set(sk, { sector: e.sector, amount: (ex?.amount ?? 0) + e.amount, qty: (ex?.qty ?? 0) + e.quantity });
    }
    const stocks = Array.from(stockMap.entries())
      .map(([name, v]) => ({ name, ...v, pct: (v.amount / total) * 100 }))
      .sort((a, b) => b.amount - a.amount);

    const prevTotal = i > 0 ? result[i - 1].total : null;
    const mom = prevTotal !== null && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

    const [year, month] = key.split("-");
    result.push({
      key,
      label: `${MN[parseInt(month) - 1]} ${year}`,
      total, cumulative, trades, sectors, stocks,
      tradeCount: trades.length, mom,
    });
  }

  return result.reverse();
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MomBadge({ mom }: { mom: number | null }) {
  if (mom === null) return null;
  const up = mom > 0, down = mom < 0;
  return (
    <span className={`text-[10px] font-mono flex items-center gap-0.5 shrink-0 ${up ? "text-emerald-500" : down ? "text-red-400" : "text-muted-foreground"}`}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : down ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
      {up ? "+" : ""}{mom.toFixed(1)}%
    </span>
  );
}

function SectorDonut({ sectors, allSectors }: { sectors: MonthData["sectors"]; allSectors: string[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sector Allocation</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={sectors} dataKey="amount" nameKey="sector" cx="50%" cy="50%"
            innerRadius={50} outerRadius={75} paddingAngle={2}>
            {sectors.map(s => (
              <Cell key={s.sector} fill={sectorColor(s.sector, allSectors)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, _name: string, props: { payload?: { sector?: string; pct?: number } }) => [
              `${fmt(v)} (${(props.payload?.pct ?? 0).toFixed(1)}%)`,
              props.payload?.sector ?? "",
            ]}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 mt-1">
        {sectors.map(s => (
          <div key={s.sector} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sectorColor(s.sector, allSectors) }} />
            <span className="text-xs flex-1 truncate text-muted-foreground">{s.sector}</span>
            <span className="text-xs font-mono">{s.pct.toFixed(1)}%</span>
            <span className="text-xs font-mono text-muted-foreground w-16 text-right">{fmt(s.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockBars({ stocks, allSectors }: { stocks: MonthData["stocks"]; allSectors: string[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Stock Breakdown</p>
      <div className="space-y-3">
        {stocks.map(s => (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sectorColor(s.sector, allSectors) }} />
                <span className="text-xs font-medium truncate">{s.name}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline shrink-0">({s.sector})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">{fmt(s.amount)}</span>
                <span className="text-xs font-mono font-semibold w-9 text-right">{s.pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${s.pct}%`, backgroundColor: sectorColor(s.sector, allSectors) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeList({ trades, total, allSectors }: { trades: InvestmentEntry[]; total: number; allSectors: string[] }) {
  const sorted = [...trades].sort((a, b) => b.amount - a.amount);
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Trades This Month <span className="text-muted-foreground/50 font-normal normal-case">({trades.length})</span>
      </p>
      <div className="divide-y divide-border/40">
        {sorted.map((t, i) => (
          <div key={t.id ?? i} className="flex items-center gap-3 py-2.5">
            <div className="w-1 h-9 rounded-full shrink-0" style={{ backgroundColor: sectorColor(t.sector, allSectors) }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.stockName}</p>
              <p className="text-[10px] text-muted-foreground">
                {t.sector} · {t.date} · {t.quantity} qty
                {t.quantity > 0 ? ` @ ₹${Math.round(t.amount / t.quantity).toLocaleString("en-IN")}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-semibold">{fmt(t.amount)}</p>
              <p className="text-[10px] text-muted-foreground">{((t.amount / total) * 100).toFixed(1)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MonthlyContributions({ entries }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const allSectors = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => s.add(e.sector));
    return Array.from(s).sort();
  }, [entries]);

  const monthList = useMemo(() => buildMonthList(entries), [entries]);

  useEffect(() => {
    if (!selected && monthList.length > 0) setSelected(monthList[0].key);
  }, [monthList]);

  const detail = monthList.find(m => m.key === selected) ?? null;

  if (monthList.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 text-center py-20 text-muted-foreground">
        <CalendarDays className="h-10 w-10 opacity-20 mx-auto mb-3" />
        <p className="text-sm">No investment data yet. Add stocks in Buy to see monthly contributions.</p>
      </div>
    );
  }

  const totalInvested = monthList[0]?.cumulative ?? 0;
  const maxMonthTotal = Math.max(...monthList.map(m => m.total));
  const totalTrades = entries.length;

  return (
    <div className="space-y-5">

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Invested",  value: fmt(totalInvested) },
          { label: "Months Active",   value: `${monthList.length}` },
          { label: "Avg / Month",     value: fmt(totalInvested / monthList.length) },
          { label: "Total Trades",    value: `${totalTrades}` },
        ].map(c => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
            <p className="text-xl font-bold font-mono mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* Left — Timeline list */}
        <div className="w-full lg:w-68 xl:w-72 shrink-0 lg:max-h-[760px] lg:overflow-y-auto space-y-2 lg:pr-1">
          {monthList.map(m => {
            const isSelected = m.key === selected;
            const barPct = maxMonthTotal > 0 ? (m.total / maxMonthTotal) * 100 : 0;

            return (
              <button
                key={m.key}
                onClick={() => setSelected(m.key)}
                className={`w-full rounded-xl border p-4 text-left transition-all duration-150 group ${
                  isSelected
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                {/* Row 1: label + MoM */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${isSelected ? "text-primary" : ""}`}>{m.label}</span>
                  <MomBadge mom={m.mom} />
                </div>

                {/* Row 2: amount */}
                <p className="text-lg font-bold font-mono leading-tight">{fmt(m.total)}</p>

                {/* Row 3: size bar relative to biggest month */}
                <div className="h-1 bg-secondary rounded-full overflow-hidden my-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isSelected ? "bg-primary" : "bg-primary/35"}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                {/* Row 4: stacked sector strip */}
                <div className="h-2 flex rounded-full overflow-hidden gap-px mb-2">
                  {m.sectors.map(s => (
                    <div
                      key={s.sector}
                      style={{ width: `${s.pct}%`, backgroundColor: sectorColor(s.sector, allSectors) }}
                      title={`${s.sector}: ${s.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>

                {/* Row 5: meta */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {m.tradeCount} trade{m.tradeCount !== 1 ? "s" : ""} · {m.stocks.length} stock{m.stocks.length !== 1 ? "s" : ""}
                  </span>
                  <ChevronRight className={`h-3 w-3 transition-opacity ${isSelected ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-40"}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right — Detail panel */}
        {detail ? (
          <div className="flex-1 min-w-0 space-y-4">

            {/* Detail header */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{detail.label}</p>
                  </div>
                  <p className="text-4xl font-bold font-mono">{fmt(detail.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 space-x-2">
                    <span>Cumulative: <strong className="text-foreground">{fmt(detail.cumulative)}</strong></span>
                    <span>·</span>
                    <span>{detail.tradeCount} trades</span>
                    <span>·</span>
                    <span>{detail.sectors.length} sectors</span>
                    <span>·</span>
                    <span>{detail.stocks.length} stocks</span>
                  </p>
                </div>

                {detail.mom !== null && (
                  <div className={`rounded-lg px-4 py-3 text-right shrink-0 border ${
                    detail.mom > 0 ? "bg-emerald-500/10 border-emerald-500/20" :
                    detail.mom < 0 ? "bg-red-500/10 border-red-500/20" : "bg-secondary border-border"
                  }`}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">vs prev month</p>
                    <p className={`text-2xl font-bold font-mono ${
                      detail.mom > 0 ? "text-emerald-500" : detail.mom < 0 ? "text-red-400" : ""
                    }`}>
                      {detail.mom > 0 ? "+" : ""}{detail.mom.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {detail.mom > 0 ? `+${fmt(detail.total - detail.total / (1 + detail.mom / 100))} more` :
                       detail.mom < 0 ? `${fmt(Math.abs(detail.total - detail.total / (1 + detail.mom / 100)))} less` : "same"}
                    </p>
                  </div>
                )}
              </div>

              {/* Full-width stacked sector bar */}
              <div className="mt-4">
                <div className="h-3 flex rounded-full overflow-hidden gap-0.5">
                  {detail.sectors.map(s => (
                    <div
                      key={s.sector}
                      style={{ width: `${s.pct}%`, backgroundColor: sectorColor(s.sector, allSectors) }}
                      title={`${s.sector}: ${s.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {detail.sectors.map(s => (
                    <div key={s.sector} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectorColor(s.sector, allSectors) }} />
                      <span className="text-[10px] text-muted-foreground">{s.sector}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut + Stock bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SectorDonut sectors={detail.sectors} allSectors={allSectors} />
              <StockBars stocks={detail.stocks} allSectors={allSectors} />
            </div>

            {/* Trade list */}
            <TradeList trades={detail.trades} total={detail.total} allSectors={allSectors} />
          </div>
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-border bg-card/30 flex items-center justify-center py-20 text-muted-foreground text-sm">
            Select a month to see the breakdown
          </div>
        )}
      </div>
    </div>
  );
}
