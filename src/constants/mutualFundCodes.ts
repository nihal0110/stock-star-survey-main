// Display name → NSE ticker code used for live NAV/price lookup
// ETFs trade on NSE so the same Yahoo Finance proxy works (appends .NS)
export const mutualFundCodes: Record<string, string> = {
  "Nippon India Multi Cap Dir Gr": "0P0000XVDF",
  "ICICI Prudential Liquid Fund GR": "0P00005UNH",
};

export const MF_CATEGORIES = [
  "Index Fund",
  "Large Cap",
  "Mid Cap",
  "Small Cap",
  "Flexi Cap",
  "Multi Cap",
  "ELSS",
  "Hybrid",
  "Debt",
  "Liquid",
  "Gold ETF",
  "International",
  "Sectoral / Thematic",
  "Other",
];
