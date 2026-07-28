export interface ExpenseCats {
  investment: number;
  policies: number;
  family: number;
  savings: number;
  emergencyFund: number;
  gold: number;
  personalExpenses: number;
}

export interface ExpenseSpend extends ExpenseCats {
  leftOver: number;
}

export interface ExpenseMonth {
  id: string;
  month: string;        // "2026-01"
  totalSalary: number;
  salary: number;
  split: ExpenseCats;       // percentages
  allocation: ExpenseCats;  // actual amounts allocated (can be auto-calc or manual)
  spend: ExpenseSpend;      // actual spend + leftOver misc cash
  notes?: string;           // free-form personal breakdown notes
}

export interface ExpenseConfig {
  initialBalance: ExpenseCats; // Year 2025 carry-forward starting values
}

// Computed row in the balance sheet
export interface BalanceRow {
  month: string;
  label: string;
  balance: ExpenseCats;
  leftOver: number;
  total: number;
}

// ── Personal expense sub-categories (completely separate) ─────────────────────
export interface PersonalCats {
  food: number; bus: number; friend: number; friendsOut: number;
  fuel: number; cab: number; bikeRent: number; smoke: number;
  tea: number; lunch: number; breakfast: number; dinner: number;
  snacks: number; grocery: number; me: number; recharge: number;
  medicine: number; beverages: number; trainMetro: number;
  beauty: number; charges: number; product: number; movies: number;
  dress: number; other: number;
}

export interface PersonalExpenseMonth {
  id: string;
  month: string; // "2026-01"
  entries: PersonalCats;
  notes?: string;
}

export const PERSONAL_KEYS: (keyof PersonalCats)[] = [
  "food","bus","friend","friendsOut","fuel","cab","bikeRent","smoke",
  "tea","lunch","breakfast","dinner","snacks","grocery","me","recharge",
  "medicine","beverages","trainMetro","beauty","charges","product","movies",
  "dress","other",
];

export const PERSONAL_LABELS: Record<keyof PersonalCats, string> = {
  food:"Food", bus:"Bus", friend:"Friend", friendsOut:"Friends Out",
  fuel:"Fuel", cab:"Cab", bikeRent:"Bike Rent", smoke:"Smoke",
  tea:"Tea", lunch:"Lunch", breakfast:"Breakfast", dinner:"Dinner",
  snacks:"Snacks", grocery:"Grocery", me:"Me", recharge:"Recharge",
  medicine:"Medicine", beverages:"Beverages", trainMetro:"Train/Metro",
  beauty:"Beauty", charges:"Charges", product:"Product", movies:"Movies",
  dress:"Dress", other:"Other",
};

export const PERSONAL_COLORS: Record<keyof PersonalCats, string> = {
  food:"#ef4444", bus:"#3b82f6", friend:"#8b5cf6", friendsOut:"#ec4899",
  fuel:"#f97316", cab:"#06b6d4", bikeRent:"#84cc16", smoke:"#6b7280",
  tea:"#d97706", lunch:"#10b981", breakfast:"#f59e0b", dinner:"#6366f1",
  snacks:"#e879f9", grocery:"#14b8a6", me:"#f43f5e", recharge:"#0ea5e9",
  medicine:"#22c55e", beverages:"#a855f7", trainMetro:"#64748b",
  beauty:"#fb7185", charges:"#94a3b8", product:"#fbbf24", movies:"#c026d3",
  dress:"#0891b2", other:"#9ca3af",
};

export const CAT_KEYS: (keyof ExpenseCats)[] = [
  "investment", "policies", "family", "savings", "emergencyFund", "gold", "personalExpenses",
];

export const CAT_LABELS: Record<keyof ExpenseCats, string> = {
  investment:      "Investment",
  policies:        "Policies",
  family:          "Family",
  savings:         "Savings",
  emergencyFund:   "Emergency Fund",
  gold:            "Gold",
  personalExpenses:"Personal Expenses",
};
