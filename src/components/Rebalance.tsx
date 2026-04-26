import { useState, useEffect, useMemo } from "react";
import { InvestmentEntry } from "@/types/investment";
import { calculatePortfolio } from "@/lib/calculations";
import { fmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, CheckCircle2, AlertTriangle, XCircle, Pencil } from "lucide-react";

const API = "http://localhost:3001";

interface Props {
  entries: InvestmentEntry[];
}

function statusIcon(drift: number) {
  const abs = Math.abs(drift);
  if (abs <= 2) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (abs <= 5) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function driftColor(drift: number) {
  const abs = Math.abs(drift);
  if (abs <= 2) return "text-green-500";
  if (abs <= 5) return "text-yellow-500";
  return "text-red-500";
}

export default function Rebalance({ entries }: Props) {
  const [sectorTargets, setSectorTargets] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API}/sector-targets`).then((r) => r.json()).then(setSectorTargets).catch(() => {});
  }, []);

  const { sectors, totalInvested } = useMemo(
    () => calculatePortfolio(entries),
    [entries],
  );

  const totalTarget = Object.values(sectorTargets).reduce((s, v) => s + v, 0);

  const startEdit = () => {
    const d: Record<string, string> = {};
    for (const s of sectors) d[s.sector] = String(sectorTargets[s.sector] ?? "");
    setDraft(d);
    setEditing(true);
  };

  const saveTargets = async () => {
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(draft)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) payload[k] = n;
    }
    const res = await fetch(`${API}/sector-targets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSectorTargets((await res.json()).data);
    setEditing(false);
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <SlidersHorizontal className="h-12 w-12 mb-4 opacity-30" />
        <p>No entries yet. Add stock entries to use rebalancing.</p>
      </div>
    );
  }

  const rows = sectors
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((s) => {
      const target = sectorTargets[s.sector] ?? null;
      const drift = target !== null ? s.percentage - target : null;
      const amountToReach = target !== null ? (target / 100) * totalInvested - s.totalAmount : null;
      return { ...s, target, drift, amountToReach };
    });

  const hasTargets = Object.keys(sectorTargets).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rebalancing Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set target allocations per sector · see how far you've drifted
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={editing ? saveTargets : startEdit}>
          {editing ? <><CheckCircle2 className="h-4 w-4" /> Save Targets</> : <><Pencil className="h-4 w-4" /> Edit Targets</>}
        </Button>
      </div>

      {hasTargets && totalTarget !== 100 && !editing && (
        <p className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2">
          Your targets add up to {totalTarget.toFixed(1)}% — they should total 100% for accurate rebalancing.
        </p>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-right">Invested</th>
              <th className="px-4 py-3 text-right">Current %</th>
              <th className="px-4 py-3 text-right">Target %</th>
              <th className="px-4 py-3 text-right">Drift</th>
              <th className="px-4 py-3 text-right">Action</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sector} className="border-t border-border hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3 font-medium">{row.sector}</td>
                <td className="px-4 py-3 font-mono text-right">₹{fmt(row.totalAmount)}</td>
                <td className="px-4 py-3 font-mono text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                    </div>
                    <span className="w-12 text-right">{row.percentage.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-right">
                  {editing ? (
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={draft[row.sector] ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, [row.sector]: e.target.value }))}
                      className="h-7 w-20 text-xs font-mono text-right bg-secondary border-border ml-auto"
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {row.target !== null ? `${row.target.toFixed(1)}%` : <span className="italic opacity-50">—</span>}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 font-mono text-right ${row.drift !== null ? driftColor(row.drift) : "text-muted-foreground"}`}>
                  {row.drift !== null ? (row.drift >= 0 ? "+" : "") + row.drift.toFixed(1) + "%" : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-right text-xs">
                  {row.amountToReach !== null ? (
                    <span className={row.amountToReach >= 0 ? "text-green-500" : "text-red-400"}>
                      {row.amountToReach >= 0 ? `Buy ₹${fmt(row.amountToReach)}` : `Overweight ₹${fmt(Math.abs(row.amountToReach))}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">set target</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.drift !== null ? statusIcon(row.drift) : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/50 font-semibold text-sm">
              <td className="px-4 py-3 text-xs uppercase tracking-wider">Total</td>
              <td className="px-4 py-3 font-mono text-right">₹{fmt(totalInvested)}</td>
              <td className="px-4 py-3 font-mono text-right">100%</td>
              <td className="px-4 py-3 font-mono text-right text-muted-foreground">
                {hasTargets ? `${totalTarget.toFixed(1)}%` : "—"}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      {!hasTargets && !editing && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Click <strong>Edit Targets</strong> to set your ideal sector allocation percentages.
        </p>
      )}

      {hasTargets && !editing && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> On Target
            </p>
            <p className="text-xl font-mono font-bold text-green-500">
              {rows.filter(r => r.drift !== null && Math.abs(r.drift) <= 2).length} sectors
            </p>
            <p className="text-xs text-muted-foreground">within ±2%</p>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /> Drifting
            </p>
            <p className="text-xl font-mono font-bold text-yellow-500">
              {rows.filter(r => r.drift !== null && Math.abs(r.drift) > 2 && Math.abs(r.drift) <= 5).length} sectors
            </p>
            <p className="text-xs text-muted-foreground">2–5% off target</p>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" /> Off Balance
            </p>
            <p className="text-xl font-mono font-bold text-red-500">
              {rows.filter(r => r.drift !== null && Math.abs(r.drift) > 5).length} sectors
            </p>
            <p className="text-xs text-muted-foreground">more than 5% off</p>
          </div>
        </div>
      )}
    </div>
  );
}
