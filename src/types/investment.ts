export interface InvestmentEntry {
  id: string;
  stockName: string;
  sector: string;
  date: string;
  amount: number;
  quantity: number;
  charges: number;
}

export interface DividendEntry {
  id: string;
  stockName: string;
  date: string;
  amount: number; // total dividend amount received for this payment
}

export interface GoldEntry {
  id: string;
  date: string;
  quantity: number; // in grams
  charges: number;
  amount: number;
  tax: number;
}

export interface StockSummary {
  stockName: string;
  sector: string;
  totalAmount: number;
  totalQuantity: number;
  avgPrice: number;
  percentage: number;
  totalDividend: number;
}

export interface SectorSummary {
  sector: string;
  totalAmount: number;
  percentage: number;
}
