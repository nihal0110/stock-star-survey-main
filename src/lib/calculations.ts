import {
  InvestmentEntry,
  DividendEntry,
  GoldEntry,
  SellEntry,
  StockSummary,
  SectorSummary,
  MutualFundEntry,
  MfSellEntry,
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
  sellId?: string;
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

/**
 * Compute remaining buy lots after FIFO deduction of sell entries.
 * Buy records are never modified — this returns synthetic entries with adjusted qty/amount.
 * Also handles legacy entries that still carry status="sold" from the old implementation.
 */
export function computeActiveEntries(
  buys: InvestmentEntry[],
  sells: SellEntry[],
): InvestmentEntry[] {
  // Legacy: exclude entries already marked sold by the old implementation
  const activeBuys = buys.filter((e) => e.status !== "sold");

  // Track remaining quantity per buy lot id
  const remaining = new Map<string, number>();
  for (const b of activeBuys) remaining.set(b.id, b.quantity);

  // Group active buys by stock, sorted FIFO
  const byStock = new Map<string, InvestmentEntry[]>();
  for (const b of activeBuys) {
    const key = b.stockName.trim().toUpperCase();
    if (!byStock.has(key)) byStock.set(key, []);
    byStock.get(key)!.push(b);
  }
  for (const arr of byStock.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  // Deduct sells in chronological order
  const sortedSells = [...sells].sort((a, b) => a.sellDate.localeCompare(b.sellDate));
  for (const sell of sortedSells) {
    const key = sell.stockName.trim().toUpperCase();
    const lots = byStock.get(key) ?? [];
    let toDeduct = sell.quantity;
    for (const lot of lots) {
      if (toDeduct <= 0) break;
      const rem = remaining.get(lot.id) ?? 0;
      const deduct = Math.min(toDeduct, rem);
      remaining.set(lot.id, rem - deduct);
      toDeduct -= deduct;
    }
  }

  return activeBuys
    .map((b) => {
      const rem = remaining.get(b.id) ?? 0;
      if (rem === 0) return null;
      const ratio = rem / b.quantity;
      return { ...b, quantity: rem, amount: b.amount * ratio, charges: b.charges * ratio };
    })
    .filter((b): b is InvestmentEntry => b !== null);
}

/**
 * Calculate realized P&L from the separate sells[] array using FIFO matching.
 * Buy records are matched in purchase-date order against sells in sell-date order.
 */
export function calculateRealizedPnLFromSells(
  buys: InvestmentEntry[],
  sells: SellEntry[],
): RealizedTrade[] {
  // Legacy sold entries from old implementation
  const legacyTrades = calculateRealizedPnL(buys);

  if (sells.length === 0) return legacyTrades;

  // Only use non-legacy buys (status !== "sold") for new FIFO matching
  const activeBuys = buys.filter((e) => e.status !== "sold");

  // Build per-stock FIFO queue
  const byStock = new Map<string, { lot: InvestmentEntry; remaining: number }[]>();
  for (const b of activeBuys) {
    const key = b.stockName.trim().toUpperCase();
    if (!byStock.has(key)) byStock.set(key, []);
    byStock.get(key)!.push({ lot: b, remaining: b.quantity });
  }
  for (const arr of byStock.values()) arr.sort((a, b) => a.lot.date.localeCompare(b.lot.date));

  const newTrades: RealizedTrade[] = [];
  const sortedSells = [...sells].sort((a, b) => a.sellDate.localeCompare(b.sellDate));

  for (const sell of sortedSells) {
    const key = sell.stockName.trim().toUpperCase();
    const lots = byStock.get(key) ?? [];
    let toMatch = sell.quantity;
    const sellPricePerUnit = sell.quantity > 0 ? sell.sellAmount / sell.quantity : 0;
    const sellChargesPerUnit = sell.quantity > 0 ? (sell.sellCharges ?? 0) / sell.quantity : 0;
    const netPerUnit = sellPricePerUnit - sellChargesPerUnit;

    for (const entry of lots) {
      if (toMatch <= 0) break;
      if (entry.remaining <= 0) continue;
      const matched = Math.min(toMatch, entry.remaining);
      const costPerUnit = entry.lot.quantity > 0 ? entry.lot.amount / entry.lot.quantity : 0;
      const costBasis = costPerUnit * matched;
      const sellAmount = netPerUnit * matched;
      const pnl = sellAmount - costBasis;
      const holdDays = Math.max(
        0,
        (new Date(sell.sellDate).getTime() - new Date(entry.lot.date).getTime()) / 86400000,
      );
      newTrades.push({
        id: `${sell.id}-${entry.lot.id}`,
        sellId: sell.id,
        stockName: sell.stockName,
        buyDate: entry.lot.date,
        sellDate: sell.sellDate,
        quantity: matched,
        avgBuyPrice: costPerUnit,
        sellPrice: sellPricePerUnit,
        costBasis,
        sellAmount,
        pnl,
        pnlPct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
        holdDays: Math.round(holdDays),
        isLongTerm: holdDays >= 365,
        sellNotes: sell.sellNotes,
      });
      entry.remaining -= matched;
      toMatch -= matched;
    }
  }

  return [...legacyTrades, ...newTrades].sort((a, b) => b.sellDate.localeCompare(a.sellDate));
}

/** FIFO realized P&L total across all MF sells — returns a single number. */
export function calcMfRealizedPnl(buys: MutualFundEntry[], sells: MfSellEntry[]): number {
  if (!buys.length || !sells.length) return 0;

  const byFund = new Map<string, { entry: MutualFundEntry; rem: number }[]>();
  for (const b of buys) {
    const key = b.fundName.trim().toUpperCase();
    if (!byFund.has(key)) byFund.set(key, []);
    byFund.get(key)!.push({ entry: b, rem: b.units });
  }
  for (const arr of byFund.values()) arr.sort((a, b) => a.entry.date.localeCompare(b.entry.date));

  let total = 0;
  const sortedSells = [...sells].sort((a, b) => a.sellDate.localeCompare(b.sellDate));
  for (const sell of sortedSells) {
    const key = sell.fundName.trim().toUpperCase();
    const lots = byFund.get(key) ?? [];
    let rem = sell.units;
    const netNavPerUnit = sell.units > 0
      ? (sell.sellAmount - (sell.sellCharges ?? 0)) / sell.units
      : 0;
    for (const lot of lots) {
      if (rem <= 0) break;
      if (lot.rem <= 0) continue;
      const matched = Math.min(rem, lot.rem);
      const costPerUnit = lot.entry.units > 0 ? lot.entry.amount / lot.entry.units : 0;
      total += (netNavPerUnit - costPerUnit) * matched;
      lot.rem -= matched;
      rem -= matched;
    }
  }
  return total;
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
