# Buffett Bot — Principles Reference

**Engine:** `src/lib/buffett.ts`  
**UI:** `src/components/BuffettBot.tsx`  
**Backend:** `server/index.js` → `GET /stock-info/:symbol`

---

## Scoring Formula

```
overallScore = (earned / possible) × 100   [rounded, 0–100]

earned   = Σ scoreLabel(c) × c.weight   for all c where score ≠ "na"
possible = Σ 2 × c.weight               for all c where score ≠ "na"

scoreLabel: pass=2, marginal=1, fail=0
```

N/A criteria are excluded from both sides — missing data does not penalise the stock.

### Weights

| Criterion          | Weight |
|--------------------|--------|
| ROE                | 3      |
| Debt / Equity      | 3      |
| Earnings Quality   | 2      |
| Profit Margin      | 2      |
| P/E Ratio          | 2      |
| Capital Efficiency | 2      |
| Revenue Growth     | 2      |
| Current Ratio      | 1      |
| PEG Ratio          | 1      |

### Grade thresholds

| Grade | Score  |
|-------|--------|
| A+    | ≥ 85   |
| A     | ≥ 70   |
| B     | ≥ 55   |
| C     | ≥ 40   |
| D     | ≥ 25   |
| F     | < 25   |

### Verdict logic

| Verdict    | Condition                                       |
|------------|-------------------------------------------------|
| Strong Buy | score ≥ 75                                      |
| Hold       | score ≥ 55 **or** `buffettWouldConsider = true` |
| Review     | score ≥ 40                                      |
| Reduce     | score ≥ 25                                      |
| Avoid      | score < 25                                      |

`buffettWouldConsider` comes from archetype detection, not the score. A stock at 45 can still show "Hold" if it's a Wide Moat Compounder.

---

## 9 Criteria

### 1. ROE — Return on Equity
**Weight 3** | Letters 1977, 1979, 1992 | **Banking: N/A**

Buffett's primary screening metric. Wants ≥15% *without* relying on debt.  
Cross-checks D/E — high ROE from high leverage is downgraded.

| ROE      | D/E         | Score    |
|----------|-------------|----------|
| ≥ 25%    | < 150%      | pass     |
| ≥ 25%    | ≥ 150%      | marginal |
| 15–25%   | < 150%      | pass     |
| 15–25%   | ≥ 150%      | marginal |
| 10–15%   | any         | marginal |
| < 10%    | any         | fail     |

---

### 2. Earnings Quality — DuPont Decomposition
**Weight 2** | Letters 1989, 2010 | **Banking: N/A**

`ROE = Net Margin × Asset Turnover × Leverage`  
Buffett only values ROE from the first two factors. Leverage-inflated ROE is a trap.

| ROE    | D/E      | Score    | Why                             |
|--------|----------|----------|---------------------------------|
| ≥ 15%  | < 50%    | pass     | Genuine — earned without debt   |
| ≥ 15%  | 50–120%  | pass     | Mostly genuine                  |
| ≥ 15%  | ≥ 120%   | fail     | DuPont trap — debt-driven       |
| < 10%  | < 40%    | marginal | Underperforming but not risky   |
| other  | other    | marginal |                                 |

---

### 3. Profit Margin — Moat Proxy
**Weight 2** | Letters 1983, 1991 | **Banking: N/A**

Wide margins = pricing power = durable competitive moat.  
Exception: high-turnover businesses (retail/distribution) can score pass at 6–12% if ROE ≥ 15%.

| Margin  | Context             | Score    |
|---------|---------------------|----------|
| ≥ 20%   | any                 | pass     |
| 12–20%  | any                 | pass     |
| 6–12%   | ROE ≥ 15%           | pass     |
| 6–12%   | ROE < 15% or null   | marginal |
| < 6%    | any                 | fail     |

---

### 4. Debt / Equity
**Weight 3** | Letters 1989, 2010 | **Banking: N/A**

"Only when the tide goes out do you discover who's been swimming naked."  
Debt-heavy businesses drown in downturns.

| D/E      | Score    |
|----------|----------|
| ≤ 20%    | pass     |
| 20–80%   | pass     |
| 80–150%  | marginal |
| > 150%   | fail     |

---

### 5. P/E Ratio — Valuation with Growth Context
**Weight 2** | Letters 1989, 1992, 2000

P/E is meaningless without growth context.  
P/E 28 for a 20%-grower is cheaper than P/E 15 for a 0%-grower.  
Cross-checks `revenueGrowth`.

| P/E     | Revenue Growth | Score    |
|---------|----------------|----------|
| ≤ 12    | any            | pass     |
| 12–20   | any            | pass     |
| 20–30   | ≥ 15%          | pass     |
| 20–30   | < 15%          | marginal |
| 30–50   | ≥ 25%          | marginal |
| 30–50   | < 25%          | fail     |
| > 50    | any            | fail     |
| ≤ 0     | —              | fail     |

---

### 6. Capital Efficiency — P/B Adjusted by ROE
**Weight 2**

Pure P/B is misleading. Buffett's real lens:  
`Fair P/B = ROE% ÷ 12`  (12% = assumed required return)  
`ratio = fairPB ÷ actualPB`

A stock at P/B 4× with ROE 35% has fair P/B = 2.9× → ratio 0.73 → marginal.  
A stock at P/B 1.5× with ROE 8% has fair P/B = 0.67× → ratio 0.45 → fail.  
This is why Buffett paid high nominal P/B for See's Candies.

| ratio     | Score    |
|-----------|----------|
| ≥ 1.5     | pass     |
| 0.85–1.5  | pass     |
| 0.6–0.85  | marginal |
| < 0.6     | fail     |

*If ROE is null: fall back to raw P/B (≤ 1.5 pass, ≤ 3 pass, ≤ 6 marginal, > 6 fail).*

---

### 7. Current Ratio — Staying Power
**Weight 1** | **Banking: N/A**

"I don't want a business that needs my help to survive."

| Ratio   | Score    |
|---------|----------|
| ≥ 2.5   | pass     |
| 1.5–2.5 | pass     |
| 1.0–1.5 | marginal |
| < 1.0   | fail     |

---

### 8. Revenue Growth — Compounding Engine
**Weight 2**

"Time is the friend of the wonderful business, the enemy of the mediocre."  
Growing revenue = expanding economic footprint.

| Growth  | Score    |
|---------|----------|
| ≥ 20%   | pass     |
| 10–20%  | pass     |
| 3–10%   | marginal |
| 0–3%    | marginal |
| < 0%    | fail     |

Fast growth + thin margins (PM < 5%) adds a warning note but does not change the score.

---

### 9. PEG Ratio — Growth at Fair Price
**Weight 1** | Charlie Munger's influence on Buffett

| PEG      | Score    |
|----------|----------|
| ≤ 0.75   | pass     |
| 0.75–1.2 | pass     |
| 1.2–2.0  | marginal |
| > 2.0    | fail     |
| ≤ 0      | na       |

---

## Archetype Detection

Checked in order — first match wins. Drives `buffettWouldConsider` and the verdict override.

| # | Archetype               | Condition                                                        | Consider |
|---|-------------------------|------------------------------------------------------------------|----------|
| 1 | Wide Moat Compounder    | ROE ≥ 18% AND D/E < 100% AND PM ≥ 12% AND revenue growth ≥ 8%  | ✓        |
| 2 | Leveraged ROE Trap      | ROE ≥ 15% AND D/E ≥ 200%                                        | ✗        |
| 3 | Deep Value Play         | P/E < 12 AND P/B < 1.5 AND D/E < 80%                            | ✓        |
| 4 | Growth at Fair Price    | PEG < 1.3 AND ROE ≥ 15% AND D/E < 120%                          | ✓        |
| 5 | Dividend Compounder     | dividendYield ≥ 2.5% AND D/E < 80% AND PM ≥ 8%                  | ✓        |
| 6 | Turnaround Candidate    | P/E < 15 AND D/E < 60% AND ROE < 12% AND PM > 0%                | ✗        |
| 7 | Capital Destroyer       | ROE < 8% AND D/E > 120%                                          | ✗        |
| 8 | Insufficient Data       | naCount ≥ 6 or no pattern matched                                | ✗        |

---

## Banking Sector

Detected when sector string contains: `financ`, `bank`, or `insur`.

**N/A for banks:** Profit Margin, Debt/Equity, Current Ratio, Earnings Quality  
**Still scored:** ROE, P/E, Capital Efficiency, Revenue Growth, PEG

---

## Data Quality

| Label   | N/A count |
|---------|-----------|
| rich    | ≤ 2       |
| partial | 3–5       |
| sparse  | ≥ 6       |

---

## Symbol Resolution

1. `stockCodes[symbol.toUpperCase()] ?? symbol` — maps portfolio names to Yahoo tickers (`src/constants/stockCodes.ts`)
2. Backend tries `.NS` (NSE) then `.BO` (BSE)
3. Result symbol is overwritten back to portfolio name so UI always shows the original

## Backend Auth

- Cookie: `GET https://fc.yahoo.com` (lightweight — no header overflow)
- Crumb: `GET https://query1.finance.yahoo.com/v1/test/getcrumb` with that cookie
- Endpoint: `https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=...&crumb=...`
- **Confirmed:** `query1 + v10 + crumb` works. `query2 + v11` returns 404 regardless of crumb.
- Crumb cached 1 hour in memory. On 401 response, cache is invalidated and retried once.
- `httpsGet` uses `https.request` with `maxHeaderSize: 32768` to avoid Node's default 8KB header limit.
