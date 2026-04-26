# Fix Process

## BUG-001 — Tab switch duplicate calls

**Investigation**: Watched network tab while switching between Portfolio and Live P&L tabs. Saw all N stock requests fire again on every return to Live P&L.  
**Root cause**: Component lifecycle. React's `<Tabs>` renders only the active tab, so `LiveMarket` unmounts on deselect and remounts on select. Its internal `useLivePrices()` state resets to `{}`, and the `useEffect` fires on mount.  
**Fix**: Lifted `useLivePrices()` into `Index.tsx` (always mounted). Symbols list computed once from `entries` with `useMemo`. `useEffect` in `Index.tsx` fires only when the set of stock names changes. `LiveMarket` receives live data as props — no lifecycle dependency.

---

## BUG-002 — Needless recalculation

**Investigation**: Added a `console.count("calculatePortfolio")` — it fired on every state change (targets update, tab switch, etc.), not just when entries/dividends changed.  
**Root cause**: Called bare in render body. Every state change in parent → `LiveMarket` re-renders → `calculatePortfolio` runs → new array references → dependent `useMemo([stocks])` recomputes too.  
**Fix**: `useMemo(() => calculatePortfolio(entries, dividendEntries), [entries, dividendEntries])`. Now recalculates only when portfolio data actually changes.

---

## BUG-003 — Wrong import path

**Investigation**: Noticed `"../hooks/constants/code"` in `src/hooks/useLivePrices.ts`. File is already in `src/hooks/` so going `..` lands in `src/`, then `hooks/constants/code` resolves to `src/hooks/constants/code`. Works on Windows (case-insensitive FS) but would silently break on Linux/Mac CI.  
**Fix**: Corrected to `"./constants/code"`.

---

## BUG-004 — Targets type mismatch

**Investigation**: `console.log(targets)` after loading showed `[]` instead of `{}` when `targets.json` did not exist yet. `Object.keys([])` on an array returns numeric index strings, making all target lookups fail silently.  
**Root cause**: Shared `readJSON` helper always returns `[]` as the empty fallback. JSON arrays and objects are both valid JSON so the parse path cannot distinguish intent.  
**Fix**: Added `readJSONObj(file)` that returns `{}` as its empty fallback. Used exclusively for the targets endpoint.

---

## BUG-005 — Case-sensitive stock name duplicates

**Investigation**: User had entries with names `"Tata Motors Passenger"` and `"TATA MOTORS PASSENGER"`. `calculatePortfolio` created two separate rows, producing two Yahoo Finance requests for `TMPV.NS`.  
**Root cause**: `stockMap.get(e.stockName)` — JavaScript `Map` uses strict equality for keys.  
**Fix**: Normalise inside the aggregation loop: `const key = e.stockName.trim().toUpperCase()`. Both entries now merge into one row.
