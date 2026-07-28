import { useMemo, useState, useCallback, useEffect } from "react";
import { InvestmentEntry, DividendEntry } from "@/types/investment";
import { calculatePortfolio } from "@/lib/calculations";
import { fmt, daysHeld } from "@/lib/format";
import { TrendingUp, PieChart, Gift, Brain, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stockCodes } from "@/constants/stockCodes";
import {
  analyzeStock, BuffettAnalysis, StockFundamentals,
  gradeColor, gradeBg,
} from "@/lib/buffett";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries?: DividendEntry[];
  title?: string;
}

type Verdict = "Strong Buy" | "Hold" | "Review" | "Reduce" | "Avoid";

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong Buy": "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  "Hold":       "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "Review":     "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  "Reduce":     "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "Avoid":      "bg-red-500/15 text-red-500 border-red-500/30",
};

const VERDICT_ORDER: Verdict[] = ["Strong Buy", "Hold", "Review", "Reduce", "Avoid"];

type ScoreEntry = BuffettAnalysis | "loading" | "error";

function ScorePill({ a }: { a: BuffettAnalysis }) {
  const verdict = a.verdict as Verdict;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${gradeBg(a.grade)} ${gradeColor(a.grade)}`}>
        {a.grade}
      </span>
      <div className="flex items-center gap-1">
        <div className="w-10 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              a.overallScore >= 70 ? "bg-emerald-500" :
              a.overallScore >= 50 ? "bg-blue-500" :
              a.overallScore >= 35 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${a.overallScore}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{a.overallScore}</span>
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${VERDICT_STYLE[verdict] ?? ""}`}>
        {verdict}
      </span>
    </div>
  );
}

export default function PortfolioOverview({
  entries,
  dividendEntries = [],
  title = "Portfolio Overview",
}: Props) {
  const { totalInvested, stocks, sectors, totalDividends } = useMemo(
    () => calculatePortfolio(entries, dividendEntries),
    [entries, dividendEntries],
  );

  const [scores, setScores] = useState<Record<string, ScoreEntry>>({});
  const [fetching, setFetching] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "All">("All");

  const holdStocks = useMemo(
    () => stocks.map(s => s.stockName.trim().toUpperCase()),
    [stocks],
  );

  // Auto-load on mount
  useEffect(() => { loadScores(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadScores = useCallback(async () => {
    if (fetching || holdStocks.length === 0) return;
    setFetching(true);

    // seed all as loading
    const init: Record<string, ScoreEntry> = {};
    for (const sym of holdStocks) init[sym] = "loading";
    setScores(init);

    for (const sym of holdStocks) {
      const apiCode = stockCodes[sym] ?? sym;
      try {
        const res = await fetch(`http://localhost:3001/stock-info/${encodeURIComponent(apiCode)}`);
        const data = await res.json();
        if (data?.error) {
          setScores(prev => ({ ...prev, [sym]: "error" }));
        } else {
          const fundamentals: StockFundamentals = { ...data, symbol: sym };
          const analysis = analyzeStock(fundamentals);
          setScores(prev => ({ ...prev, [sym]: analysis }));
        }
      } catch {
        setScores(prev => ({ ...prev, [sym]: "error" }));
      }
    }
    setFetching(false);
  }, [holdStocks, fetching]);

  // verdict filter chips — only show options that exist in results
  const availableVerdicts = useMemo(() => {
    const set = new Set<Verdict>();
    for (const sym of holdStocks) {
      const sc = scores[sym];
      if (sc && sc !== "loading" && sc !== "error") set.add(sc.verdict as Verdict);
    }
    return VERDICT_ORDER.filter(v => set.has(v));
  }, [scores, holdStocks]);

  const filteredStocks = useMemo(() => {
    const sorted = [...stocks].sort((a, b) => b.percentage - a.percentage);
    if (verdictFilter === "All") return sorted;
    return sorted.filter(s => {
      const sym = s.stockName.trim().toUpperCase();
      const sc = scores[sym];
      if (!sc || sc === "loading" || sc === "error") return true;
      return sc.verdict === verdictFilter;
    });
  }, [stocks, scores, verdictFilter]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <PieChart className="h-12 w-12 mb-4 opacity-30" />
        <p>No data to display. Add entries first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Top stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-muted-foreground text-sm uppercase tracking-wider">
              {title} — Total Invested
            </span>
          </div>
          <p className="text-4xl font-mono font-bold text-primary">₹{fmt(totalInvested)}</p>
        </div>

        {totalDividends > 0 && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-1">
              <Gift className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground text-sm uppercase tracking-wider">
                Dividends Reinvested
              </span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground">₹{fmt(totalDividends)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {((totalDividends / totalInvested) * 100).toFixed(2)}% yield · compounding via reinvestment
            </p>
          </div>
        )}
      </div>

      {/* ── Stock Breakdown ───────────────────────────────────────────────── */}
      <div>
        {/* Section header + controls */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground">
            Stock Breakdown
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Verdict filter chips — appear once any score resolves */}
            {availableVerdicts.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                {(["All", ...availableVerdicts] as (Verdict | "All")[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setVerdictFilter(v)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                      verdictFilter === v
                        ? v === "All"
                          ? "bg-primary text-primary-foreground border-primary"
                          : (VERDICT_STYLE[v as Verdict] ?? "bg-primary text-primary-foreground border-primary")
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={loadScores}
              disabled={fetching}
              className="gap-1.5 text-xs h-8"
            >
              {fetching
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <Brain className="h-3 w-3" />}
              {fetching ? "Loading…" : "Refresh Scores"}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Sector</th>
                  <th className="px-4 py-3 text-left">
                    <span className="flex items-center gap-1 text-primary">
                      <Brain className="h-3 w-3" /> Buffett Rating
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Total Invested</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Days Held</th>
                  <th className="px-4 py-3 text-right">Dividends</th>
                  <th className="px-4 py-3 text-right">Allocation %</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock) => {
                  const sym = stock.stockName.trim().toUpperCase();
                  const sc = scores[sym];

                  return (
                    <tr
                      key={stock.stockName}
                      className="border-t border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {stock.stockName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{stock.sector}</td>

                      {/* Buffett Rating — always shown */}
                      <td className="px-4 py-3 min-w-[180px]">
                        {sc === "loading" ? (
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <RefreshCw className="h-3 w-3 animate-spin" /> fetching…
                          </span>
                        ) : sc === "error" ? (
                          <span className="text-[11px] text-muted-foreground italic">no data</span>
                        ) : sc ? (
                          <ScorePill a={sc} />
                        ) : (
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <RefreshCw className="h-3 w-3 animate-spin" /> fetching…
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-right">₹{fmt(stock.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono text-right">{stock.totalQuantity}</td>
                      <td className="px-4 py-3 font-mono text-right">₹{fmt(stock.avgPrice)}</td>
                      <td className="px-4 py-3 font-mono text-right text-muted-foreground">
                        {daysHeld(stock.firstPurchaseDate)}d
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {stock.totalDividend > 0 ? (
                          <div>
                            <span className="text-foreground">₹{fmt(stock.totalDividend)}</span>
                            <p className="text-[10px] text-muted-foreground">
                              {((stock.totalDividend / stock.totalAmount) * 100).toFixed(2)}% ↺
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(stock.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-accent w-14 text-right">
                            {stock.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filter summary */}
        {verdictFilter !== "All" && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing {filteredStocks.length} of {stocks.length} stocks · filtered by "{verdictFilter}"
            <button onClick={() => setVerdictFilter("All")} className="ml-2 text-primary hover:underline">Clear</button>
          </p>
        )}
      </div>

      {/* ── Sector Allocation ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Sector Allocation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors
            .sort((a, b) => b.percentage - a.percentage)
            .map((sector) => (
              <div key={sector.sector} className="rounded-lg border border-border bg-card p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{sector.sector}</span>
                  <span className="font-mono text-accent font-semibold">
                    {sector.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(sector.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  ₹{fmt(sector.totalAmount)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
