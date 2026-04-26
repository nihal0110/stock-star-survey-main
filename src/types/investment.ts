export interface InvestmentEntry {
  id: string;
  stockName: string;
  sector: string;
  date: string;
  amount: number;
  quantity: number;
  charges: number;
  notes?: string;
  // Sell fields — populated when status = "sold"
  status?: "hold" | "sold";
  sellDate?: string;
  sellAmount?: number;
  sellCharges?: number;
  sellNotes?: string;
}

export interface DividendEntry {
  id: string;
  stockName: string;
  date: string;
  amount: number;
}

export interface GoldEntry {
  id: string;
  date: string;
  quantity: number;
  charges: number;
  amount: number;
  tax: number;
  quality?: "18K" | "22K" | "24K";
  status?: "hold" | "sold";
  sellDate?: string;
  sellAmount?: number;
  sellCharges?: number;
  sellNotes?: string;
}

export interface StockSummary {
  stockName: string;
  sector: string;
  totalAmount: number;
  totalQuantity: number;
  avgPrice: number;
  percentage: number;
  totalDividend: number;
  firstPurchaseDate: string;
}

export interface SectorSummary {
  sector: string;
  totalAmount: number;
  percentage: number;
}

export interface Target {
  price: number;
  setAt: string;
  history: { price: number; setAt: string }[];
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  createdAt: string;
}

export interface WatchlistEntry {
  symbol: string;
  addedAt: string;
  note: string;
}

export interface StockInfo {
  symbol: string;
  name: string | null;
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  dividendYield: number | null;
  dividendRate: number | null;
  eps: number | null;
  bookValue: number | null;
  priceToBook: number | null;
  pegRatio: number | null;
  beta: number | null;
  high52: number | null;
  low52: number | null;
  roe: number | null;
  profitMargin: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  currentRatio: number | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  employees: number | null;
  website: string | null;
}
