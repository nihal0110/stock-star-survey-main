import {
  InvestmentEntry,
  DividendEntry,
  GoldEntry,
  StockSummary,
  SectorSummary,
} from "@/types/investment";

export function xirr(cashflows: { date: string; amount: number }[]): number | null {
  if (cashflows.length < 2) return null;
  if (!cashflows.some((c) => c.amount > 0) || !cashflows.some((c) => c.amount < 0)) return null;

  const t0 = new Date(cashflows[0].date).getTime();
  const days = cashflows.map((c) => (new Date(c.date).getTime() - t0) / 86400000);
  const amounts = cashflows.map((c) => c.amount);

  const f = (r: number) =>
    amounts.reduce((s, a, i) => s + a / Math.pow(1 + r, days[i] / 365.25), 0);
  const df = (r: number) =>
    amounts.reduce((s, a, i) => s - ((days[i] / 365.25) * a) / Math.pow(1 + r, days[i] / 365.25 + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 200; i++) {
    const dfr = df(rate);
    if (Math.abs(dfr) < 1e-12) break;
    const next = rate - f(rate) / dfr;
    if (Math.abs(next - rate) < 1e-8) return next * 100;
    rate = next;
    if (rate <= -1) return null;
  }
  return null;
}

export function calculatePortfolio(
  entries: InvestmentEntry[],
  dividendEntries: DividendEntry[] = [],
) {
  // Only active (hold) positions
  const active = entries.filter((e) => e.status !== "sold");

  const dividendMap = new Map<string, number>();
  for (const d of dividendEntries) {
    const key = d.stockName.trim().toUpperCase();
    dividendMap.set(key, (dividendMap.get(key) ?? 0) + d.amount);
  }

  const stockMap = new Map<string, {
    displayName: string;
    sector: string;
    totalAmount: number;
    totalQuantity: number;
    firstDate: string;
  }>();

  for (const e of active) {
    const key = e.stockName.trim().toUpperCase();
    const existing = stockMap.get(key);
    if (existing) {
      existing.totalAmount += e.amount;
      existing.totalQuantity += e.quantity;
      if (e.date < existing.firstDate) existing.firstDate = e.date;
    } else {
      stockMap.set(key, {
        displayName: e.stockName.trim(),
        sector: e.sector,
        totalAmount: e.amount,
        totalQuantity: e.quantity,
        firstDate: e.date,
      });
    }
  }

  const stocks: StockSummary[] = Array.from(stockMap.entries()).map(([key, data]) => ({
    stockName: data.displayName,
    sector: data.sector,
    totalAmount: data.totalAmount,
    totalQuantity: data.totalQuantity,
    avgPrice: data.totalQuantity > 0 ? data.totalAmount / data.totalQuantity : 0,
    percentage: 0,
    totalDividend: dividendMap.get(key) ?? 0,
    firstPurchaseDate: data.firstDate,
  }));

  const totalInvested = stocks.reduce((sum, s) => sum + s.totalAmount, 0);
  for (const s of stocks) {
    s.percentage = totalInvested > 0 ? (s.totalAmount / totalInvested) * 100 : 0;
  }

  const sectorMap = new Map<string, number>();
  for (const s of stocks) {
    sectorMap.set(s.sector, (sectorMap.get(s.sector) ?? 0) + s.totalAmount);
  }

  const sectors: SectorSummary[] = Array.from(sectorMap.entries()).map(
    ([sector, totalAmount]) => ({
      sector,
      totalAmount,
      percentage: totalInvested > 0 ? (totalAmount / totalInvested) * 100 : 0,
    }),
  );

  const totalDividends = dividendEntries.reduce((sum, d) => sum + d.amount, 0);

  return { totalInvested, stocks, sectors, totalDividends };
}

export interface GoldRealizedTrade {
  id: string;
  quality?: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyAmount: number;
  netSellAmount: number;
  pnl: number;
  pnlPct: number;
  holdDays: number;
  sellNotes?: string;
}

export function calculateGoldRealizedPnL(entries: GoldEntry[]): GoldRealizedTrade[] {
  return entries
    .filter((e) => e.status === "sold" && e.sellDate && e.sellAmount != null)
    .map((e) => {
      const buyAmount = e.amount;
      const netSellAmount = (e.sellAmount ?? 0) - (e.sellCharges ?? 0);
      const pnl = netSellAmount - buyAmount;
      const holdDays = Math.max(
        0,
        (new Date(e.sellDate!).getTime() - new Date(e.date).getTime()) / 86400000,
      );
      return {
        id: e.id,
        quality: e.quality,
        buyDate: e.date,
        sellDate: e.sellDate!,
        quantity: e.quantity,
        buyAmount,
        netSellAmount,
        pnl,
        pnlPct: buyAmount > 0 ? (pnl / buyAmount) * 100 : 0,
        holdDays: Math.round(holdDays),
        sellNotes: e.sellNotes,
      };
    })
    .sort((a, b) => b.sellDate.localeCompare(a.sellDate));
}

export interface RealizedTrade {
  id: string;
  stockName: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  avgBuyPrice: number;
  sellPrice: number;
  costBasis: number;
  sellAmount: number;
  pnl: number;
  pnlPct: number;
  holdDays: number;
  isLongTerm: boolean;
  notes?: string;
  sellNotes?: string;
}

export function calculateRealizedPnL(entries: InvestmentEntry[]): RealizedTrade[] {
  return entries
    .filter((e) => e.status === "sold" && e.sellDate && e.sellAmount != null)
    .map((e) => {
      const avgBuyPrice = e.quantity > 0 ? e.amount / e.quantity : 0;
      const costBasis = e.amount;
      const sellAmount = (e.sellAmount ?? 0) - (e.sellCharges ?? 0);
      const pnl = sellAmount - costBasis;
      const holdDays = Math.max(0,
        (new Date(e.sellDate!).getTime() - new Date(e.date).getTime()) / 86400000
      );
      return {
        id: e.id,
        stockName: e.stockName,
        buyDate: e.date,
        sellDate: e.sellDate!,
        quantity: e.quantity,
        avgBuyPrice,
        sellPrice: e.quantity > 0 ? (e.sellAmount ?? 0) / e.quantity : 0,
        costBasis,
        sellAmount,
        pnl,
        pnlPct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
        holdDays: Math.round(holdDays),
        isLongTerm: holdDays >= 365,
        notes: e.notes,
        sellNotes: e.sellNotes,
      };
    })
    .sort((a, b) => b.sellDate.localeCompare(a.sellDate));
}
