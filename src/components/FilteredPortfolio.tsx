import { useState, useMemo } from "react";
import { InvestmentEntry, DividendEntry } from "@/types/investment";
import PortfolioOverview from "./PortfolioOverview";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries?: DividendEntry[];
}

export default function FilteredPortfolio({ entries, dividendEntries = [] }: Props) {
  const allStocks = useMemo(() => {
    const names = new Set(entries.map((e) => e.stockName));
    return Array.from(names).sort();
  }, [entries]);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const toggleStock = (name: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredEntries = useMemo(
    () => entries.filter((e) => !excluded.has(e.stockName)),
    [entries, excluded]
  );

  if (allStocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Filter className="h-12 w-12 mb-4 opacity-30" />
        <p>No stocks available. Add entries first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stock filter */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4" /> Select Stocks to Include
        </h3>
        <div className="flex flex-wrap gap-3">
          {allStocks.map((name) => (
            <label
              key={name}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors text-sm font-mono ${
                excluded.has(name)
                  ? "border-border bg-secondary/50 text-muted-foreground line-through"
                  : "border-primary/30 bg-primary/5 text-primary"
              }`}
            >
              <Checkbox
                checked={!excluded.has(name)}
                onCheckedChange={() => toggleStock(name)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              {name}
            </label>
          ))}
        </div>
      </div>

      <PortfolioOverview
        entries={filteredEntries}
        dividendEntries={dividendEntries.filter((d) => !excluded.has(d.stockName))}
        title="Filtered Analysis"
      />
    </div>
  );
}
