import { useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvestments } from "@/hooks/useInvestments";
import { useTheme } from "@/hooks/useTheme";
import EntryForm from "@/components/EntryForm";
import PortfolioOverview from "@/components/PortfolioOverview";
import FilteredPortfolio from "@/components/FilteredPortfolio";
import GoldEntryForm from "@/components/GoldEntryForm";
import Comparison from "@/components/Comparison";
import DividendForm from "@/components/DividendForm";
import LiveMarket from "@/components/LiveMarket";
import {
  BarChart3,
  PlusCircle,
  SlidersHorizontal,
  Download,
  Upload,
  Printer,
  Coins,
  Scale,
  Sun,
  Moon,
  Gift,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Index() {
  const {
    entries,
    addStockEntry,
    editStockEntry,
    deleteStockEntry,
    goldEntries,
    addGoldEntry,
    editGoldEntry,
    deleteGoldEntry,
    dividendEntries,
    addDividendEntry,
    editDividendEntry,
    deleteDividendEntry,
    exportData,
    importData,
  } = useInvestments();
  const { theme, toggle: toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Invest<span className="text-primary">Tracker</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportData}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="entry" className="space-y-6">
          <TabsList className="bg-secondary border border-border no-print flex-wrap h-auto gap-1 p-1">
            <TabsTrigger
              value="entry"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <PlusCircle className="h-4 w-4" /> Stocks
            </TabsTrigger>
            <TabsTrigger
              value="dividends"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Gift className="h-4 w-4" /> Dividends
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Activity className="h-4 w-4" /> Live P&amp;L
            </TabsTrigger>
            <TabsTrigger
              value="overview"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="h-4 w-4" /> Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="filtered"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtered
            </TabsTrigger>
            <TabsTrigger
              value="gold"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Coins className="h-4 w-4" /> Gold
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Scale className="h-4 w-4" /> Compare
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entry">
            <EntryForm
              onAdd={addStockEntry}
              onEdit={editStockEntry}
              entries={entries}
              onDelete={deleteStockEntry}
            />
          </TabsContent>

          <TabsContent value="dividends">
            <DividendForm
              entries={entries}
              dividendEntries={dividendEntries ?? []}
              onAdd={addDividendEntry}
              onEdit={editDividendEntry}
              onDelete={deleteDividendEntry}
            />
          </TabsContent>

          <TabsContent value="live">
            <LiveMarket entries={entries} dividendEntries={dividendEntries ?? []} />
          </TabsContent>

          <TabsContent value="overview">
            <PortfolioOverview entries={entries} dividendEntries={dividendEntries ?? []} />
          </TabsContent>

          <TabsContent value="filtered">
            <FilteredPortfolio entries={entries} dividendEntries={dividendEntries ?? []} />
          </TabsContent>

          <TabsContent value="gold">
            <GoldEntryForm
              onAdd={addGoldEntry}
              onEdit={editGoldEntry}
              entries={goldEntries}
              onDelete={deleteGoldEntry}
            />
          </TabsContent>

          <TabsContent value="compare">
            <Comparison stockEntries={entries} goldEntries={goldEntries ?? []} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
