import { useState, useEffect } from "react";
import { InvestmentEntry, StockFundamental, FundamentalScores, FundamentalHistoricalRow } from "@/types/investment";
import { calculatePortfolio } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, PieChart } from "lucide-react";

interface Props {
  stockEntries: InvestmentEntry[];
  fundamentals: StockFundamental[];
  onSave: (entry: StockFundamental) => void;
}

const SCORE_CRITERIA: { key: keyof FundamentalScores; label: string; desc: string }[] = [
  { key: "moat",          label: "Economic Moat",          desc: "Durable competitive advantage over rivals" },
  { key: "management",    label: "Management Quality",     desc: "Trustworthy, shareholder-friendly leadership" },
  { key: "roe",           label: "Return on Equity",       desc: "Consistently high ROE without excess debt" },
  { key: "debt",          label: "Low Debt",               desc: "Conservative debt levels, survives downturns" },
  { key: "earningsGrowth",label: "Earnings Growth",        desc: "Consistent profit growth over many years" },
  { key: "understandable",label: "Understandable Business",desc: "Simple, predictable business model" },
  { key: "valuePrice",    label: "Bought at Value Price",  desc: "Purchased at or below intrinsic value" },
];

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 9 + i);

function defaultHistory(): FundamentalHistoricalRow[] {
  return DEFAULT_YEARS.map((year) => ({ year, pe: 0, pb: 0, profit: 0, revenue: 0 }));
}

function defaultScores(): FundamentalScores {
  return { moat: 0, management: 0, roe: 0, debt: 0, earningsGrowth: 0, understandable: 0, valuePrice: 0 };
}

function cagr(first: number, last: number, years: number): number | null {
  if (first <= 0 || last <= 0 || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function Signal({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div>
      <span className={`text-base font-bold ${color}`}>{label}</span>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

export default function Fundamentals({ stockEntries, fundamentals, onSave }: Props) {
  const { stocks } = calculatePortfolio(stockEntries);
  const uniqueStocks = stocks.map((s) => s.stockName).sort();

  const [selected, setSelected] = useState(uniqueStocks[0] ?? "");
  const [currentPrice, setCurrentPrice] = useState("");
  const [currentPE, setCurrentPE] = useState("");
  const [currentPB, setCurrentPB] = useState("");
  const [scores, setScores] = useState<FundamentalScores>(defaultScores());
  const [history, setHistory] = useState<FundamentalHistoricalRow[]>(defaultHistory());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = fundamentals.find((f) => f.stockName === selected);
    if (existing) {
      setCurrentPrice(existing.currentPrice ? String(existing.currentPrice) : "");
      setCurrentPE(existing.currentPE ? String(existing.currentPE) : "");
      setCurrentPB(existing.currentPB ? String(existing.currentPB) : "");
      setScores(existing.scores);
      setHistory(existing.history.length === 10 ? existing.history : defaultHistory());
    } else {
      setCurrentPrice("");
      setCurrentPE("");
      setCurrentPB("");
      setScores(defaultScores());
      setHistory(defaultHistory());
    }
    setSaved(false);
  }, [selected, fundamentals]);

  const stockData = stocks.find((s) => s.stockName === selected);
  const avgBuyPrice = stockData?.avgPrice ?? 0;
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = 35;

  const scoreRating = () => {
    if (totalScore >= 29) return { label: "Excellent", verdict: "Strong Buy", color: "text-emerald-500" };
    if (totalScore >= 22) return { label: "Good",      verdict: "Consider Buying", color: "text-blue-500" };
    if (totalScore >= 15) return { label: "Average",   verdict: "Hold", color: "text-yellow-500" };
    return                       { label: "Poor",      verdict: "Avoid", color: "text-red-500" };
  };

  const priceSignal = () => {
    const cp = parseFloat(currentPrice);
    if (!cp || !avgBuyPrice) return null;
    const ratio = cp / avgBuyPrice;
    if (ratio <= 0.95) return { label: "Good Buy", color: "text-emerald-500", sub: `${((1 - ratio) * 100).toFixed(1)}% below your avg buy price` };
    if (ratio <= 1.05) return { label: "Near Avg",  color: "text-yellow-500", sub: "Within 5% of your avg buy price" };
    return                    { label: "Above Avg", color: "text-red-500",     sub: `${((ratio - 1) * 100).toFixed(1)}% above your avg buy price` };
  };

  const historicalStats = () => {
    const validPE = history.filter((h) => h.pe > 0);
    const validPB = history.filter((h) => h.pb > 0);
    const validProfit  = history.filter((h) => h.profit > 0);
    const validRevenue = history.filter((h) => h.revenue > 0);

    const avgPE = validPE.length ? validPE.reduce((a, b) => a + b.pe, 0) / validPE.length : null;
    const avgPB = validPB.length ? validPB.reduce((a, b) => a + b.pb, 0) / validPB.length : null;

    const cp = parseFloat(currentPE);
    const cb = parseFloat(currentPB);

    const peStatus = (avgPE && cp) ? (cp < avgPE * 0.8 ? "UNDERVALUED" : cp > avgPE * 1.2 ? "OVERVALUED" : "FAIR VALUE") : null;
    const pbStatus = (avgPB && cb) ? (cb < avgPB * 0.8 ? "UNDERVALUED" : cb > avgPB * 1.2 ? "OVERVALUED" : "FAIR VALUE") : null;

    const statusColor = (s: string | null) =>
      s === "UNDERVALUED" ? "text-emerald-500" : s === "OVERVALUED" ? "text-red-500" : "text-yellow-500";

    const profitCAGR = validProfit.length >= 2
      ? cagr(validProfit[0].profit, validProfit[validProfit.length - 1].profit,
             validProfit[validProfit.length - 1].year - validProfit[0].year)
      : null;

    const revenueCAGR = validRevenue.length >= 2
      ? cagr(validRevenue[0].revenue, validRevenue[validRevenue.length - 1].revenue,
             validRevenue[validRevenue.length - 1].year - validRevenue[0].year)
      : null;

    return { avgPE, avgPB, peStatus, pbStatus, statusColor, profitCAGR, revenueCAGR };
  };

  const updateHistory = (index: number, field: keyof FundamentalHistoricalRow, value: string) => {
    setHistory((prev) =>
      prev.map((row, i) => i === index ? { ...row, [field]: parseFloat(value) || 0 } : row)
    );
  };

  const handleSave = async () => {
    if (!selected) return;
    const existing = fundamentals.find((f) => f.stockName === selected);
    await onSave({
      id: existing?.id ?? crypto.randomUUID(),
      stockName: selected,
      currentPrice: parseFloat(currentPrice) || 0,
      currentPE: parseFloat(currentPE) || 0,
      currentPB: parseFloat(currentPB) || 0,
      scores,
      history,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const rating = scoreRating();
  const price  = priceSignal();
  const stats  = historicalStats();

  const cagrColor = (v: number | null) =>
    v === null ? "" : v >= 15 ? "text-emerald-500" : v >= 8 ? "text-yellow-500" : "text-red-500";

  if (uniqueStocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <PieChart className="h-12 w-12 mb-4 opacity-30" />
        <p>Add stocks in Buy section first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stock</Label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-10 rounded-md border border-border bg-secondary px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[160px]"
          >
            {uniqueStocks.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {stockData && (
          <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">Avg Buy Price: </span>
            <span className="font-mono font-semibold text-primary">₹{avgBuyPrice.toFixed(2)}</span>
            <span className="text-muted-foreground ml-3">Qty: </span>
            <span className="font-mono font-semibold">{stockData.totalQuantity}</span>
          </div>
        )}

        <Button onClick={handleSave} className="ml-auto gap-2">
          <Save className="h-4 w-4" />
          {saved ? "Saved!" : "Save Analysis"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Current Metrics */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Current Market Metrics</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Current Price (₹)</Label>
                <Input type="number" step="0.01" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder="0.00" className="bg-secondary border-border font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Current PE</Label>
                <Input type="number" step="0.1" value={currentPE} onChange={(e) => setCurrentPE(e.target.value)} placeholder="0.0" className="bg-secondary border-border font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Current PB</Label>
                <Input type="number" step="0.1" value={currentPB} onChange={(e) => setCurrentPB(e.target.value)} placeholder="0.0" className="bg-secondary border-border font-mono" />
              </div>
            </div>
          </div>

          {/* Buffett Scores */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Buffett Criteria</h3>
              <span className={`font-mono font-bold text-lg ${rating.color}`}>{totalScore}/{maxScore}</span>
            </div>

            <div className="space-y-3">
              {SCORE_CRITERIA.map(({ key, label, desc }) => (
                <div key={key}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setScores((prev) => ({ ...prev, [key]: prev[key] === n ? 0 : n }))}
                          className={`w-8 h-8 rounded text-sm font-bold border transition-colors ${
                            scores[key] >= n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary border-border text-muted-foreground hover:border-primary"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: Results ── */}
        <div className="space-y-4">
          {/* Buffett Verdict */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Buffett Score</h3>
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-bold font-mono ${rating.color}`}>{totalScore}</span>
              <span className="text-muted-foreground font-mono">/ {maxScore}</span>
              <span className={`ml-2 text-lg font-semibold ${rating.color}`}>{rating.label}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(totalScore / maxScore) * 100}%` }}
              />
            </div>
            <p className={`text-sm font-semibold ${rating.color}`}>{rating.verdict}</p>
          </div>

          {/* Price vs Avg Buy */}
          {price && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Price vs Your Avg Buy</h3>
              <Signal label={price.label} sub={price.sub} color={price.color} />
              <p className="text-xs font-mono text-muted-foreground">
                Current ₹{parseFloat(currentPrice).toFixed(2)} · Avg ₹{avgBuyPrice.toFixed(2)}
              </p>
            </div>
          )}

          {/* PE / PB vs History */}
          {(stats.avgPE || stats.avgPB) && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Valuation vs 10Y History</h3>
              <div className="grid grid-cols-2 gap-4">
                {stats.avgPE && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">PE Ratio</p>
                    <p className="text-sm font-mono">10Y Avg: <span className="font-bold">{stats.avgPE.toFixed(1)}</span></p>
                    {currentPE && <p className="text-sm font-mono">Current: <span className={`font-bold ${stats.statusColor(stats.peStatus)}`}>{parseFloat(currentPE).toFixed(1)}</span></p>}
                    {stats.peStatus && <p className={`text-xs font-bold mt-1 ${stats.statusColor(stats.peStatus)}`}>{stats.peStatus}</p>}
                  </div>
                )}
                {stats.avgPB && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">PB Ratio</p>
                    <p className="text-sm font-mono">10Y Avg: <span className="font-bold">{stats.avgPB.toFixed(1)}</span></p>
                    {currentPB && <p className="text-sm font-mono">Current: <span className={`font-bold ${stats.statusColor(stats.pbStatus)}`}>{parseFloat(currentPB).toFixed(1)}</span></p>}
                    {stats.pbStatus && <p className={`text-xs font-bold mt-1 ${stats.statusColor(stats.pbStatus)}`}>{stats.pbStatus}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CAGR */}
          {(stats.profitCAGR !== null || stats.revenueCAGR !== null) && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Growth (CAGR from History)</h3>
              <div className="grid grid-cols-2 gap-4">
                {stats.profitCAGR !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Profit CAGR</p>
                    <p className={`text-2xl font-mono font-bold ${cagrColor(stats.profitCAGR)}`}>
                      {stats.profitCAGR >= 0 ? "+" : ""}{stats.profitCAGR.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {stats.profitCAGR >= 15 ? "Strong growth" : stats.profitCAGR >= 8 ? "Moderate" : "Weak"}
                    </p>
                  </div>
                )}
                {stats.revenueCAGR !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Revenue CAGR</p>
                    <p className={`text-2xl font-mono font-bold ${cagrColor(stats.revenueCAGR)}`}>
                      {stats.revenueCAGR >= 0 ? "+" : ""}{stats.revenueCAGR.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {stats.revenueCAGR >= 15 ? "Strong growth" : stats.revenueCAGR >= 8 ? "Moderate" : "Weak"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 10-Year Historical Table */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">10-Year Historical Data (enter values manually)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Year</th>
                <th className="px-3 py-2 text-right">PE</th>
                <th className="px-3 py-2 text-right">PB</th>
                <th className="px-3 py-2 text-right">Profit (Cr)</th>
                <th className="px-3 py-2 text-right">Revenue (Cr)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
                <tr key={row.year} className="border-t border-border hover:bg-secondary/40 transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-primary">{row.year}</td>
                  {(["pe", "pb", "profit", "revenue"] as const).map((field) => (
                    <td key={field} className="px-3 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row[field] || ""}
                        onChange={(e) => updateHistory(i, field, e.target.value)}
                        placeholder="—"
                        className="bg-secondary border-border font-mono h-7 text-right text-xs ml-auto"
                        style={{ width: field === "pe" || field === "pb" ? "80px" : "110px" }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
