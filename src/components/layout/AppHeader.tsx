import { useRef } from "react";
import { BarChart3, Download, Upload, Printer, Sun, Moon, Menu, TrendingUp, Wallet } from "lucide-react";

interface Props {
  theme: string;
  onToggleTheme: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onMenuToggle: () => void;
  mode: "investment" | "expense";
  onModeChange: (mode: "investment" | "expense") => void;
}

export default function AppHeader({ theme, onToggleTheme, onExport, onImport, onMenuToggle, mode, onModeChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = "";
  };

  return (
    <header className="h-14 shrink-0 flex items-center px-4 gap-3 no-print z-20 relative"
      style={{ background: "hsl(var(--sidebar-bg))", borderBottom: "1px solid hsl(var(--sidebar-border))" }}>
      {/* Hamburger — mobile only */}
      <button
        className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-base tracking-tight hidden sm:block text-white">
          Stock<span className="text-primary">Star</span>
        </span>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center rounded-lg p-0.5 mx-2" style={{ background: "hsl(var(--sidebar-hover-bg))" }}>
        {(["investment", "expense"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all duration-150"
            style={mode === m
              ? { background: "hsl(var(--primary))", color: "white" }
              : { color: "hsl(var(--sidebar-fg))" }}
          >
            {m === "investment" ? <TrendingUp className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{m === "investment" ? "Investments" : "Expenses"}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        {[
          { label: "Import", icon: <Upload className="h-3.5 w-3.5" />, onClick: () => fileInputRef.current?.click() },
          { label: "Export", icon: <Download className="h-3.5 w-3.5" />, onClick: onExport },
          { label: "Print",  icon: <Printer className="h-3.5 w-3.5" />, onClick: () => window.print() },
        ].map(({ label, icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors duration-100"
            style={{ color: "hsl(var(--sidebar-fg))" }}
            onMouseEnter={e => (e.currentTarget.style.color = "white", e.currentTarget.style.background = "hsl(var(--sidebar-hover-bg))")}
            onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--sidebar-fg))", e.currentTarget.style.background = "")}
          >
            {icon}{label}
          </button>
        ))}

        {/* Mobile */}
        <button className="sm:hidden p-1.5 rounded-md" style={{ color: "hsl(var(--sidebar-fg))" }}
          onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
        </button>
        <button className="sm:hidden p-1.5 rounded-md" style={{ color: "hsl(var(--sidebar-fg))" }}
          onClick={onExport}>
          <Download className="h-4 w-4" />
        </button>

        <div className="h-4 w-px mx-1 hidden sm:block" style={{ background: "hsl(var(--sidebar-border))" }} />
        <button
          className="h-8 w-8 flex items-center justify-center rounded-md transition-colors duration-100"
          style={{ color: "hsl(var(--sidebar-fg))" }}
          onClick={onToggleTheme}
          title="Toggle theme"
          onMouseEnter={e => (e.currentTarget.style.color = "white", e.currentTarget.style.background = "hsl(var(--sidebar-hover-bg))")}
          onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--sidebar-fg))", e.currentTarget.style.background = "")}
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
