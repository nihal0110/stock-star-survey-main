import {
  LayoutDashboard, Activity, BarChart3, SlidersHorizontal,
  PlusCircle, TrendingDown, Gift, Coins,
  Search, Scale, GitFork, CalendarDays, Trophy,
  type LucideIcon,
} from "lucide-react";

interface NavItem { id: string; label: string; icon: LucideIcon; }
interface NavGroup { label?: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  {
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Portfolio",
    items: [
      { id: "live",     label: "Live P&L",  icon: Activity },
      { id: "overview", label: "Overview",  icon: BarChart3 },
      { id: "filtered", label: "Filtered",  icon: SlidersHorizontal },
    ],
  },
  {
    label: "Transactions",
    items: [
      { id: "entry",     label: "Buy",       icon: PlusCircle },
      { id: "sells",     label: "Sell",      icon: TrendingDown },
      { id: "dividends", label: "Dividends", icon: Gift },
      { id: "gold",      label: "Gold",      icon: Coins },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "research",     label: "Research",     icon: Search },
      { id: "compare",      label: "Compare",      icon: Scale },
      { id: "rebalance",    label: "Rebalance",    icon: GitFork },
      { id: "div-calendar", label: "Div Calendar", icon: CalendarDays },
      { id: "goals",        label: "Goals",        icon: Trophy },
    ],
  },
];

interface Props {
  active: string;
  onChange: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ active, onChange, open, onClose }: Props) {
  const handleNav = (id: string) => { onChange(id); onClose(); };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          sidebar-shell
          fixed top-0 left-0 z-40 h-full w-56 flex flex-col overflow-y-auto
          transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:z-auto md:h-auto md:min-h-full
        `}
      >
        {/* Logo — shown inside sidebar on mobile */}
        <div className="h-14 flex items-center px-5 shrink-0 md:hidden"
          style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }}>
          <span className="font-bold text-base tracking-tight text-white">
            Stock<span style={{ color: "hsl(var(--primary))" }}>Star</span>
          </span>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {NAV.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "pt-3" : ""}>
              {group.label && (
                <p className="sidebar-section-label">{group.label}</p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom branding */}
        <div className="px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}>
          <p className="text-[11px]" style={{ color: "hsl(var(--sidebar-label))" }}>
            StockStar v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
