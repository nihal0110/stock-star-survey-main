import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, ALL_MONTHS } from "@/lib/expense-utils";

interface Props {
  selectedIdx: number;
  onChange: (i: number) => void;
  /** Return true when a month has saved data — controls pill styling */
  hasData?: (month: string) => boolean;
  /** Optional override; defaults to ALL_MONTHS (all 12 of EXPENSE_YEAR) */
  monthKeys?: string[];
}

export default function MonthNav({ selectedIdx, onChange, hasData, monthKeys = ALL_MONTHS }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => selectedIdx > 0 && onChange(selectedIdx - 1)}
        disabled={selectedIdx === 0}
        className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-secondary disabled:opacity-30 shrink-0 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none">
        {monthKeys.map((m, i) => {
          const saved = hasData?.(m) ?? false;
          const active = i === selectedIdx;
          return (
            <button
              key={m}
              onClick={() => onChange(i)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : saved
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                  : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {MONTH_NAMES[i]}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => selectedIdx < monthKeys.length - 1 && onChange(selectedIdx + 1)}
        disabled={selectedIdx === monthKeys.length - 1}
        className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-secondary disabled:opacity-30 shrink-0 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
