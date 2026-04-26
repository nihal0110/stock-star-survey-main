# Stock Star — Investment Portfolio Tracker

A full-stack investment tracker for Indian retail investors. Tracks stocks, gold, dividends, sells, goals, and benchmarks — all backed by a local JSON file. Real-time prices via Yahoo Finance.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI |
| Backend | Node.js, Express 5 |
| Data | Local JSON file (`~/OneDrive/Desktop/data.json`) |
| Market Data | Yahoo Finance API (proxied through backend) |

---

## Getting Started

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

The backend uses `node --watch` so server changes auto-restart without manual restarts.

---

## Data Storage

All data persists to a single JSON file at `~/OneDrive/Desktop/data.json`.

```json
{
  "stocks": [...],
  "gold": [...],
  "dividends": [...],
  "targets": { "STOCKNAME": { "price": 450, "setAt": "2024-01-01", "history": [] } },
  "watchlist": [...],
  "goals": [...],
  "sectorTargets": { "Technology": 30, "Finance": 25 }
}
```

### Stock Entry Shape

```json
{
  "id": "uuid",
  "stockName": "INFY",
  "sector": "Technology",
  "date": "2023-06-15",
  "amount": 50000,
  "quantity": 100,
  "charges": 50,
  "notes": "optional",
  "status": "hold",

  "sellDate": "2024-03-01",
  "sellAmount": 65000,
  "sellCharges": 65,
  "sellNotes": "target hit"
}
```

`status` is `"hold"` (default) or `"sold"`. Sell fields are only populated when `status = "sold"`. A single stock record holds both buy and sell data — no separate sell table.

---

## App Tabs & Features

### Stocks
Add, edit, and delete buy entries. Each entry records the stock name, sector, date, total invested amount, quantity, and brokerage charges.

### Sells
Shows all holdings **consolidated by stock name** (not by individual buy lot). Enter how many shares to sell, the total sale proceeds, charges, and notes.

**FIFO allocation**: Oldest lots are consumed first. If a sell spans multiple lots, proceeds and charges are split proportionally. Partial lots are automatically split into a sold portion and a remaining hold portion.

The closed positions table shows each trade with buy/sell dates, P&L in rupees and percent, and whether it qualifies as STCG or LTCG.

### Dividends
Log dividend payments by stock and date. Dividends appear as yield metrics in the Live P&L and Portfolio tabs.

### Live P&L
Fetches current market prices for all held stocks and shows:
- Unrealized P&L (absolute and %)
- XIRR — true annualized return accounting for timing of every investment
- CAGR per stock
- Dividend yield per stock and portfolio-wide
- Price targets — set a target price, see the % gap to current price, and track target history
- 52-week high/low, days held, day change

Prices are fetched on-demand via the Refresh button (or automatically on load).

### Portfolio
Consolidated view of all active (unsold) positions:
- Per-stock breakdown: total quantity, average buy price, total invested, allocation %
- Sector allocation with progress bars
- Total dividends reinvested and overall yield

Sold positions are excluded from all calculations here.

### Filtered Portfolio
Same as Portfolio but with checkboxes to exclude specific stocks. Re-aggregates everything on the fly. Useful for analysing sub-portfolios (e.g. "how is my banking sector doing without HDFC").

### Gold
Separate tracking for physical gold / sovereign gold bonds. Fields: date, grams, amount, charges, GST. Included in the Comparison tab.

### Compare
Benchmarks your portfolio returns against Nifty 50:

- **Scenario A — Same-date SIP**: Replicates every buy you made in the Nifty index on the same dates and amounts, then compares XIRR.
- **Scenario B — Lump sum**: Places your entire invested capital into Nifty on your first investment date and compares XIRR.

Also shows the stock vs gold split across your total portfolio.

### Research
Search for any NSE/BSE stock and fetch fundamentals from Yahoo Finance:
- PE (trailing & forward), EPS, Book Value, Price-to-Book, PEG
- Dividend yield and rate
- Market cap, 52-week range, Beta
- ROE, Profit margin, Debt-to-equity, Revenue growth, Current ratio
- Sector, industry, company description

Add any stock to a watchlist with optional notes.

### Rebalance
Set target allocation percentages per sector. The dashboard compares actual vs target and shows:
- Current allocation % and invested amount
- Drift from target
- Amount needed to reach target allocation
- Status indicator: green (±2%), yellow (±5%), red (>5%)

### Div Calendar
Monthly income view of all dividends received. Shows:
- Per-month totals for the selected year
- Per-stock annual totals
- Projected annualised run-rate based on the last 12 months

### Goals
Set financial goals with a target amount and date:
- Tracks progress using current portfolio value (invested or live market value)
- Calculates required monthly SIP to reach the goal
- Projects the date you'll hit the goal based on your historical CAGR (defaults to 10% if no price data)
- Accounts for the existing corpus — only the gap beyond what your current holdings will grow to needs SIP

---

## Backend API Reference

All endpoints are at `http://localhost:3001`.

### CRUD Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/stock` | All stock entries |
| POST | `/stock` | Add entry |
| PUT | `/stock/:id` | Update entry |
| DELETE | `/stock/:id` | Delete entry |
| GET | `/gold` | All gold entries |
| POST | `/gold` | Add gold |
| PUT | `/gold/:id` | Update gold |
| DELETE | `/gold/:id` | Delete gold |
| GET | `/dividend` | All dividends |
| POST | `/dividend` | Add dividend |
| PUT | `/dividend/:id` | Update dividend |
| DELETE | `/dividend/:id` | Delete dividend |
| GET | `/targets` | All price targets |
| POST | `/targets/:stock` | Set/remove target (`{ price: 450 }` or `{ price: null }`) |
| GET | `/watchlist` | Watchlist |
| POST | `/watchlist` | Add to watchlist |
| DELETE | `/watchlist/:symbol` | Remove from watchlist |
| GET | `/goals` | All goals |
| POST | `/goals` | Add goal |
| PUT | `/goals/:id` | Update goal |
| DELETE | `/goals/:id` | Delete goal |
| GET | `/sector-targets` | Sector allocation targets |
| POST | `/sector-targets` | Save sector targets |

Every mutation response returns `{ success: true, data: updatedArray }` so the frontend replaces its state without a separate re-fetch.

### Market Data (Yahoo Finance Proxy)

| Method | Path | Description |
|---|---|---|
| GET | `/search?q=QUERY` | Stock name autocomplete (NSE/BSE only) |
| GET | `/stock-info/:symbol` | Full fundamentals (25+ metrics) |
| GET | `/live-price/:symbol` | Current price, change, 52-week range |
| GET | `/nifty-prices?from=YYYY-MM-DD` | Historical Nifty 50 daily closes |

Yahoo Finance uses crumb-based authentication (session cookie + crumb token). The backend caches the crumb for 1 hour and refreshes it automatically.

---

## Calculation Logic

### XIRR
Newton-Raphson iteration on the discounted cash flow equation:

```
Σ CF_i / (1 + r)^(days_i / 365.25) = 0
```

Buys are negative cash flows; the current portfolio value (or sell proceeds) is positive. Returns annualised % or null if convergence fails.

### CAGR
```
(currentValue / invested) ^ (365.25 / daysHeld) - 1
```

Returned as a percentage. Null if holding period is under 1 day.

### Realized P&L
For each sold entry:
```
net sell  = sellAmount - sellCharges
P&L       = net sell - costBasis (original buy amount)
P&L %     = P&L / costBasis × 100
```

Tax classification:
- **STCG** (< 365 days held) — 15% flat tax
- **LTCG** (≥ 365 days held) — 10% on gains above ₹1 lakh

### FIFO Sell Allocation
1. Group all `status = "hold"` entries for the selected stock
2. Sort by purchase date (oldest first)
3. Walk lots, consuming `sellQty` shares:
   - Full lot consumed → mark `status = "sold"`, assign proportional proceeds
   - Partial lot consumed → split into a new sold record + update original with remaining qty
4. Proceeds and charges are split across lots by `lotSellQty / totalSellQty`

### Goal SIP Formula
```
r         = annualRate / 12
n         = monthsRemaining
fvCurrent = currentValue × (1 + r)^n      ← existing corpus grows too
gap       = targetAmount - fvCurrent
SIP       = (gap × r) / ((1 + r)^n - 1)
```

---

## Data Flow

### On App Load
```
Index.tsx mounts
  → useInvestments fetches /stock, /gold, /dividend, /targets, /watchlist, /goals
  → useLivePrices auto-fetches prices for all held symbols
  → All state distributed to child components as props
```

### Mutation (e.g. adding a stock)
```
EntryForm submits
  → onAdd() in useInvestments
  → POST /stock → server appends to data.json
  → Response: { data: updatedArray }
  → setEntries(updatedArray)
  → React re-renders all affected components
```

### Selling a Stock (FIFO)
```
SellForm confirms sell
  → For each affected lot (oldest first):
      await onEdit(fullLot)  OR  await onAdd(soldSplit) + await onEdit(remainder)
  → Each call hits PUT /stock/:id or POST /stock sequentially
  → State updated after every call
```

### Fetching Live Prices
```
Index.tsx useEffect (on symbol list change)
  → useLivePrices.fetchPrices(symbols)
  → GET /live-price/:symbol for each held stock
  → Backend proxies to Yahoo Finance
  → prices state updated: { INFY: { price, change, ... }, ... }
  → LiveMarket receives prices as props, calculates P&L + XIRR in useMemo
```

---

## Export / Import

**Export**: Downloads a JSON snapshot of stocks, gold, dividends, and targets as `invest-tracker-YYYY-MM-DD.json`.

**Import**: Reads a previously exported JSON and replaces in-memory state. Does not auto-persist to the backend — each subsequent add/edit/delete will persist normally from that point.

---

## Project Structure

```
├── server/
│   └── index.js               — Express API, Yahoo Finance proxies, data.json I/O
├── src/
│   ├── components/
│   │   ├── forms/
│   │   │   ├── EntryForm.tsx       — Buy entry form (add/edit/delete)
│   │   │   ├── SellForm.tsx        — Sell form (consolidated, FIFO)
│   │   │   ├── DividendForm.tsx    — Dividend logging
│   │   │   └── GoldEntryForm.tsx   — Gold purchase form
│   │   ├── common/
│   │   │   ├── StatCard.tsx        — Reusable metric card
│   │   │   └── ConfirmDialog.tsx   — Confirmation modal
│   │   ├── layout/
│   │   │   └── AppHeader.tsx       — Header, theme toggle, export/import
│   │   ├── LiveMarket.tsx          — Real-time P&L dashboard
│   │   ├── LiveMarketTable.tsx     — Detailed per-stock live table
│   │   ├── PortfolioOverview.tsx   — Summary + sector breakdown
│   │   ├── FilteredPortfolio.tsx   — Filterable portfolio view
│   │   ├── Comparison.tsx          — Nifty 50 benchmark comparison
│   │   ├── StockResearch.tsx       — Fundamentals search + watchlist
│   │   ├── Rebalance.tsx           — Sector rebalancing tool
│   │   ├── DividendCalendar.tsx    — Monthly dividend calendar
│   │   └── GoalTracker.tsx         — Goal progress + SIP calculator
│   ├── hooks/
│   │   ├── useInvestments.ts       — All CRUD operations + state
│   │   ├── useLivePrices.ts        — Price fetching
│   │   └── useTheme.ts             — Dark/light mode
│   ├── lib/
│   │   ├── calculations.ts         — XIRR, portfolio aggregation, realized P&L
│   │   └── format.ts               — CAGR, fmt(), pct(), daysHeld()
│   ├── types/
│   │   └── investment.ts           — All TypeScript interfaces
│   └── pages/
│       └── Index.tsx               — Main page, tab layout, state wiring
```
