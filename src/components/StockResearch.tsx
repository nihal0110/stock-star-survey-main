import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { StockInfo, WatchlistEntry } from "@/types/investment";
import {
  analyzeStock, BuffettAnalysis, StockFundamentals,
  gradeColor, gradeBg, scoreColor, scoreIcon, archetypeColor, archetypeBg,
} from "@/lib/buffett";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt, fmtCrore, pct } from "@/lib/format";
import {
  Search, Bookmark, BookmarkCheck, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, ExternalLink, Trash2, Brain,
  Tag, FolderOpen, RefreshCw,
} from "lucide-react";

interface SearchSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
}

const API = "http://localhost:3001";

interface Props {
  watchlist: WatchlistEntry[];
  onAddToWatchlist: (symbol: string, note: string, sector?: string) => void;
  onRemoveFromWatchlist: (symbol: string) => void;
}

// ─── Predefined Indian market sectors ────────────────────────────────────────
const SECTORS = [
  "Banking & Finance",
  "Information Technology",
  "FMCG",
  "Energy & Oil",
  "Pharmaceuticals",
  "Automobiles & EV",
  "Auto Components & Equipment",
  "Electronics Manufacturing",
  "Industrial & Mechanical Parts",
  "Infrastructure",
  "Metals & Mining",
  "Chemicals",
  "Telecom",
  "Real Estate",
  "Consumer Durables",
  "Media & Entertainment",
  "Agriculture",
  "Other",
];

type WLScore = BuffettAnalysis | "loading" | "error";
type Verdict = "Strong Buy" | "Hold" | "Review" | "Reduce" | "Avoid";
const VERDICT_ORDER: Verdict[] = ["Strong Buy", "Hold", "Review", "Reduce", "Avoid"];
const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong Buy": "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  "Hold":       "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "Review":     "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  "Reduce":     "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "Avoid":      "bg-red-500/15 text-red-500 border-red-500/30",
};

function MiniScore({ sc }: { sc: WLScore }) {
  if (sc === "loading") return <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (sc === "error")   return <span className="text-[10px] text-muted-foreground">—</span>;
  const verdict = sc.verdict as Verdict;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${gradeBg(sc.grade)} ${gradeColor(sc.grade)}`}>
        {sc.grade}
      </span>
      <div className="flex items-center gap-0.5">
        <div className="w-8 h-1 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${sc.overallScore >= 70 ? "bg-emerald-500" : sc.overallScore >= 50 ? "bg-blue-500" : sc.overallScore >= 35 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${sc.overallScore}%` }} />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{sc.overallScore}</span>
      </div>
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap hidden sm:inline ${VERDICT_STYLE[verdict] ?? ""}`}>
        {verdict}
      </span>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Metric({ label, value, sub, colorClass }: { label: string; value: string; sub?: string; colorClass?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-mono font-bold ${colorClass ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Compact Buffett score card shown inline in Research ──────────────────────
function BuffettCard({ a }: { a: BuffettAnalysis }) {
  const [open, setOpen] = useState(false);
  const passCnt = a.criteria.filter(c => c.score === "pass").length;
  const margCnt = a.criteria.filter(c => c.score === "marginal").length;
  const failCnt = a.criteria.filter(c => c.score === "fail").length;
  const naCnt   = a.criteria.filter(c => c.score === "na").length;

  return (
    <div className={`rounded-xl border overflow-hidden ${gradeBg(a.grade)}`}>
      {/* Collapsed header — always visible */}
      <button className="w-full px-5 py-4 flex items-center gap-4 text-left" onClick={() => setOpen(o => !o)}>
        <div className="shrink-0">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">Buffett Analysis</span>
            <span className={`text-base font-bold px-2 py-0.5 rounded-lg border ${gradeBg(a.grade)} ${gradeColor(a.grade)}`}>
              {a.grade}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${archetypeBg(a.archetype)}`}>
              <span className={archetypeColor(a.archetype)}>{a.archetype}</span>
            </span>
            {a.buffettWouldConsider && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">★ Buffett Pick</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {/* Score bar */}
            <div className="flex-1 max-w-[140px] h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${a.overallScore >= 70 ? "bg-emerald-500" : a.overallScore >= 50 ? "bg-blue-500" : a.overallScore >= 35 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${a.overallScore}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{a.overallScore}/100</span>
            <span className="text-[10px] font-mono text-emerald-500">{passCnt}✓</span>
            <span className="text-[10px] font-mono text-yellow-500">{margCnt}~</span>
            <span className="text-[10px] font-mono text-red-500">{failCnt}✗</span>
            {naCnt > 0 && <span className="text-[10px] font-mono text-muted-foreground">{naCnt} N/A</span>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <span className={`text-sm font-bold hidden sm:block ${
            a.verdict === "Strong Buy" ? "text-emerald-500" :
            a.verdict === "Hold" ? "text-blue-500" :
            a.verdict === "Review" ? "text-yellow-500" : "text-red-500"
          }`}>{a.verdict}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/50">
          {/* Archetype */}
          <div className={`rounded-lg border px-3 py-2.5 mt-4 ${archetypeBg(a.archetype)}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${archetypeColor(a.archetype)}`}>{a.archetype}</p>
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
                <div className="rounded-lg bg-emerald-500/10 px-3 py-2 flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide mb-0.5">Top Strength</p>
                    <p className="text-xs text-emerald-400">{a.topStrength}</p>
                  </div>
                </div>
              )}
              {a.topConcern && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 flex items-start gap-2">
                  <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
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
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Criteria</p>
            {a.criteria.map(c => (
              <div key={c.id} className={`rounded-lg px-3 py-2 flex items-center gap-2 ${
                c.score === "pass" ? "bg-emerald-500/8" : c.score === "marginal" ? "bg-yellow-500/8" : c.score === "fail" ? "bg-red-500/8" : "bg-secondary/30"
              }`}>
                <span className={`text-sm font-bold w-5 shrink-0 ${scoreColor(c.score)}`}>{scoreIcon(c.score)}</span>
                <span className="flex-1 text-xs font-medium">{c.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{c.value}</span>
              </div>
            ))}
          </div>

          {a.dataQuality !== "rich" && (
            <p className="text-[11px] text-muted-foreground italic">
              Data quality: <strong>{a.dataQuality}</strong> — some metrics unavailable from Yahoo Finance for this stock.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sector-grouped watchlist ─────────────────────────────────────────────────
function WatchlistSection({
  watchlist, scores, onSearch, onRemove, onEditNote, onEditSector, onRefresh, refreshing,
}: {
  watchlist: WatchlistEntry[];
  scores: Record<string, WLScore>;
  onSearch: (sym: string) => void;
  onRemove: (sym: string) => void;
  onEditNote: (sym: string, note: string) => void;
  onEditSector: (sym: string, sector: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [sectorFilter, setSectorFilter] = useState<string>("All");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "All">("All");
  const [editingNote, setEditingNote] = useState<Record<string, string>>({});
  const [openSectors, setOpenSectors] = useState<Set<string>>(new Set());

  // Open all sectors by default when data loads
  useEffect(() => {
    const keys = new Set(watchlist.map(w => w.sector?.trim() || "Uncategorised"));
    setOpenSectors(keys);
  }, [watchlist.length]);

  // Verdicts that exist in loaded scores
  const availableVerdicts = useMemo(() => {
    const set = new Set<Verdict>();
    for (const w of watchlist) {
      const sc = scores[w.symbol];
      if (sc && sc !== "loading" && sc !== "error") set.add(sc.verdict as Verdict);
    }
    return VERDICT_ORDER.filter(v => set.has(v));
  }, [scores, watchlist]);

  // Apply both filters to watchlist before grouping
  const filteredWatchlist = useMemo(() => {
    return watchlist.filter(w => {
      if (verdictFilter !== "All") {
        const sc = scores[w.symbol];
        if (!sc || sc === "loading" || sc === "error") return false;
        if (sc.verdict !== verdictFilter) return false;
      }
      return true;
    });
  }, [watchlist, scores, verdictFilter]);

  // Group filtered list by sector
  const grouped = useMemo(() => {
    const map = new Map<string, WatchlistEntry[]>();
    for (const w of filteredWatchlist) {
      const key = w.sector?.trim() || "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return map;
  }, [filteredWatchlist]);

  const allSectorKeys = useMemo(() => ["All", ...Array.from(
    new Set(watchlist.map(w => w.sector?.trim() || "Uncategorised"))
  ).sort()], [watchlist]);

  const visibleGroups = useMemo(() => {
    if (sectorFilter === "All") return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    const entries = grouped.get(sectorFilter);
    return entries ? [[sectorFilter, entries] as [string, WatchlistEntry[]]] : [];
  }, [grouped, sectorFilter]);

  const toggleSector = (s: string) =>
    setOpenSectors(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Watchlist · {watchlist.length} saved
        </h3>
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Scoring…" : "Refresh scores"}
        </button>
      </div>

      {/* Verdict filter (Buffett) */}
      {availableVerdicts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground mr-0.5">Verdict:</span>
          {(["All", ...availableVerdicts] as (Verdict | "All")[]).map(v => (
            <button key={v} onClick={() => setVerdictFilter(v)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                verdictFilter === v
                  ? v === "All" ? "bg-primary text-primary-foreground border-primary" : VERDICT_STYLE[v as Verdict]
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}>
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Sector filter */}
      <div className="flex flex-wrap gap-1.5">
        {allSectorKeys.map(s => (
          <button key={s} onClick={() => setSectorFilter(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              sectorFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Grouped rows */}
      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No stocks match the selected filters.</p>
      ) : visibleGroups.map(([sector, stocks]) => {
        const isOpen = openSectors.has(sector);
        return (
          <div key={sector} className="rounded-xl border border-border overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
              onClick={() => toggleSector(sector)}
            >
              <FolderOpen className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold flex-1">{sector}</span>
              <span className="text-xs text-muted-foreground">{stocks.length} stock{stocks.length !== 1 ? "s" : ""}</span>
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="divide-y divide-border/50">
                {stocks.map(w => {
                  const sc = scores[w.symbol];
                  return (
                    <div key={w.symbol} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                      {/* Symbol */}
                      <button onClick={() => onSearch(w.symbol)}
                        className="font-mono font-semibold text-primary hover:underline text-sm w-20 shrink-0 text-left">
                        {w.symbol}
                      </button>

                      {/* Buffett mini score */}
                      <div className="w-44 shrink-0">
                        {sc ? <MiniScore sc={sc} /> : <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>

                      {/* Note */}
                      <div className="flex-1 min-w-0">
                        {editingNote[w.symbol] !== undefined ? (
                          <Input value={editingNote[w.symbol]} autoFocus
                            className="h-7 text-xs bg-secondary border-border"
                            onChange={e => setEditingNote(p => ({ ...p, [w.symbol]: e.target.value }))}
                            onBlur={e => {
                              onEditNote(w.symbol, e.target.value);
                              setEditingNote(p => { const n = { ...p }; delete n[w.symbol]; return n; });
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingNote(p => { const n = { ...p }; delete n[w.symbol]; return n; });
                            }}
                          />
                        ) : (
                          <span onClick={() => setEditingNote(p => ({ ...p, [w.symbol]: w.note }))}
                            className="text-xs text-muted-foreground cursor-text hover:text-foreground transition-colors truncate block">
                            {w.note || <span className="italic opacity-40">click to add note</span>}
                          </span>
                        )}
                      </div>

                      {/* Sector selector */}
                      <select value={w.sector || ""} onChange={e => onEditSector(w.symbol, e.target.value)}
                        className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 text-muted-foreground shrink-0 cursor-pointer">
                        <option value="">— sector —</option>
                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:block">{w.addedAt}</span>

                      <button onClick={() => onRemove(w.symbol)}
                        className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StockResearch({ watchlist, onAddToWatchlist, onRemoveFromWatchlist }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [buffettAnalysis, setBuffettAnalysis] = useState<BuffettAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [didYouMean, setDidYouMean] = useState<SearchSuggestion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [sectorInput, setSectorInput] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Watchlist Buffett scores ─────────────────────────────────────────
  const [wlScores, setWlScores] = useState<Record<string, WLScore>>({});
  const [wlRefreshing, setWlRefreshing] = useState(false);

  const fetchWlScores = useCallback(async (list: WatchlistEntry[]) => {
    if (list.length === 0) return;
    setWlRefreshing(true);
    const init: Record<string, WLScore> = {};
    for (const w of list) init[w.symbol] = "loading";
    setWlScores(init);
    for (const w of list) {
      try {
        const res = await fetch(`${API}/stock-info/${encodeURIComponent(w.symbol)}`);
        const data = await res.json();
        if (data?.error) {
          setWlScores(prev => ({ ...prev, [w.symbol]: "error" }));
        } else {
          const f: StockFundamentals = {
            symbol: w.symbol, name: data.name, sector: data.sector, industry: data.industry,
            currentPrice: data.currentPrice, trailingPE: data.trailingPE, priceToBook: data.priceToBook,
            pegRatio: data.pegRatio, roe: data.roe, profitMargin: data.profitMargin,
            grossMargin: data.grossMargin ?? null, operatingMargin: data.operatingMargin ?? null,
            debtToEquity: data.debtToEquity, currentRatio: data.currentRatio,
            revenueGrowth: data.revenueGrowth, earningsGrowth: data.earningsGrowth ?? null,
            dividendYield: data.dividendYield, eps: data.eps, beta: data.beta,
            operatingCashflow: data.operatingCashflow ?? null, freeCashflow: data.freeCashflow ?? null,
            totalRevenue: data.totalRevenue ?? null, returnOnAssets: data.returnOnAssets ?? null,
          };
          setWlScores(prev => ({ ...prev, [w.symbol]: analyzeStock(f) }));
        }
      } catch {
        setWlScores(prev => ({ ...prev, [w.symbol]: "error" }));
      }
    }
    setWlRefreshing(false);
  }, []);

  // Auto-fetch when watchlist changes (new stock added or on first mount)
  useEffect(() => {
    if (watchlist.length > 0) fetchWlScores(watchlist);
  }, [watchlist.length]); // re-run only when count changes, not on every render

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) { setSuggestions(data); setShowSuggestions(true); }
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const search = async (symbol = query) => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setBuffettAnalysis(null);
    setExpanded(false);
    setDidYouMean([]);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const res = await fetch(`${API}/stock-info/${encodeURIComponent(sym)}`);
      const data = await res.json();
      if (data.error) {
        try {
          const sr = await fetch(`${API}/search?q=${encodeURIComponent(sym)}`);
          const matches: SearchSuggestion[] = await sr.json();
          if (Array.isArray(matches) && matches.length > 0) {
            setDidYouMean(matches.slice(0, 6));
            setError(`No exact symbol "${sym}" found. Did you mean one of these?`);
          } else {
            setError(`"${sym}" not found on NSE/BSE.`);
          }
        } catch {
          setError(`"${sym}" not found on NSE/BSE.`);
        }
      } else {
        setInfo(data);
        setNoteInput("");
        // Pre-fill sector from Yahoo Finance response if available
        setSectorInput(data.sector ?? "");

        // Run Buffett analysis with the fetched fundamentals
        const fundamentals: StockFundamentals = {
          symbol: data.symbol,
          name: data.name,
          sector: data.sector,
          industry: data.industry,
          currentPrice: data.currentPrice,
          trailingPE: data.trailingPE,
          priceToBook: data.priceToBook,
          pegRatio: data.pegRatio,
          roe: data.roe,
          profitMargin: data.profitMargin,
          grossMargin: (data as any).grossMargin ?? null,
          operatingMargin: (data as any).operatingMargin ?? null,
          debtToEquity: data.debtToEquity,
          currentRatio: data.currentRatio,
          revenueGrowth: data.revenueGrowth,
          earningsGrowth: (data as any).earningsGrowth ?? null,
          dividendYield: data.dividendYield,
          eps: data.eps,
          beta: data.beta,
          operatingCashflow: (data as any).operatingCashflow ?? null,
          freeCashflow: (data as any).freeCashflow ?? null,
          totalRevenue: (data as any).totalRevenue ?? null,
          returnOnAssets: (data as any).returnOnAssets ?? null,
        };
        setBuffettAnalysis(analyzeStock(fundamentals));
      }
    } catch {
      setError("Could not reach backend. Is the server running?");
    }
    setLoading(false);
  };

  const selectSuggestion = (s: SearchSuggestion) => {
    setQuery(s.symbol);
    setSuggestions([]);
    setShowSuggestions(false);
    setDidYouMean([]);
    setError(null);
    search(s.symbol);
  };

  const isBookmarked = info ? watchlist.some(w => w.symbol === info.symbol) : false;

  const handleBookmark = () => {
    if (!info) return;
    if (isBookmarked) {
      onRemoveFromWatchlist(info.symbol);
    } else {
      onAddToWatchlist(info.symbol, noteInput, sectorInput || undefined);
    }
  };

  const handleEditNote = (symbol: string, note: string) => onAddToWatchlist(symbol, note);
  const handleEditSector = (symbol: string, sector: string) => {
    const w = watchlist.find(x => x.symbol === symbol);
    onAddToWatchlist(symbol, w?.note ?? "", sector);
  };

  const priceColor = (info?.change ?? 0) >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-8">

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-md" ref={searchRef}>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
            onKeyDown={e => {
              if (e.key === "Enter") search();
              if (e.key === "Escape") setShowSuggestions(false);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Type company name or symbol — e.g. Hero Motor, HDFC"
            className="bg-secondary border-border"
          />
          <Button onClick={() => search()} disabled={loading} className="gap-2 shrink-0">
            <Search className="h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {suggestions.map(s => (
              <button key={s.symbol} onMouseDown={() => selectSuggestion(s)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary transition-colors text-left">
                <div>
                  <span className="font-mono font-semibold text-primary text-sm">{s.symbol}</span>
                  <span className="text-muted-foreground text-sm ml-2">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {s.sector && <span className="text-[10px] text-muted-foreground hidden sm:block">{s.sector}</span>}
                  <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground">{s.exchange}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="space-y-3">
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">{error}</p>
          {didYouMean.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              {didYouMean.map(s => (
                <button key={s.symbol} onClick={() => selectSuggestion(s)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary transition-colors text-left border-t border-border first:border-t-0">
                  <div>
                    <span className="font-mono font-semibold text-primary text-sm">{s.symbol}</span>
                    <span className="text-muted-foreground text-sm ml-2">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {s.sector && <span className="text-[10px] text-muted-foreground hidden sm:block">{s.sector}</span>}
                    <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground">{s.exchange}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stock info ───────────────────────────────────────────────────── */}
      {info && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-mono font-bold text-primary">{info.symbol}</h2>
                {info.sector && (
                  <span className="text-xs border border-border rounded px-2 py-0.5 text-muted-foreground">{info.sector}</span>
                )}
              </div>
              {info.name && <p className="text-sm text-muted-foreground mt-0.5">{info.name}</p>}
              {info.industry && <p className="text-xs text-muted-foreground">{info.industry}</p>}
            </div>
            <div className="text-right">
              <p className={`text-3xl font-mono font-bold ${priceColor}`}>
                ₹{info.currentPrice !== null ? fmt(info.currentPrice) : "—"}
              </p>
              {info.change !== null && info.changePercent !== null && (
                <p className={`text-sm font-mono flex items-center justify-end gap-1 ${priceColor}`}>
                  {(info.change ?? 0) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {info.change >= 0 ? "+" : ""}₹{fmt(info.change)} ({pct(info.changePercent * 100)})
                </p>
              )}
            </div>
          </div>

          {/* Quick metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Metric label="Market Cap" value={fmtCrore(info.marketCap)} />
            <Metric
              label="P/E (TTM)"
              value={info.trailingPE !== null ? info.trailingPE.toFixed(1) + "x" : "—"}
              sub={info.forwardPE !== null ? `Fwd: ${info.forwardPE.toFixed(1)}x` : undefined}
              colorClass={info.trailingPE !== null ? (info.trailingPE < 15 ? "text-green-500" : info.trailingPE > 40 ? "text-red-400" : "text-foreground") : undefined}
            />
            <Metric label="EPS" value={info.eps !== null ? `₹${fmt(info.eps)}` : "—"} />
            <Metric
              label="Book Value"
              value={info.bookValue !== null ? `₹${fmt(info.bookValue)}` : "—"}
              sub={info.priceToBook !== null ? `P/B: ${info.priceToBook.toFixed(2)}x` : undefined}
            />
            <Metric
              label="Div Yield"
              value={info.dividendYield !== null ? pct(info.dividendYield * 100, false) : "—"}
              sub={info.dividendRate !== null ? `₹${fmt(info.dividendRate)}/yr` : undefined}
              colorClass={info.dividendYield !== null && info.dividendYield > 0 ? "text-green-500" : undefined}
            />
            <Metric
              label="Beta"
              value={info.beta !== null ? info.beta.toFixed(2) : "—"}
              sub={info.beta !== null ? (info.beta < 1 ? "Low volatility" : "High volatility") : undefined}
            />
          </div>

          {/* 52-week bar */}
          {info.high52 !== null && info.low52 !== null && info.currentPrice !== null && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">52-Week Range</p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-red-400 w-20 text-right">₹{fmt(info.low52)}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, ((info.currentPrice - info.low52) / (info.high52 - info.low52)) * 100))}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-green-400 w-20">₹{fmt(info.high52)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1 font-mono">
                Current ₹{fmt(info.currentPrice)} · {(((info.currentPrice - info.low52) / (info.high52 - info.low52)) * 100).toFixed(0)}% of range
              </p>
            </div>
          )}

          {/* ── Buffett Analysis — auto runs on every search ──────────── */}
          {buffettAnalysis && <BuffettCard a={buffettAnalysis} />}

          {/* Expandable detailed financials */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "Hide" : "Show"} detailed financials
          </button>

          {expanded && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric
                  label="ROE"
                  value={info.roe !== null ? pct(info.roe * 100, false) : "—"}
                  colorClass={info.roe !== null ? (info.roe > 0.15 ? "text-green-500" : info.roe < 0 ? "text-red-400" : "text-foreground") : undefined}
                />
                <Metric
                  label="Profit Margin"
                  value={info.profitMargin !== null ? pct(info.profitMargin * 100, false) : "—"}
                  colorClass={info.profitMargin !== null ? (info.profitMargin > 0.15 ? "text-green-500" : info.profitMargin < 0 ? "text-red-400" : "text-foreground") : undefined}
                />
                <Metric
                  label="Debt / Equity"
                  value={info.debtToEquity !== null ? info.debtToEquity.toFixed(2) : "—"}
                  colorClass={info.debtToEquity !== null ? (info.debtToEquity < 1 ? "text-green-500" : info.debtToEquity > 2 ? "text-red-400" : "text-foreground") : undefined}
                />
                <Metric
                  label="Revenue Growth"
                  value={info.revenueGrowth !== null ? pct(info.revenueGrowth * 100) : "—"}
                  colorClass={info.revenueGrowth !== null ? (info.revenueGrowth > 0 ? "text-green-500" : "text-red-400") : undefined}
                />
                <Metric label="Current Ratio" value={info.currentRatio !== null ? info.currentRatio.toFixed(2) : "—"} />
                <Metric label="PEG Ratio" value={info.pegRatio !== null ? info.pegRatio.toFixed(2) : "—"} />
                {info.employees && <Metric label="Employees" value={info.employees.toLocaleString("en-IN")} />}
                {info.website && (
                  <div className="rounded-lg border border-border bg-card p-3 flex items-center">
                    <a href={info.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline font-mono">
                      <ExternalLink className="h-3 w-3" /> Website
                    </a>
                  </div>
                )}
              </div>
              {info.description && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">About</p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{info.description}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Bookmark with sector ─────────────────────────────────── */}
          <div className={`rounded-xl border p-4 space-y-3 ${isBookmarked ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{isBookmarked ? "Saved to Watchlist" : "Save to Watchlist"}</p>
            </div>

            {!isBookmarked && (
              <div className="flex flex-wrap gap-3">
                {/* Sector picker */}
                <div className="space-y-1 min-w-[180px]">
                  <p className="text-xs text-muted-foreground">Sector</p>
                  <select
                    value={sectorInput}
                    onChange={e => setSectorInput(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">— choose sector —</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {/* Note */}
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <p className="text-xs text-muted-foreground">Note (optional)</p>
                  <Input
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="e.g. Wait for ₹X entry, check Q3 results"
                    className="bg-secondary border-border text-sm"
                  />
                </div>
              </div>
            )}

            <Button
              variant={isBookmarked ? "outline" : "default"}
              size="sm"
              className="gap-2"
              onClick={handleBookmark}
            >
              {isBookmarked ? (
                <><BookmarkCheck className="h-4 w-4 text-emerald-500" /> Remove from Watchlist</>
              ) : (
                <><Bookmark className="h-4 w-4" /> Save to Watchlist</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Watchlist grouped by sector ──────────────────────────────────── */}
      {watchlist.length > 0 && (
        <WatchlistSection
          watchlist={watchlist}
          scores={wlScores}
          onSearch={sym => { setQuery(sym); search(sym); }}
          onRemove={onRemoveFromWatchlist}
          onEditNote={handleEditNote}
          onEditSector={handleEditSector}
          onRefresh={() => fetchWlScores(watchlist)}
          refreshing={wlRefreshing}
        />
      )}
    </div>
  );
}
