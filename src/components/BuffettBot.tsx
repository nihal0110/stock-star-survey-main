import { useState, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  Tooltip, BarChart, Bar, XAxis, YAxis, Cell,
} from "recharts";
import {
  ChevronDown, ChevronUp, Brain, Play, RefreshCw, AlertTriangle,
  Search, SortAsc, SortDesc, Filter, TrendingUp, Shield, Zap,
} from "lucide-react";
import { InvestmentEntry } from "@/types/investment";
import { stockCodes } from "@/constants/stockCodes";
import {
  analyzeStock, BuffettAnalysis, StockFundamentals,
  gradeColor, gradeBg, scoreColor, scoreBg, scoreIcon,
  archetypeColor, archetypeBg, Grade,
} from "@/lib/buffett";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CHART_TOOLTIP_STYLE } from "@/lib/expense-utils";

interface Props { entries: InvestmentEntry[] }
type FetchStatus = "idle" | "fetching" | "done" | "error";

interface StockStatus {
  symbol: string;
  status: FetchStatus;
  analysis: BuffettAnalysis | null;
  error: string | null;
  isCustom?: boolean;
}

type SortKey = "score-desc" | "score-asc" | "name" | "grade";

const VERDICT_COLOR: Record<string, string> = {
  "Strong Buy": "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  "Hold":       "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "Review":     "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  "Reduce":     "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "Avoid":      "bg-red-500/15 text-red-500 border-red-500/30",
};

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, className = "" }: { score: number; className?: string }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-blue-500" : score >= 35 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono w-7 text-right shrink-0 text-muted-foreground">{score}</span>
    </div>
  );
}

// ── Single criterion row ──────────────────────────────────────────────────────
function CriterionRow({ c }: { c: ReturnType<typeof analyzeStock>["criteria"][0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border px-3 py-2 ${scoreBg(c.score)} border-transparent`}>
      <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpen(o => !o)}>
        <span className={`text-sm font-bold w-5 shrink-0 ${scoreColor(c.score)}`}>{scoreIcon(c.score)}</span>
        <span className="flex-1 text-sm font-medium">{c.name}</span>
        <span className="text-xs font-mono text-muted-foreground shrink-0">{c.value}</span>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="mt-2 pl-7 space-y-1">
          <p className="text-xs text-muted-foreground leading-relaxed">{c.insight}</p>
          <p className="text-[11px] text-muted-foreground/60 italic">Benchmark: {c.benchmark} · Weight: {"★".repeat(c.weight)}</p>
          <p className="text-[11px] text-muted-foreground/60">"{c.buffettPrinciple}"</p>
        </div>
      )}
    </div>
  );
}

// ── Per-stock analysis card ───────────────────────────────────────────────────
function AnalysisCard({ ss, onRemove }: { ss: StockStatus; onRemove?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const a = ss.analysis;

  if (ss.status === "fetching") {
    return (
      <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
        <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{ss.symbol}</p>
          <p className="text-xs text-muted-foreground">Fetching fundamentals…</p>
        </div>
        <div className="h-1.5 w-32 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary/50 rounded-full animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (ss.status === "error" || !a) {
    return (
      <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{ss.symbol}</p>
          <p className="text-xs text-muted-foreground">{ss.error ?? "Could not fetch data"}</p>
        </div>
        {onRemove && <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>}
      </div>
    );
  }

  const passCnt = a.criteria.filter(c => c.score === "pass").length;
  const margCnt = a.criteria.filter(c => c.score === "marginal").length;
  const failCnt = a.criteria.filter(c => c.score === "fail").length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden transition-all">
      {/* ── Collapsed header ── */}
      <button
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(o => !o)}
      >
        {/* Grade */}
        <span className={`text-base font-bold px-2.5 py-0.5 rounded-lg border shrink-0 ${gradeBg(a.grade)} ${gradeColor(a.grade)}`}>
          {a.grade}
        </span>

        {/* Name + archetype */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{a.symbol}</span>
            {a.name && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{a.name}</span>}
            {ss.isCustom && <span className="text-[10px] bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/25">custom</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {a.sector && <span className="text-[11px] text-muted-foreground">{a.sector}</span>}
            <span className={`text-[10px] font-semibold ${archetypeColor(a.archetype)}`}>{a.archetype}</span>
            {a.buffettWouldConsider && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">★ Buffett Pick</span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="shrink-0 w-32 hidden sm:block">
          <ScoreBar score={a.overallScore} />
        </div>

        {/* Verdict */}
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:block border ${VERDICT_COLOR[a.verdict] ?? ""}`}>
          {a.verdict}
        </span>

        {/* Pass/Fail mini */}
        <div className="shrink-0 hidden lg:flex items-center gap-1 text-[10px] font-mono">
          <span className="text-emerald-500">{passCnt}✓</span>
          <span className="text-yellow-500">{margCnt}~</span>
          <span className="text-red-500">{failCnt}✗</span>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Mobile score */}
      <div className="px-4 pb-2 sm:hidden">
        <ScoreBar score={a.overallScore} />
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-5 space-y-4 border-t border-border/50">
          {/* Quick counters */}
          <div className="grid grid-cols-3 gap-2 pt-4">
            <div className="rounded-lg bg-emerald-500/10 text-center py-2.5">
              <p className="text-xl font-bold text-emerald-500">{passCnt}</p>
              <p className="text-[11px] text-muted-foreground">Pass</p>
            </div>
            <div className="rounded-lg bg-yellow-500/10 text-center py-2.5">
              <p className="text-xl font-bold text-yellow-500">{margCnt}</p>
              <p className="text-[11px] text-muted-foreground">Marginal</p>
            </div>
            <div className="rounded-lg bg-red-500/10 text-center py-2.5">
              <p className="text-xl font-bold text-red-500">{failCnt}</p>
              <p className="text-[11px] text-muted-foreground">Fail</p>
            </div>
          </div>

          {/* Archetype */}
          <div className={`rounded-lg border px-3 py-2.5 ${archetypeBg(a.archetype)}`}>
            <div className="flex items-center gap-2 mb-1">
              <p className={`text-xs font-bold uppercase tracking-wide ${archetypeColor(a.archetype)}`}>{a.archetype}</p>
              {a.buffettWouldConsider && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Buffett Would Consider</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{a.archetypeReason}</p>
          </div>

          {/* Buffett's voice */}
          <div className="rounded-lg bg-secondary/50 px-4 py-3 border-l-2 border-primary/40">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">What Buffett might say</p>
            <p className="text-xs text-muted-foreground italic leading-relaxed">{a.buffettNote}</p>
          </div>

          {/* Strength / Concern */}
          {(a.topStrength || a.topConcern) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {a.topStrength && (
                <div className="rounded-lg bg-emerald-500/10 px-3 py-2.5 flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide mb-0.5">Top Strength</p>
                    <p className="text-xs text-emerald-400">{a.topStrength}</p>
                  </div>
                </div>
              )}
              {a.topConcern && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2.5 flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-0.5">Key Risk</p>
                    <p className="text-xs text-red-400">{a.topConcern}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Criteria breakdown */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Criteria Breakdown</p>
            {a.criteria.map(c => <CriterionRow key={c.id} c={c} />)}
          </div>

          {a.dataQuality !== "rich" && (
            <p className="text-[11px] text-muted-foreground italic">
              Data quality: <strong>{a.dataQuality}</strong> — some metrics unavailable and excluded from scoring.
            </p>
          )}

          {onRemove && ss.isCustom && (
            <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-red-500 transition-colors">Remove custom ticker</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Grade badge ───────────────────────────────────────────────────────────────
function GradeBadge({ g, count }: { g: Grade; count: number }) {
  if (!count) return null;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${gradeBg(g)}`}>
      <span className={`text-sm font-bold ${gradeColor(g)}`}>{g}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BuffettBot({ entries }: Props) {
  const holdSymbols = useMemo(() => {
    const seen = new Set<string>();
    return entries
      .filter(e => e.status !== "sold" && e.quantity > 0)
      .map(e => e.stockName.trim().toUpperCase())
      .filter(s => { if (seen.has(s)) return false; seen.add(s); return true; });
  }, [entries]);

  const [statuses, setStatuses] = useState<StockStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score-desc");
  const [gradeFilter, setGradeFilter] = useState<Grade | "all">("all");
  const [customTicker, setCustomTicker] = useState("");
  const [customFetching, setCustomFetching] = useState(false);

  // Fetch fundamentals for a symbol
  async function fetchSymbol(sym: string): Promise<{ data?: StockFundamentals; error?: string }> {
    const apiCode = stockCodes[sym.toUpperCase()] ?? sym;
    try {
      const res = await fetch(`http://localhost:3001/stock-info/${encodeURIComponent(apiCode)}`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        return { error: error ?? `HTTP ${res.status}` };
      }
      const data: StockFundamentals = await res.json();
      return { data };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Network error" };
    }
  }

  // Evaluate all portfolio holdings
  async function evaluate() {
    if (running) return;
    setRunning(true);
    // Keep custom tickers, reset portfolio ones
    const existing = statuses.filter(s => s.isCustom);
    const initial: StockStatus[] = [
      ...holdSymbols.map(sym => ({ symbol: sym, status: "fetching" as FetchStatus, analysis: null, error: null })),
      ...existing,
    ];
    setStatuses(initial);

    for (const sym of holdSymbols) {
      const { data, error } = await fetchSymbol(sym);
      if (data) {
        const analysis = analyzeStock({ ...data, symbol: sym });
        setStatuses(prev => prev.map(s => s.symbol === sym && !s.isCustom ? { ...s, status: "done", analysis } : s));
      } else {
        setStatuses(prev => prev.map(s => s.symbol === sym && !s.isCustom ? { ...s, status: "error", error: error ?? "Unknown error" } : s));
      }
    }
    setRunning(false);
  }

  // Analyze a custom ticker
  async function analyzeCustom() {
    const sym = customTicker.trim().toUpperCase();
    if (!sym || customFetching) return;
    if (statuses.some(s => s.symbol === sym && s.isCustom)) return;
    setCustomFetching(true);
    setStatuses(prev => [...prev, { symbol: sym, status: "fetching", analysis: null, error: null, isCustom: true }]);
    const { data, error } = await fetchSymbol(sym);
    if (data) {
      const analysis = analyzeStock({ ...data, symbol: sym });
      setStatuses(prev => prev.map(s => s.symbol === sym && s.isCustom ? { ...s, status: "done", analysis } : s));
    } else {
      setStatuses(prev => prev.map(s => s.symbol === sym && s.isCustom ? { ...s, status: "error", error: error ?? "Unknown error" } : s));
    }
    setCustomTicker("");
    setCustomFetching(false);
  }

  const removeCustom = (sym: string) => setStatuses(prev => prev.filter(s => !(s.symbol === sym && s.isCustom)));

  // Computed stats
  const done = statuses.filter(s => s.status === "done" && s.analysis);
  const avgScore = done.length ? Math.round(done.reduce((sum, s) => sum + (s.analysis?.overallScore ?? 0), 0) / done.length) : null;

  const gradeCounts = useMemo(() => {
    const counts: Record<Grade, number> = { "A+": 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const s of done) if (s.analysis) counts[s.analysis.grade]++;
    return counts;
  }, [done]);

  // Radar data — average score per criterion
  const radarData = useMemo(() => {
    const doneWithAnalysis = done.filter(s => s.analysis);
    if (doneWithAnalysis.length === 0) return [];
    const criteriaNames = doneWithAnalysis[0]?.analysis?.criteria.map(c => c.name) ?? [];
    return criteriaNames.map(name => {
      const vals = doneWithAnalysis.map(s => {
        const c = s.analysis!.criteria.find(cr => cr.name === name);
        if (!c || c.score === "na") return null;
        return c.score === "pass" ? 100 : c.score === "marginal" ? 50 : 0;
      }).filter(v => v !== null) as number[];
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      const shortName = name.split(" ").slice(0, 2).join(" ");
      return { criterion: shortName, score: avg, fullName: name };
    });
  }, [done]);

  // Archetype bar data
  const archetypeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of done) if (s.analysis) map.set(s.analysis.archetype, (map.get(s.analysis.archetype) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([name, count]) => ({ name: name.split(" ").slice(0, 2).join(" "), count, fullName: name }))
      .sort((a, b) => b.count - a.count);
  }, [done]);

  // Sort + filter
  const filtered = useMemo(() => {
    let list = [...statuses];
    if (gradeFilter !== "all")
      list = list.filter(s => s.analysis?.grade === gradeFilter || s.status !== "done");
    list.sort((a, b) => {
      if (sortKey === "score-desc") return (b.analysis?.overallScore ?? 0) - (a.analysis?.overallScore ?? 0);
      if (sortKey === "score-asc")  return (a.analysis?.overallScore ?? 0) - (b.analysis?.overallScore ?? 0);
      if (sortKey === "grade") {
        const order: Grade[] = ["A+","A","B","C","D","F"];
        return order.indexOf(a.analysis?.grade ?? "F") - order.indexOf(b.analysis?.grade ?? "F");
      }
      return a.symbol.localeCompare(b.symbol);
    });
    return list;
  }, [statuses, sortKey, gradeFilter]);

  const hasResults = statuses.length > 0;

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3 shrink-0">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base">Warren Buffett Evaluator</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Scores each holding against Buffett's investment principles — ROE, moat, debt discipline, valuation, and growth.
              Principles sourced from Berkshire Hathaway shareholder letters (1977–2023).
            </p>

            {holdSymbols.length === 0 ? (
              <p className="text-sm text-yellow-500 mt-3">No holdings found. Add stocks in the Buy section first.</p>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={evaluate} disabled={running} className="gap-2">
                  {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {running ? "Evaluating…" : hasResults ? "Re-evaluate Portfolio" : "Evaluate Portfolio"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {holdSymbols.length} holding{holdSymbols.length !== 1 ? "s" : ""}: {holdSymbols.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Portfolio summary ─────────────────────────────────────────────── */}
      {done.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Avg score + grade distribution */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Portfolio Score</p>
            <div className="flex items-end gap-3">
              <p className={`text-5xl font-bold font-mono ${
                (avgScore ?? 0) >= 70 ? "text-emerald-500" :
                (avgScore ?? 0) >= 50 ? "text-blue-500" :
                (avgScore ?? 0) >= 35 ? "text-yellow-500" : "text-red-500"
              }`}>{avgScore}</p>
              <div className="pb-1">
                <p className="text-xs text-muted-foreground">/ 100</p>
                <p className="text-xs text-muted-foreground">{done.length} evaluated</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["A+","A","B","C","D","F"] as Grade[]).map(g => <GradeBadge key={g} g={g} count={gradeCounts[g]} />)}
            </div>
            {/* Verdict breakdown */}
            <div className="space-y-1.5 pt-1">
              {["Strong Buy","Hold","Review","Reduce","Avoid"].map(v => {
                const cnt = done.filter(s => s.analysis?.verdict === v).length;
                if (!cnt) return null;
                return (
                  <div key={v} className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${VERDICT_COLOR[v]}`}>{v}</span>
                    <span className="font-mono text-muted-foreground">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radar chart — criteria coverage */}
          {radarData.length > 0 && (
            <div className="lg:col-span-2 rounded-xl border bg-card p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Portfolio Avg by Criterion</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                  <Tooltip
                    formatter={(v: number, _: string, props: { payload?: { fullName?: string } }) => [v + "/100", props.payload?.fullName ?? ""]}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Archetype distribution */}
      {archetypeData.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Archetype Distribution</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={archetypeData} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, done.length]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [v, "stocks"]} contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {archetypeData.map((d, i) => (
                  <Cell key={i} fill={
                    d.fullName === "Wide Moat Compounder" ? "#10b981" :
                    d.fullName === "Deep Value Play"      ? "#3b82f6" :
                    d.fullName === "Dividend Compounder"  ? "#14b8a6" :
                    d.fullName === "Growth at Fair Price" ? "#8b5cf6" :
                    d.fullName === "Leveraged ROE Trap"   ? "#f97316" :
                    d.fullName === "Capital Destroyer"    ? "#ef4444" : "#6b7280"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      {hasResults && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5">
            {sortKey.includes("desc") ? <SortDesc className="h-3.5 w-3.5" /> : <SortAsc className="h-3.5 w-3.5" />}
            <span>Sort:</span>
            {(["score-desc","score-asc","grade","name"] as SortKey[]).map(k => (
              <button key={k} onClick={() => setSortKey(k)}
                className={`ml-1 px-1.5 py-0.5 rounded transition-colors ${sortKey === k ? "bg-primary text-white" : "hover:bg-secondary"}`}>
                {k === "score-desc" ? "Score ↓" : k === "score-asc" ? "Score ↑" : k === "grade" ? "Grade" : "Name"}
              </button>
            ))}
          </div>

          {/* Grade filter */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5">
            <Filter className="h-3.5 w-3.5" />
            <span>Grade:</span>
            {(["all","A+","A","B","C","D","F"] as const).map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`ml-1 px-1.5 py-0.5 rounded font-semibold transition-colors ${gradeFilter === g ? "bg-primary text-white" : `hover:bg-secondary ${g !== "all" ? gradeColor(g as Grade) : ""}`}`}>
                {g}
              </button>
            ))}
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} stock{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Stock cards ───────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(ss => (
            <AnalysisCard
              key={`${ss.symbol}-${ss.isCustom ? "custom" : "portfolio"}`}
              ss={ss}
              onRemove={ss.isCustom ? () => removeCustom(ss.symbol) : undefined}
            />
          ))}
        </div>
      )}

      {!hasResults && holdSymbols.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 text-center py-14 text-muted-foreground">
          <Brain className="h-10 w-10 opacity-20 mx-auto mb-3" />
          <p className="text-sm">Hit <strong>Evaluate Portfolio</strong> to run the Buffett analysis on your holdings.</p>
        </div>
      )}

      {/* ── Analyze any ticker ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Analyze Any Stock</p>
          <span className="text-xs text-muted-foreground">— not just your holdings</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={customTicker}
              onChange={e => setCustomTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && analyzeCustom()}
              placeholder="e.g. RELIANCE, TCS, HDFCBANK"
              className="pl-8 font-mono bg-secondary border-border"
              disabled={customFetching}
            />
          </div>
          <Button onClick={analyzeCustom} disabled={!customTicker.trim() || customFetching} className="gap-1.5">
            {customFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {customFetching ? "Fetching…" : "Analyze"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Enter the NSE/BSE ticker symbol. Results appear above.</p>
      </div>
    </div>
  );
}
