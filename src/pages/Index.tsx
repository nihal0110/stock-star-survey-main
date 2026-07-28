import { useMemo, useEffect, useState, lazy, Suspense } from "react";
import { useInvestments } from "@/hooks/useInvestments";
import { computeActiveEntries, calcMfRealizedPnl } from "@/lib/calculations";
import { useTheme } from "@/hooks/useTheme";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useFundamentals } from "@/hooks/useFundamentals";
import { useExpense } from "@/hooks/useExpense";

// Layout — always visible, keep eager
import AppHeader from "@/components/layout/AppHeader";
import Sidebar from "@/components/layout/Sidebar";

// Page components — lazy loaded on first visit
const Dashboard         = lazy(() => import("@/components/Dashboard"));
const EntryForm         = lazy(() => import("@/components/forms/EntryForm"));
const SellForm          = lazy(() => import("@/components/forms/SellForm"));
const DividendForm      = lazy(() => import("@/components/forms/DividendForm"));
const GoldEntryForm     = lazy(() => import("@/components/forms/GoldEntryForm"));
const MutualFunds       = lazy(() => import("@/components/MutualFunds"));
const PortfolioOverview = lazy(() => import("@/components/PortfolioOverview"));
const FilteredPortfolio = lazy(() => import("@/components/FilteredPortfolio"));
const LiveMarket        = lazy(() => import("@/components/LiveMarket"));
const Comparison        = lazy(() => import("@/components/Comparison"));
const StockResearch     = lazy(() => import("@/components/StockResearch"));
const Rebalance         = lazy(() => import("@/components/Rebalance"));
const DividendCalendar  = lazy(() => import("@/components/DividendCalendar"));
const GoalTracker       = lazy(() => import("@/components/GoalTracker"));
const BuffettBot        = lazy(() => import("@/components/BuffettBot"));
const Fundamentals           = lazy(() => import("@/components/Fundamentals"));
const MonthlyContributions   = lazy(() => import("@/components/MonthlyContributions"));
const ExpenseTracker         = lazy(() => import("@/components/expense/ExpenseTracker"));

const PAGE_TITLES: Record<string, string> = {
  dashboard:      "Dashboard",
  live:           "Live P&L",
  overview:       "Portfolio Overview",
  filtered:       "Filtered Portfolio",
  entry:          "Buy Stocks",
  sells:          "Sell Stocks",
  dividends:      "Dividends",
  gold:           "Gold",
  mf:             "Mutual Funds",
  research:       "Stock Research",
  compare:        "Compare",
  rebalance:      "Rebalance",
  "div-calendar": "Dividend Calendar",
  goals:          "Goals",
  buffett:        "Buffett Bot",
  fundamentals:   "Fundamentals",
  monthly:        "Monthly Contributions",
};

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm animate-pulse">
      Loading…
    </div>
  );
}

export default function Index() {
  const [page, setPage]   = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode]   = useState<"investment" | "expense">("investment");

  const {
    entries, addStockEntry, editStockEntry, deleteStockEntry,
    goldEntries, addGoldEntry, editGoldEntry, deleteGoldEntry,
    dividendEntries, addDividendEntry, editDividendEntry, deleteDividendEntry,
    sellEntries, addSellEntry, deleteSellEntry,
    holdings,
    mfEntries, addMfEntry, editMfEntry, deleteMfEntry,
    mfSellEntries, addMfSell, deleteMfSell,
    mfHoldings,
    targets, saveTarget,
    watchlist, addToWatchlist, removeFromWatchlist,
    goals, addGoal, editGoal, deleteGoal,
    exportData, importData,
  } = useInvestments();

  const { fundamentals, saveFundamental } = useFundamentals();
  const { months, config, saveMonth, saveConfig } = useExpense();
  const { theme, toggle: toggleTheme } = useTheme();
  const { prices, loading: liveLoading, lastUpdated, fetchPrices } = useLivePrices();
  const { goldPrice, loading: goldLoading, fetchGoldPrice } = useGoldPrice();

  const holdEntries = useMemo(() => computeActiveEntries(entries, sellEntries), [entries, sellEntries]);
  const mfRealizedPnl = useMemo(() => calcMfRealizedPnl(mfEntries, mfSellEntries), [mfEntries, mfSellEntries]);

  const liveSymbols = useMemo(
    () => [...new Set(holdEntries.map(e => e.stockName.trim()).filter(Boolean))],
    [holdEntries],
  );

  useEffect(() => {
    if (liveSymbols.length > 0) fetchPrices(liveSymbols);
  }, [liveSymbols.join(",")]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <AppHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        onExport={exportData}
        onImport={importData}
        onMenuToggle={() => setMenuOpen(o => !o)}
        mode={mode}
        onModeChange={setMode}
      />

      {mode === "expense" ? (
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <ExpenseTracker months={months} config={config} onSaveMonth={saveMonth} onSaveConfig={saveConfig} />
          </Suspense>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar active={page} onChange={setPage} open={menuOpen} onClose={() => setMenuOpen(false)} />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <h2 className="text-lg font-semibold mb-6">{PAGE_TITLES[page] ?? page}</h2>

              <Suspense fallback={<PageLoader />}>
                {page === "dashboard" && (
                  <Dashboard
                    entries={entries}
                    dividendEntries={dividendEntries ?? []}
                    goldEntries={goldEntries ?? []}
                    sellEntries={sellEntries}
                    prices={prices}
                    goldPrice={goldPrice}
                    loading={liveLoading}
                    mfRealizedPnl={mfRealizedPnl}
                  />
                )}
                {page === "entry" && (
                  <EntryForm onAdd={addStockEntry} onEdit={editStockEntry} onDelete={deleteStockEntry} entries={entries} />
                )}
                {page === "sells" && (
                  <SellForm entries={entries} sellEntries={sellEntries} holdings={holdings} onAddSell={addSellEntry} onDeleteSell={deleteSellEntry} />
                )}
                {page === "dividends" && (
                  <DividendForm
                    entries={entries}
                    dividendEntries={dividendEntries ?? []}
                    onAdd={addDividendEntry}
                    onEdit={editDividendEntry}
                    onDelete={deleteDividendEntry}
                  />
                )}
                {page === "live" && (
                  <LiveMarket
                    entries={holdEntries}
                    dividendEntries={dividendEntries ?? []}
                    targets={targets}
                    onSaveTarget={saveTarget}
                    prices={prices}
                    loading={liveLoading}
                    lastUpdated={lastUpdated}
                    fetchPrices={fetchPrices}
                  />
                )}
                {page === "overview" && (
                  <PortfolioOverview entries={holdEntries} dividendEntries={dividendEntries ?? []} />
                )}
                {page === "filtered" && (
                  <FilteredPortfolio entries={holdEntries} dividendEntries={dividendEntries ?? []} prices={prices} />
                )}
                {page === "gold" && (
                  <GoldEntryForm
                    onAdd={addGoldEntry}
                    onEdit={editGoldEntry}
                    onDelete={deleteGoldEntry}
                    entries={goldEntries}
                    goldPrice={goldPrice}
                    loadingPrice={goldLoading}
                    onRefreshPrice={fetchGoldPrice}
                  />
                )}
                {page === "mf" && (
                  <MutualFunds
                    mfEntries={mfEntries}
                    mfSellEntries={mfSellEntries}
                    mfHoldings={mfHoldings}
                    onAdd={addMfEntry}
                    onEdit={editMfEntry}
                    onDelete={deleteMfEntry}
                    onAddSell={addMfSell}
                    onDeleteSell={deleteMfSell}
                  />
                )}
                {page === "compare" && (
                  <Comparison
                    stockEntries={holdEntries}
                    goldEntries={goldEntries ?? []}
                    goldPrice={goldPrice}
                    prices={prices}
                  />
                )}
                {page === "research" && (
                  <StockResearch watchlist={watchlist} onAddToWatchlist={addToWatchlist} onRemoveFromWatchlist={removeFromWatchlist} />
                )}
                {page === "rebalance" && <Rebalance entries={holdEntries} />}
                {page === "div-calendar" && <DividendCalendar dividendEntries={dividendEntries ?? []} />}
                {page === "goals" && (
                  <GoalTracker
                    goals={goals ?? []}
                    entries={holdEntries}
                    prices={prices}
                    loadingPrices={liveLoading}
                    fetchPrices={fetchPrices}
                    onAdd={addGoal}
                    onEdit={editGoal}
                    onDelete={deleteGoal}
                  />
                )}
                {page === "buffett" && <BuffettBot entries={holdEntries} />}
                {page === "fundamentals" && (
                  <Fundamentals stockEntries={holdEntries} fundamentals={fundamentals} onSave={saveFundamental} />
                )}
                {page === "monthly" && <MonthlyContributions entries={holdEntries} />}
              </Suspense>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
