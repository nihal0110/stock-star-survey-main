import { useMemo, useEffect, useState } from "react";
import { useInvestments } from "@/hooks/useInvestments";
import { useTheme } from "@/hooks/useTheme";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import AppHeader from "@/components/layout/AppHeader";
import Sidebar from "@/components/layout/Sidebar";
import Dashboard from "@/components/Dashboard";
import EntryForm from "@/components/forms/EntryForm";
import PortfolioOverview from "@/components/PortfolioOverview";
import FilteredPortfolio from "@/components/FilteredPortfolio";
import GoldEntryForm from "@/components/forms/GoldEntryForm";
import Comparison from "@/components/Comparison";
import DividendForm from "@/components/forms/DividendForm";
import LiveMarket from "@/components/LiveMarket";
import StockResearch from "@/components/StockResearch";
import Rebalance from "@/components/Rebalance";
import DividendCalendar from "@/components/DividendCalendar";
import GoalTracker from "@/components/GoalTracker";
import SellForm from "@/components/forms/SellForm";

const PAGE_TITLES: Record<string, string> = {
  dashboard:    "Dashboard",
  live:         "Live P&L",
  overview:     "Portfolio Overview",
  filtered:     "Filtered Portfolio",
  entry:        "Buy Stocks",
  sells:        "Sell Stocks",
  dividends:    "Dividends",
  gold:         "Gold",
  research:     "Stock Research",
  compare:      "Compare",
  rebalance:    "Rebalance",
  "div-calendar": "Dividend Calendar",
  goals:        "Goals",
};

export default function Index() {
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    entries, addStockEntry, editStockEntry, deleteStockEntry,
    goldEntries, addGoldEntry, editGoldEntry, deleteGoldEntry,
    dividendEntries, addDividendEntry, editDividendEntry, deleteDividendEntry,
    targets, saveTarget,
    watchlist, addToWatchlist, removeFromWatchlist,
    goals, addGoal, editGoal, deleteGoal,
    exportData, importData,
  } = useInvestments();

  const { theme, toggle: toggleTheme } = useTheme();
  const { prices, loading: liveLoading, lastUpdated, fetchPrices } = useLivePrices();
  const { goldPrice, loading: goldLoading, fetchGoldPrice } = useGoldPrice();

  const liveSymbols = useMemo(
    () => [...new Set(entries.filter((e) => e.status !== "sold").map((e) => e.stockName.trim()).filter(Boolean))],
    [entries],
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
        onMenuToggle={() => setMenuOpen((o) => !o)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={page}
          onChange={setPage}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {/* Page title */}
            <h2 className="text-lg font-semibold mb-6">{PAGE_TITLES[page] ?? page}</h2>

            {page === "dashboard" && (
              <Dashboard
                entries={entries}
                dividendEntries={dividendEntries ?? []}
                goldEntries={goldEntries ?? []}
                prices={prices}
                goldPrice={goldPrice}
                loading={liveLoading}
              />
            )}

            {page === "entry" && (
              <EntryForm
                onAdd={addStockEntry}
                onEdit={editStockEntry}
                onDelete={deleteStockEntry}
                entries={entries}
              />
            )}

            {page === "sells" && (
              <SellForm
                entries={entries}
                onAdd={addStockEntry}
                onEdit={editStockEntry}
              />
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
                entries={entries}
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
              <PortfolioOverview
                entries={entries}
                dividendEntries={dividendEntries ?? []}
              />
            )}

            {page === "filtered" && (
              <FilteredPortfolio
                entries={entries}
                dividendEntries={dividendEntries ?? []}
              />
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

            {page === "compare" && (
              <Comparison
                stockEntries={entries}
                goldEntries={goldEntries ?? []}
                goldPrice={goldPrice}
                prices={prices}
              />
            )}

            {page === "research" && (
              <StockResearch
                watchlist={watchlist}
                onAddToWatchlist={addToWatchlist}
                onRemoveFromWatchlist={removeFromWatchlist}
              />
            )}

            {page === "rebalance" && (
              <Rebalance entries={entries} />
            )}

            {page === "div-calendar" && (
              <DividendCalendar dividendEntries={dividendEntries ?? []} />
            )}

            {page === "goals" && (
              <GoalTracker
                goals={goals ?? []}
                entries={entries}
                prices={prices}
                loadingPrices={liveLoading}
                fetchPrices={fetchPrices}
                onAdd={addGoal}
                onEdit={editGoal}
                onDelete={deleteGoal}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
