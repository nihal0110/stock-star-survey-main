import { useState, useEffect, useRef } from "react";
import { StockInfo, WatchlistEntry } from "@/types/investment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt, fmtCrore, pct } from "@/lib/format";
import {
  Search, Bookmark, BookmarkCheck, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, ExternalLink, Trash2,
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
  onAddToWatchlist: (symbol: string, note: string) => void;
  onRemoveFromWatchlist: (symbol: string) => void;
}

function Metric({ label, value, sub, colorClass }: { label: string; value: string; sub?: string; colorClass?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-mono font-bold ${colorClass ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function StockResearch({ watchlist, onAddToWatchlist, onRemoveFromWatchlist }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [didYouMean, setDidYouMean] = useState<SearchSuggestion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLDivElement>(null);

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
    setExpanded(false);
    setDidYouMean([]);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const res = await fetch(`${API}/stock-info/${encodeURIComponent(sym)}`);
      const data = await res.json();
      if (data.error) {
        // fallback: search by name and offer suggestions
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
      onAddToWatchlist(info.symbol, noteInput);
    }
  };

  const priceColor = (info?.change ?? 0) >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-8">
      {/* Search with autocomplete */}
      <div className="relative max-w-md" ref={searchRef}>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onKeyDown={(e) => {
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
            {suggestions.map((s) => (
              <button
                key={s.symbol}
                onMouseDown={() => selectSuggestion(s)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary transition-colors text-left"
              >
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
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
            {error}
          </p>
          {didYouMean.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              {didYouMean.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => selectSuggestion(s)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary transition-colors text-left border-t border-border first:border-t-0"
                >
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

      {/* Results */}
      {info && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-mono font-bold text-primary">{info.symbol}</h2>
                {info.sector && (
                  <span className="text-xs border border-border rounded px-2 py-0.5 text-muted-foreground">
                    {info.sector}
                  </span>
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
            <Metric
              label="EPS"
              value={info.eps !== null ? `₹${fmt(info.eps)}` : "—"}
            />
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
                    style={{
                      width: `${Math.min(100, Math.max(0, ((info.currentPrice - info.low52) / (info.high52 - info.low52)) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-green-400 w-20">₹{fmt(info.high52)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1 font-mono">
                Current ₹{fmt(info.currentPrice)} · {(((info.currentPrice - info.low52) / (info.high52 - info.low52)) * 100).toFixed(0)}% of range
              </p>
            </div>
          )}

          {/* Expandable detail */}
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
                    <a
                      href={info.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline font-mono"
                    >
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

          {/* Bookmark */}
          <div className="flex items-center gap-3 pt-2">
            {!isBookmarked && (
              <Input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note — e.g. 'Wait for ₹X entry'"
                className="bg-secondary border-border text-sm max-w-sm"
              />
            )}
            <Button
              variant={isBookmarked ? "outline" : "default"}
              size="sm"
              className="gap-2"
              onClick={handleBookmark}
            >
              {isBookmarked ? (
                <><BookmarkCheck className="h-4 w-4 text-green-500" /> Bookmarked</>
              ) : (
                <><Bookmark className="h-4 w-4" /> Save to Watchlist</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Watchlist · {watchlist.length} saved
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-left">Note</th>
                  <th className="px-4 py-3 text-left">Saved On</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w) => (
                  <tr key={w.symbol} className="border-t border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setQuery(w.symbol); search(w.symbol); }}
                        className="font-mono font-semibold text-primary hover:underline"
                      >
                        {w.symbol}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {watchlistNotes[w.symbol] !== undefined ? (
                        <Input
                          value={watchlistNotes[w.symbol]}
                          autoFocus
                          className="h-7 text-xs bg-secondary border-border"
                          onBlur={(e) => {
                            onAddToWatchlist(w.symbol, e.target.value);
                            setWatchlistNotes((p) => { const n = { ...p }; delete n[w.symbol]; return n; });
                          }}
                          onChange={(e) => setWatchlistNotes((p) => ({ ...p, [w.symbol]: e.target.value }))}
                        />
                      ) : (
                        <span
                          onClick={() => setWatchlistNotes((p) => ({ ...p, [w.symbol]: w.note }))}
                          className="cursor-text hover:text-foreground transition-colors"
                        >
                          {w.note || <span className="italic opacity-50">click to add note</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.addedAt}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onRemoveFromWatchlist(w.symbol)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
