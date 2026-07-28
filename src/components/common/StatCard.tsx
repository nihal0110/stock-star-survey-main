import { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  borderClass?: string;
  icon?: ReactNode;
  /**
   * When provided, renders the icon inside a 40×40 rounded wrapper using these
   * Tailwind classes (e.g. "bg-blue-500/10 text-blue-500"). Switches the card
   * to the "expense-style" layout with the icon on the left.
   */
  iconBg?: string;
}

export default function StatCard({
  label, value, sub,
  valueClass, borderClass = "border-border",
  icon, iconBg,
}: Props) {
  // Icon-left layout (expense tracker style)
  if (iconBg && icon) {
    return (
      <div className={`rounded-xl border ${borderClass} bg-card p-5 flex gap-4 items-start`}>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className={`text-xl font-bold font-mono mt-0.5 ${valueClass ?? ""}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
    );
  }

  // Default layout (stock tracker style)
  return (
    <div className={`rounded-lg border ${borderClass} bg-card p-4`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-2xl font-mono font-bold ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="text-xs font-mono text-muted-foreground">{sub}</p>}
    </div>
  );
}
