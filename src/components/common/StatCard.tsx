import { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  borderClass?: string;
  icon?: ReactNode;
}

export default function StatCard({ label, value, sub, valueClass, borderClass = "border-border", icon }: Props) {
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
