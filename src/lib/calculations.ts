import { InvestmentEntry, DividendEntry, StockSummary, SectorSummary } from "@/types/investment";

export function calculatePortfolio(
  entries: InvestmentEntry[],
  dividendEntries: DividendEntry[] = []
) {
  const totalInvested = entries.reduce((sum, e) => sum + e.amount, 0);

  // Sum dividends per stock
  const dividendMap = new Map<string, number>();
  for (const d of dividendEntries) {
    dividendMap.set(d.stockName, (dividendMap.get(d.stockName) ?? 0) + d.amount);
  }

  const stockMap = new Map<
    string,
    { sector: string; totalAmount: number; totalQuantity: number }
  >();

  for (const e of entries) {
    const existing = stockMap.get(e.stockName);
    if (existing) {
      existing.totalAmount += e.amount;
      existing.totalQuantity += e.quantity;
    } else {
      stockMap.set(e.stockName, {
        sector: e.sector,
        totalAmount: e.amount,
        totalQuantity: e.quantity,
      });
    }
  }

  const stocks: StockSummary[] = Array.from(stockMap.entries()).map(
    ([stockName, data]) => ({
      stockName,
      sector: data.sector,
      totalAmount: data.totalAmount,
      totalQuantity: data.totalQuantity,
      avgPrice: data.totalQuantity > 0 ? data.totalAmount / data.totalQuantity : 0,
      percentage: totalInvested > 0 ? (data.totalAmount / totalInvested) * 100 : 0,
      totalDividend: dividendMap.get(stockName) ?? 0,
    })
  );

  const sectorMap = new Map<string, number>();
  for (const s of stocks) {
    sectorMap.set(s.sector, (sectorMap.get(s.sector) ?? 0) + s.totalAmount);
  }

  const sectors: SectorSummary[] = Array.from(sectorMap.entries()).map(
    ([sector, totalAmount]) => ({
      sector,
      totalAmount,
      percentage: totalInvested > 0 ? (totalAmount / totalInvested) * 100 : 0,
    })
  );

  const totalDividends = dividendEntries.reduce((sum, d) => sum + d.amount, 0);

  return { totalInvested, stocks, sectors, totalDividends };
}
