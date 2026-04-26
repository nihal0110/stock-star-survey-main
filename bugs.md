d# Bug Logb
## BUG-001 · Duplicate Yahoo Finance API calls on tab switch
**Status**: Fixed  
**File**: `src/components/LiveMarket.tsx`  
**Cause**: `useLivePrices()` was called inside `LiveMarket`. React tabs unmount the inactive tab's component. Every time the user switches back to Live P&L, the component remounts with fresh state, `useEffect` fires, and all N stocks are fetched again from Yahoo Finance.  
**Fix**: Moved `useLivePrices()` up to `Index.tsx` so prices survive tab switches. `LiveMarket` now receives `prices / loading / lastUpdated / fetchPrices` as props.

---

## BUG-002 · `calculatePortfolio` not memoized — needless recalculation every render
**Status**: Fixed  
**File**: `src/components/LiveMarket.tsx`, `src/components/PortfolioOverview.tsx`  
**Cause**: `calculatePortfolio(entries, dividendEntries)` was called directly in the render body without `useMemo`. It returns new object/array references every render, so any downstream `useMemo(..., [stocks])` always sees a "changed" dependency and recomputes.  
**Fix**: Wrapped in `useMemo(() => calculatePortfolio(...), [entries, dividendEntries])`.

---

## BUG-003 · Wrong import path in `useLivePrices.ts`
**Status**: Fixed  
**File**: `src/hooks/useLivePrices.ts` line 2  
**Cause**: `import { stockCode } from "../hooks/constants/code"` — file is already inside `src/hooks/`, so `../hooks/` is redundant and only works by coincidence on case-insensitive file systems.  
**Fix**: Changed to `"./constants/code"`.

---

## BUG-004 · `targets.json` type mismatch — array vs object
**Status**: Fixed  
**File**: `src/hooks/backend.js` (`readJSON` helper)  
**Cause**: `readJSON` returns `[]` (empty array) for a missing file. `targets` is typed as `Record<string, number>` (plain object). When `targets.json` does not exist yet, the backend returns `[]`, which silently becomes an unusable array on the frontend and `Object.keys([])` returns index strings instead of stock names.  
**Fix**: Added separate `readJSONObj` helper that returns `{}` for targets.

---

## BUG-005 · Stock name case sensitivity creates phantom duplicate stocks
**Status**: Fixed  
**File**: `src/lib/calculations.ts`  
**Cause**: `stockMap.get(e.stockName)` is case-sensitive. An entry saved as `"ITC"` and another saved as `"itc"` are treated as two different stocks, producing two rows and two API calls for the same company.  
**Fix**: Normalise `stockName` with `.trim().toUpperCase()` inside `calculatePortfolio`.
