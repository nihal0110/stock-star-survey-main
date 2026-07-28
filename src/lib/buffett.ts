/**
 * Warren Buffett investment principles scoring engine — deep edition.
 *
 * Principles sourced from Berkshire Hathaway shareholder letters (1977–2023),
 * The Essays of Warren Buffett (Cunningham), Poor Charlie's Almanack,
 * and documented Berkshire investment decisions.
 *
 * Key philosophy upgrade over simple threshold checks:
 * — P/B must be read against ROE, not in isolation (DuPont insight)
 * — P/E must be read against growth rate (PEG-aware)
 * — High ROE from high debt is a trap, not a virtue (earnings quality)
 * — A wonderful business at a fair price beats a fair business at a bargain
 * — Cross-metric synthesis reveals moat strength no single metric captures
 */

export interface StockFundamentals {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  currentPrice: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  pegRatio: number | null;
  roe: number | null;           // decimal, e.g. 0.18 = 18%
  profitMargin: number | null;  // decimal (net margin)
  grossMargin: number | null;   // decimal
  operatingMargin: number | null; // decimal
  debtToEquity: number | null;
  currentRatio: number | null;
  revenueGrowth: number | null;  // decimal, YoY
  earningsGrowth: number | null; // decimal, quarterly YoY — more available for Indian stocks
  dividendYield: number | null;
  eps: number | null;
  beta: number | null;
  operatingCashflow: number | null; // absolute INR
  freeCashflow: number | null;      // absolute INR
  totalRevenue: number | null;      // absolute INR
  returnOnAssets: number | null;    // decimal
}

export type CriterionScore = "pass" | "marginal" | "fail" | "na";
export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";
export type Verdict = "Strong Buy" | "Hold" | "Review" | "Reduce" | "Avoid";

/**
 * Business archetype — tells you *why* the score is what it is.
 * Buffett would chase some archetypes even at mediocre scores.
 */
export type BuffettArchetype =
  | "Wide Moat Compounder"   // High ROE + low debt + strong margins + growth — Buffett's favourite
  | "Deep Value Play"        // Low P/E + low P/B + low debt — Graham-style, Buffett's roots
  | "Dividend Compounder"    // Consistent dividends + stable margins — Buffett loves predictability
  | "Growth at Fair Price"   // PEG < 1.5, strong ROE — Charlie Munger influence
  | "Quality Compounder"     // Solid ROE + margins, not wide-moat-tier but above average
  | "Steady Earner"          // Profitable + low debt, moderate returns
  | "Leveraged ROE Trap"     // High ROE but debt-inflated — financial engineering, not real moat
  | "Turnaround Candidate"   // Depressed metrics but low debt + brand signal — worth watching
  | "Capital Destroyer"      // Low ROE + high debt + poor margins — avoid
  | "High Debt Business"     // Excessive leverage regardless of earnings
  | "Mixed Profile"          // Data available but no clear pattern
  | "Insufficient Data";     // Too many N/A fields to judge

export interface Criterion {
  id: string;
  name: string;
  buffettPrinciple: string;
  value: string;
  benchmark: string;
  score: CriterionScore;
  weight: number; // 1–3
  insight: string;
}

export interface BuffettAnalysis {
  symbol: string;
  name: string | null;
  sector: string | null;
  overallScore: number;       // 0–100
  grade: Grade;
  verdict: Verdict;
  archetype: BuffettArchetype;
  archetypeReason: string;
  criteria: Criterion[];
  topStrength: string | null;
  topConcern: string | null;
  dataQuality: "rich" | "partial" | "sparse";
  buffettWouldConsider: boolean; // true even at lower scores if archetype is compelling
  buffettNote: string;           // one-line narrative Buffett might say about this stock
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export function isBank(sector: string | null): boolean {
  if (!sector) return false;
  const s = sector.toLowerCase();
  return s.includes("financ") || s.includes("bank") || s.includes("insur");
}

function scoreLabel(s: CriterionScore) {
  return s === "pass" ? 2 : s === "marginal" ? 1 : 0;
}

function grade(score: number): Grade {
  if (score >= 85) return "A+";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  if (score >= 25) return "D";
  return "F";
}

function verdict(score: number, wouldConsider: boolean): Verdict {
  if (score >= 75) return "Strong Buy";
  if (score >= 55 || wouldConsider) return "Hold";
  if (score >= 40) return "Review";
  if (score >= 25) return "Reduce";
  return "Avoid";
}

// ─── individual criteria ──────────────────────────────────────────────────────

/**
 * ROE — Buffett's #1 screening metric.
 * "We look for businesses that earn high returns on equity capital
 *  without undue reliance on debt." — Letters 1977, 1979, 1992.
 */
function evalROE(f: StockFundamentals): Criterion {
  const roe = f.roe !== null ? f.roe * 100 : null;
  const de = f.debtToEquity;
  let score: CriterionScore = "na";
  let insight = "ROE data unavailable.";

  if (roe !== null) {
    // Context: if debt is high, high ROE may be a leverage illusion
    const leveraged = de !== null && de > 150;

    if (roe >= 25) {
      score = leveraged ? "marginal" : "pass";
      insight = leveraged
        ? `${roe.toFixed(1)}% ROE looks impressive but D/E is ${de?.toFixed(0)}% — check if this is genuine efficiency or leverage-amplified. Buffett wants ROE earned without borrowing.`
        : `${roe.toFixed(1)}% ROE — Exceptional, Buffett-grade capital allocation. Management is compounding shareholder equity at a superior rate.`;
    } else if (roe >= 15) {
      score = leveraged ? "marginal" : "pass";
      insight = leveraged
        ? `${roe.toFixed(1)}% ROE meets the threshold but high leverage (D/E ${de?.toFixed(0)}%) reduces confidence. Buffett: "Leverage just moves around who's going to get hurt."`
        : `${roe.toFixed(1)}% ROE — Meets Buffett's preferred minimum. Business consistently rewards shareholders without resorting to excessive borrowing.`;
    } else if (roe >= 10) {
      score = "marginal";
      insight = `${roe.toFixed(1)}% ROE — Below Buffett's 15% floor. Adequate but not exceptional. Buffett would want to see this improve or a compelling moat story to compensate.`;
    } else {
      score = "fail";
      insight = `${roe.toFixed(1)}% ROE — Poor capital efficiency. Buffett avoids businesses that can't earn a decent return on the equity entrusted to them.`;
    }
  }

  return {
    id: "roe", name: "Return on Equity",
    buffettPrinciple: "Seek businesses earning >15% ROE on book value without relying on leverage",
    value: roe !== null ? `${roe.toFixed(1)}%` : "N/A",
    benchmark: "> 15% (ungeared)",
    score, weight: 3, insight,
  };
}

/**
 * Earnings Quality — DuPont decomposition.
 * ROE = Net Margin × Asset Turnover × Financial Leverage.
 * Buffett only values ROE driven by the first two, NOT the third.
 * "I've seen more people fail because of liquor and leverage." — Buffett.
 */
function evalEarningsQuality(f: StockFundamentals): Criterion {
  const roe = f.roe !== null ? f.roe * 100 : null;
  const de = f.debtToEquity;
  const pm = f.profitMargin !== null ? f.profitMargin * 100 : null;
  const bank = isBank(f.sector);

  if (roe === null && de === null) {
    return {
      id: "quality", name: "Earnings Quality",
      buffettPrinciple: "ROE must come from business excellence, not financial engineering",
      value: "N/A", benchmark: "ROE ungeared by leverage",
      score: "na", weight: 2,
      insight: "Insufficient data to evaluate earnings quality.",
    };
  }

  let score: CriterionScore = "na";
  let insight = "";

  if (bank) {
    return {
      id: "quality", name: "Earnings Quality",
      buffettPrinciple: "ROE must come from business excellence, not financial engineering",
      value: "N/A", benchmark: "N/A (Banking)",
      score: "na", weight: 2,
      insight: "Banks use leverage structurally; earnings quality is measured by NPA ratios and tier-1 capital adequacy instead.",
    };
  }

  if (roe !== null && de !== null) {
    if (roe >= 15 && de < 50) {
      score = "pass";
      insight = `ROE ${roe.toFixed(1)}% achieved with minimal debt (D/E ${de.toFixed(0)}%) — this is genuine business excellence. Buffett's favourite kind: a company that earns extraordinary returns because it has real competitive advantages, not because it borrowed heavily.`;
    } else if (roe >= 15 && de < 120) {
      score = "pass";
      insight = `ROE ${roe.toFixed(1)}% with moderate leverage (D/E ${de.toFixed(0)}%). Mostly genuine — the business earns well, though some is leverage-assisted. Monitor debt trend over time.`;
    } else if (roe >= 15 && de >= 120) {
      score = "fail";
      insight = `ROE ${roe.toFixed(1)}% but D/E is ${de.toFixed(0)}% — a classic DuPont trap. High leverage amplifies ROE mechanically without improving the underlying business. Buffett explicitly avoids this pattern.`;
    } else if (roe !== null && roe < 10 && de !== null && de < 40) {
      score = "marginal";
      insight = `Low ROE (${roe.toFixed(1)}%) but little debt — the business is underperforming, not over-leveraged. A turnaround here could unlock real value. Worth monitoring.`;
    } else {
      score = "marginal";
      insight = `ROE ${roe?.toFixed(1) ?? "?"}% with D/E ${de?.toFixed(0) ?? "?"}% — mixed signals. Buffett would want to understand which drives earnings: genuine pricing power or financial structure.`;
    }
  } else if (roe !== null) {
    score = roe >= 15 ? "pass" : roe >= 10 ? "marginal" : "fail";
    insight = `ROE ${roe.toFixed(1)}%. Debt data unavailable — cannot confirm whether returns are leverage-driven.`;
  }

  return {
    id: "quality", name: "Earnings Quality",
    buffettPrinciple: "ROE must come from business excellence, not financial engineering",
    value: roe !== null ? `ROE ${roe.toFixed(1)}% / D/E ${de?.toFixed(0) ?? "?"}%` : "N/A",
    benchmark: "High ROE with low debt",
    score, weight: 2, insight,
  };
}

/**
 * Profit Margin — Economic Moat Proxy.
 * Buffett's "economic castle with a moat" — wide margins signal pricing power.
 * A company that can charge more than competitors has a durable competitive advantage.
 * Letters 1983, 1991; moat concept pervasive throughout.
 */
function evalProfitMargin(f: StockFundamentals): Criterion {
  const pm = f.profitMargin !== null ? f.profitMargin * 100 : null;
  const roe = f.roe !== null ? f.roe * 100 : null;
  const bank = isBank(f.sector);
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (bank) {
    return {
      id: "margin", name: "Profit Margin",
      buffettPrinciple: "Wide margins = pricing power = durable moat",
      value: pm !== null ? `${pm.toFixed(1)}%` : "N/A",
      benchmark: "N/A (Banking — NIM applies)",
      score: "na", weight: 2,
      insight: "Banks are assessed on Net Interest Margin and return on assets, not net profit margin.",
    };
  }

  if (pm !== null) {
    // High ROE with thin margins means high asset turnover (retail model) — still valid
    const highTurnoverBusiness = roe !== null && roe >= 15 && pm < 10;

    if (pm >= 20) {
      score = "pass";
      insight = `${pm.toFixed(1)}% net margin — Wide moat confirmed. This company has extraordinary pricing power. Buffett: "The single most important decision in evaluating a business is pricing power."`;
    } else if (pm >= 12) {
      score = "pass";
      insight = `${pm.toFixed(1)}% net margin — Solid. Business retains a healthy share of each rupee earned, signalling real competitive protection.`;
    } else if (pm >= 6) {
      score = highTurnoverBusiness ? "pass" : "marginal";
      insight = highTurnoverBusiness
        ? `${pm.toFixed(1)}% net margin, but ROE ${roe?.toFixed(1)}% — this looks like a high-turnover business (like retail/distribution). Low margin + high asset turnover can still compound well. Buffett owned such businesses (e.g., Walmart-style).`
        : `${pm.toFixed(1)}% net margin — Thin. Vulnerable to cost inflation or a more aggressive competitor. Buffett prefers businesses where pricing power keeps margins fat.`;
    } else {
      score = "fail";
      insight = `${pm.toFixed(1)}% net margin — Razor thin. Difficult to build durable value when nearly all revenue is consumed by costs. Buffett: "A good business is not one that is difficult to run, it's one that doesn't need to be run well to make money."`;
    }
  }

  return {
    id: "margin", name: "Profit Margin",
    buffettPrinciple: "Pricing power is the single most important factor in evaluating a business",
    value: pm !== null ? `${pm.toFixed(1)}%` : "N/A",
    benchmark: "> 12% (or > 6% for high-turnover)",
    score, weight: 2, insight,
  };
}

/**
 * Debt-to-Equity — Survival in Bad Times.
 * Buffett letters 1989, 2010: "Only when the tide goes out do you discover
 * who's been swimming naked." Debt-heavy businesses drown in downturns.
 */
function evalDebt(f: StockFundamentals): Criterion {
  const de = f.debtToEquity;
  const bank = isBank(f.sector);
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (bank) {
    return {
      id: "debt", name: "Debt / Equity",
      buffettPrinciple: "Avoid businesses that can't survive a rainy day",
      value: de !== null ? `${de.toFixed(0)}%` : "N/A",
      benchmark: "N/A (Banking — leverage is structural)",
      score: "na", weight: 2,
      insight: "Banks are structurally leveraged. Evaluate using NPA ratio, CASA ratio, and Tier-1 Capital Adequacy instead.",
    };
  }

  if (de !== null) {
    if (de <= 20) {
      score = "pass";
      insight = `D/E ${de.toFixed(0)}% — Near debt-free. This business finances itself from operations. Buffett's ideal: "The best business is one that has no need for capital."`;
    } else if (de <= 80) {
      score = "pass";
      insight = `D/E ${de.toFixed(0)}% — Conservative. Manageable debt that won't threaten operations during a downturn. Gives management flexibility to act opportunistically.`;
    } else if (de <= 150) {
      score = "marginal";
      insight = `D/E ${de.toFixed(0)}% — Moderate leverage. Watch interest coverage. Rising rates or a revenue dip could make this a problem. Buffett prefers businesses that don't need to refinance.`;
    } else {
      score = "fail";
      insight = `D/E ${de.toFixed(0)}% — Heavy debt load. Buffett: "Leverage is addictive. Once a company gets used to the benefits, it's very hard to give them up — and the downside is bankruptcy."`;
    }
  }

  return {
    id: "debt", name: "Debt / Equity",
    buffettPrinciple: "Avoid businesses dependent on borrowed money to survive",
    value: de !== null ? `${de.toFixed(0)}%` : "N/A",
    benchmark: "< 80%",
    score, weight: 3, insight,
  };
}

/**
 * P/E — Valuation with Growth Context.
 * Buffett evolved from Graham's pure "cheap" buying to paying fair prices for
 * great businesses. "It's far better to buy a wonderful company at a fair price
 * than a fair company at a wonderful price." — 1989 Letter.
 *
 * Key insight: P/E must be read against growth. P/E 30 for a 25%-grower is
 * cheaper than P/E 12 for a 0%-grower. We cross-check with PEG here.
 */
function evalPE(f: StockFundamentals): Criterion {
  const pe = f.trailingPE;
  const rg = f.revenueGrowth !== null ? f.revenueGrowth * 100 : null;
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (pe !== null && pe > 0) {
    const earningsYield = (1 / pe) * 100; // compare to ~7% long-term equity return expectation

    if (pe <= 12) {
      score = "pass";
      insight = `P/E ${pe.toFixed(1)}× — Deep value territory. Earnings yield ${earningsYield.toFixed(1)}% is compelling. Graham would be delighted; Buffett wouldn't argue.`;
    } else if (pe <= 20) {
      score = "pass";
      insight = `P/E ${pe.toFixed(1)}× — Fair valuation. Earnings yield ${earningsYield.toFixed(1)}% still attractive. Buffett regularly pays this for quality compounders.`;
    } else if (pe <= 30) {
      // Growth context matters here
      if (rg !== null && rg >= 15) {
        score = "pass";
        insight = `P/E ${pe.toFixed(1)}× with ${rg.toFixed(1)}% revenue growth — premium is justified. A fast-growing business at P/E 30 can be cheaper than a stagnant one at P/E 15. Buffett paid similar multiples for Coca-Cola and American Express.`;
      } else {
        score = "marginal";
        insight = `P/E ${pe.toFixed(1)}× — Paying a premium. Requires consistently strong earnings growth to justify. Without visible growth catalysts, margin of safety is thin.`;
      }
    } else if (pe <= 50) {
      if (rg !== null && rg >= 25) {
        score = "marginal";
        insight = `P/E ${pe.toFixed(1)}× — Expensive, but ${rg.toFixed(1)}% growth rate partially justifies it. High expectations are already priced in; any earnings miss would be painful.`;
      } else {
        score = "fail";
        insight = `P/E ${pe.toFixed(1)}× — Dangerously expensive without commensurate growth. Buffett: "Price is what you pay, value is what you get. Don't confuse the two."`;
      }
    } else {
      score = "fail";
      insight = `P/E ${pe.toFixed(1)}× — The market is pricing in perfection. Buffett has almost never bought at these multiples; he'd rather hold cash and wait.`;
    }
  } else if (pe !== null && pe <= 0) {
    score = "fail";
    insight = "Negative earnings — loss-making business. Buffett almost never buys companies that aren't profitable, except in rare special situations.";
  }

  return {
    id: "pe", name: "P/E Ratio",
    buffettPrinciple: "Price is what you pay; value is what you get — buy wonderful businesses at fair prices",
    value: pe !== null && pe > 0 ? `${pe.toFixed(1)}×` : pe !== null ? "Negative" : "N/A",
    benchmark: "< 25× (higher OK if growth > 15%)",
    score, weight: 2, insight,
  };
}

/**
 * Capital Efficiency — P/B vs ROE (Buffett's hidden valuation lens).
 * Intrinsic P/B ≈ ROE / required return. At 12% required return:
 * — ROE 25% → fair P/B ≈ 2.1×
 * — ROE 15% → fair P/B ≈ 1.25×
 * — ROE 8%  → fair P/B ≈ 0.67× (should trade below book!)
 * A stock at P/B 4× with ROE 35% is actually undervalued relative to
 * one at P/B 1.5× with ROE 8%. Pure P/B ignores this.
 * This is why Buffett happily bought See's Candies at a huge P/B premium.
 */
function evalCapitalEfficiency(f: StockFundamentals): Criterion {
  const pb = f.priceToBook;
  const roe = f.roe !== null ? f.roe * 100 : null;
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (pb !== null && pb > 0 && roe !== null) {
    const requiredReturn = 12; // 12% = reasonable long-run equity expectation
    const fairPB = roe / requiredReturn;
    const ratio = fairPB / pb; // > 1 = undervalued on capital efficiency basis

    if (ratio >= 1.5) {
      score = "pass";
      insight = `P/B ${pb.toFixed(2)}× vs fair P/B ${fairPB.toFixed(2)}× (ROE ${roe.toFixed(1)}% ÷ 12%) — you're buying this capital at a ${((ratio - 1) * 100).toFixed(0)}% discount to what the ROE justifies. This is exactly how Buffett justified buying See's Candies at a high nominal P/B.`;
    } else if (ratio >= 0.85) {
      score = "pass";
      insight = `P/B ${pb.toFixed(2)}× is roughly in line with what ROE ${roe.toFixed(1)}% justifies (fair P/B ~${fairPB.toFixed(2)}×). You're paying a fair price for the capital efficiency on offer.`;
    } else if (ratio >= 0.6) {
      score = "marginal";
      insight = `P/B ${pb.toFixed(2)}× looks rich relative to ROE ${roe.toFixed(1)}% (fair P/B ~${fairPB.toFixed(2)}×). You're paying a ${((1 - ratio) * 100).toFixed(0)}% premium over what capital efficiency alone justifies. Needs a strong moat narrative to hold up.`;
    } else {
      score = "fail";
      insight = `P/B ${pb.toFixed(2)}× is well above what ROE ${roe.toFixed(1)}% justifies (fair P/B ~${fairPB.toFixed(2)}×). Significant capital efficiency premium — the market expects future ROE to improve substantially.`;
    }
  } else if (pb !== null && pb > 0) {
    // No ROE — fall back to raw P/B
    if (pb <= 1.5) { score = "pass"; insight = `P/B ${pb.toFixed(2)}× — Trading near book. Without ROE data, raw P/B is low enough to be comfortable.`; }
    else if (pb <= 3) { score = "pass"; insight = `P/B ${pb.toFixed(2)}× — Moderate premium. Reasonable if business earns well on its equity (ROE data needed to confirm).`; }
    else if (pb <= 6) { score = "marginal"; insight = `P/B ${pb.toFixed(2)}× — High. Needs strong ROE to justify. Without ROE data, hard to say if this is See's Candies or wishful thinking.`; }
    else { score = "fail"; insight = `P/B ${pb.toFixed(2)}× — Very expensive on book value. Requires exceptional and durable ROE to make sense. Risky without confirmation.`; }
  }

  return {
    id: "capital", name: "Capital Efficiency (P/B × ROE)",
    buffettPrinciple: "A high P/B is justified — even desirable — when ROE is sustainably high",
    value: pb !== null && pb > 0 ? `${pb.toFixed(2)}× P/B` : "N/A",
    benchmark: "P/B ≤ ROE ÷ 12%",
    score, weight: 2, insight,
  };
}

/**
 * Current Ratio — Staying Power.
 * Buffett: "I don't want a business that needs my help to survive."
 * Businesses that can't pay their bills in tough times aren't worth owning.
 * Skipped for banks (structural leverage makes this inapplicable).
 */
function evalCurrentRatio(f: StockFundamentals): Criterion {
  const cr = f.currentRatio;
  const bank = isBank(f.sector);
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (bank) {
    return {
      id: "current", name: "Current Ratio",
      buffettPrinciple: "Financial cushion to survive without needing rescuing",
      value: "N/A", benchmark: "N/A (Banking sector)",
      score: "na", weight: 1,
      insight: "Not applicable to banking. Evaluate through liquidity coverage ratio and deposit stability.",
    };
  }

  if (cr !== null) {
    if (cr >= 2.5) {
      score = "pass";
      insight = `Current ratio ${cr.toFixed(2)} — Strong liquidity fortress. Management has ample room to handle short-term shocks without distress. Buffett loves businesses that don't need external rescues.`;
    } else if (cr >= 1.5) {
      score = "pass";
      insight = `Current ratio ${cr.toFixed(2)} — Solid. Can comfortably meet short-term obligations with a reasonable buffer. Healthy operating rhythm.`;
    } else if (cr >= 1.0) {
      score = "marginal";
      insight = `Current ratio ${cr.toFixed(2)} — Just enough. Business operates close to the edge of its short-term obligations. Any revenue disruption could cause stress.`;
    } else {
      score = "fail";
      insight = `Current ratio ${cr.toFixed(2)} — Current liabilities exceed current assets. Business may be relying on credit lines or future receivables to stay afloat. High vulnerability.`;
    }
  }

  return {
    id: "current", name: "Current Ratio",
    buffettPrinciple: "Own businesses that don't need rescuing when times get tough",
    value: cr !== null ? cr.toFixed(2) : "N/A",
    benchmark: "> 1.5",
    score, weight: 1, insight,
  };
}

/**
 * Revenue Growth — Compounding Engine.
 * "Time is the friend of the wonderful business, the enemy of the mediocre."
 * Growing revenue means a growing economic engine; flat revenue means moat erosion.
 * But Buffett distinguishes: profitable growth compounds wealth, unprofitable growth destroys it.
 */
function evalRevenueGrowth(f: StockFundamentals): Criterion {
  // Use revenue growth; fall back to earnings growth when revenue growth is unavailable
  // (earnings growth quarter-on-quarter is more reliably populated for Indian stocks)
  const rg = f.revenueGrowth !== null ? f.revenueGrowth * 100 : null;
  const eg = f.earningsGrowth !== null ? f.earningsGrowth * 100 : null;
  const growth = rg ?? eg;
  const growthLabel = rg !== null ? "Revenue" : eg !== null ? "Earnings" : null;
  const pm = f.profitMargin !== null ? f.profitMargin * 100 : null;
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (growth !== null && growthLabel !== null) {
    const profitable = pm === null || pm >= 5;

    if (growth >= 20) {
      score = "pass";
      insight = `${growthLabel} growing ${growth.toFixed(1)}% — Powerful compounding engine. A business growing this fast is expanding its economic footprint meaningfully each year.${!profitable ? " Note: strong growth but thin margins — watch profitability carefully." : ""}`;
    } else if (growth >= 10) {
      score = "pass";
      insight = `${growthLabel} growing ${growth.toFixed(1)}% — Solid expansion. Business is widening its market position. Buffett loves businesses that reliably grow their revenue year after year.`;
    } else if (growth >= 3) {
      score = "marginal";
      insight = `${growthLabel} growing ${growth.toFixed(1)}% — Slow but positive. The business isn't shrinking but isn't compounding aggressively. May still be excellent if margins are wide and capital requirements are low.`;
    } else if (growth >= 0) {
      score = "marginal";
      insight = `${growthLabel} nearly flat (${growth.toFixed(1)}%) — The economic engine has stalled. Not fatal if the moat is strong and returns on capital are high, but worth investigating why growth has slowed.`;
    } else {
      score = "fail";
      insight = `${growthLabel} declining ${Math.abs(growth).toFixed(1)}% — A shrinking business. Buffett: "When an industry with a reputation for difficult economics meets a manager with a reputation for excellence, it's usually the industry that keeps its reputation."`;
    }
  }

  return {
    id: "growth", name: "Revenue Growth",
    buffettPrinciple: "Time is the friend of the wonderful business — look for companies that keep growing their economic engine",
    value: growth !== null && growthLabel !== null ? `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% (${growthLabel})` : "N/A",
    benchmark: "> 8%",
    score, weight: 2, insight,
  };
}

/**
 * PEG Ratio — Growth at a Reasonable Price (GARP).
 * Charlie Munger convinced Buffett to evolve from pure Graham value to
 * paying fair prices for companies with durable competitive advantages and growth.
 * PEG < 1 means you're being paid to own the growth.
 */
function evalPEG(f: StockFundamentals): Criterion {
  let peg = f.pegRatio;
  let synthetic = false;

  // Synthesise PEG when Yahoo Finance doesn't provide it (common for Indian stocks)
  // PEG = P/E ÷ growth rate (%). Use earnings growth first, then revenue growth.
  if ((peg === null || peg <= 0) && f.trailingPE !== null && f.trailingPE > 0) {
    const growthPct = f.earningsGrowth !== null ? f.earningsGrowth * 100
                    : f.revenueGrowth  !== null ? f.revenueGrowth  * 100
                    : null;
    if (growthPct !== null && growthPct > 0) {
      peg = f.trailingPE / growthPct;
      synthetic = true;
    }
  }

  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (peg !== null && peg > 0) {
    const src = synthetic ? " (computed from P/E ÷ growth rate — Yahoo Finance did not supply PEG directly)" : "";
    if (peg <= 0.75) {
      score = "pass";
      insight = `PEG ${peg.toFixed(2)}${src} — Exceptional. Growth is significantly underpriced relative to earnings. The market is giving you the growth almost for free. Charlie Munger would call this a "lollapalooza."`;
    } else if (peg <= 1.2) {
      score = "pass";
      insight = `PEG ${peg.toFixed(2)}${src} — Growth at a fair price. The earnings multiple is supported by the growth rate. Buffett's sweet spot: "A wonderful company at a fair price."`;
    } else if (peg <= 2.0) {
      score = "marginal";
      insight = `PEG ${peg.toFixed(2)}${src} — Paying a modest premium for growth. Acceptable if growth is consistent and the competitive moat is wide. Watch for execution risk.`;
    } else {
      score = "fail";
      insight = `PEG ${peg.toFixed(2)}${src} — Overpaying for growth. Market has priced in an optimistic growth scenario. Any slowdown from expectations will compress the multiple sharply.`;
    }
  } else if (peg !== null && peg <= 0) {
    score = "na";
    insight = "Negative PEG — earnings are declining. The ratio loses meaning when growth is negative.";
  }

  return {
    id: "peg", name: "PEG Ratio",
    buffettPrinciple: "Pay a fair price for a wonderful growing business — Charlie Munger's evolution of Buffett",
    value: peg !== null && peg > 0 ? `${peg.toFixed(2)}${synthetic ? "*" : ""}` : "N/A",
    benchmark: "< 1.5",
    score, weight: 1, insight,
  };
}

/**
 * Gross Margin — Pricing Power at the Core.
 * Buffett: "The single most important decision in evaluating a business is pricing power."
 * Gross margin is the purest measure — it strips out R&D, SG&A, and financing cost
 * to reveal whether the product/service itself earns premium returns.
 * Wide gross margins = competitors can't undercut you without losing money themselves.
 * Buffett paid premium valuations for See's Candies (~60% gross margin) and
 * Coca-Cola (>60%) because he knew those margins signalled irreplaceable moats.
 */
function evalGrossMargin(f: StockFundamentals): Criterion {
  const gm = f.grossMargin !== null ? f.grossMargin * 100 : null;
  const bank = isBank(f.sector);
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";

  if (bank) {
    return {
      id: "grossMargin", name: "Gross Margin",
      buffettPrinciple: "Wide gross margins reveal the strength of a business's competitive position",
      value: "N/A", benchmark: "N/A (Banking — NIM applies)",
      score: "na", weight: 2,
      insight: "Banks don't have a traditional gross margin. Evaluate through Net Interest Margin (NIM) and cost-to-income ratio instead.",
    };
  }

  if (gm !== null) {
    if (gm >= 55) {
      score = "pass";
      insight = `${gm.toFixed(1)}% gross margin — Exceptional moat. Buffett paid high multiples for See's Candies (60%+ gross margin) and Coca-Cola for exactly this reason. Competitors literally cannot match this pricing without destroying their own profitability.`;
    } else if (gm >= 35) {
      score = "pass";
      insight = `${gm.toFixed(1)}% gross margin — Strong. The business retains a meaningful share of each sale before operating costs. Real pricing power at the product level — a key Buffett signal of durable competitive advantage.`;
    } else if (gm >= 20) {
      score = "marginal";
      insight = `${gm.toFixed(1)}% gross margin — Moderate. Decent but not fortress-like. The business needs to run efficiently to convert this into acceptable net margins. Vulnerable to raw material shocks or a new low-cost entrant.`;
    } else if (gm >= 10) {
      score = "marginal";
      insight = `${gm.toFixed(1)}% gross margin — Thin. Could still work for a capital-light, high-turnover business (FMCG distribution, auto ancillaries). But there is little room for pricing error. Buffett would want very high volume certainty.`;
    } else {
      score = "fail";
      insight = `${gm.toFixed(1)}% gross margin — Razor thin. This is commodity-business territory. Buffett explicitly avoids businesses where competition is purely on price: "I don't want to play in a sport where I have to be better than everyone else every year just to survive."`;
    }
  }

  return {
    id: "grossMargin", name: "Gross Margin",
    buffettPrinciple: "Wide gross margins are the fingerprint of a genuine competitive moat",
    value: gm !== null ? `${gm.toFixed(1)}%` : "N/A",
    benchmark: "> 35%",
    score, weight: 2, insight,
  };
}

/**
 * Cash Flow Quality — Real Earnings vs. Accounting Earnings.
 * Buffett: "Earnings are an opinion. Cash is a fact."
 * Free Cash Flow (FCF) is what a business generates after maintaining and growing
 * its assets — the cash that could be returned to owners, reinvested, or used for
 * acquisitions. A company with high net income but low/negative FCF is either
 * growing (capex-heavy) or managing its books. Buffett focusses on owner earnings.
 *
 * We compute FCF Margin = FCF / Revenue, or fall back to Operating CF Margin
 * when FCF is unavailable. Negative FCF in a high-growth business may be fine;
 * negative FCF in a slow-growth business is a red flag.
 */
function evalCashFlowQuality(f: StockFundamentals): Criterion {
  const bank = isBank(f.sector);
  const fcf = f.freeCashflow;
  const ocf = f.operatingCashflow;
  const rev = f.totalRevenue;
  let score: CriterionScore = "na";
  let insight = "Data unavailable.";
  let displayValue = "N/A";

  if (bank) {
    return {
      id: "cashflow", name: "Cash Flow Quality",
      buffettPrinciple: "Earnings are an opinion — cash flow is fact",
      value: "N/A", benchmark: "N/A (Banking)",
      score: "na", weight: 2,
      insight: "Banks generate returns through spread, not traditional cash flow cycles. Evaluate through ROA and loan book quality instead.",
    };
  }

  // Prefer FCF margin; fall back to OCF margin
  const cashflow = fcf ?? ocf;
  const cfLabel = fcf !== null ? "FCF" : ocf !== null ? "Operating CF" : null;

  if (cashflow !== null && rev !== null && rev > 0) {
    const margin = (cashflow / rev) * 100;
    displayValue = `${cfLabel} margin ${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%`;
    const rg = f.revenueGrowth !== null ? f.revenueGrowth * 100 : f.earningsGrowth !== null ? f.earningsGrowth * 100 : null;
    const highGrowth = rg !== null && rg >= 20; // high-growth businesses legitimately burn cash

    if (margin >= 15) {
      score = "pass";
      insight = `${cfLabel} margin ${margin.toFixed(1)}% — Exceptional cash generation. The business converts a large share of revenue directly into owner cash. This is what Buffett calls "owner earnings" — the real number behind the accounting profit.`;
    } else if (margin >= 8) {
      score = "pass";
      insight = `${cfLabel} margin ${margin.toFixed(1)}% — Healthy. The business is a genuine cash machine. Reported earnings appear to be backed by real cash flows — low risk of accounting-inflated profits.`;
    } else if (margin >= 3) {
      score = "marginal";
      insight = `${cfLabel} margin ${margin.toFixed(1)}% — Modest. Cash generation is real but not exceptional. Buffett would want to understand whether this is structural (working capital intensity) or a sign of hidden capex needs.`;
    } else if (margin >= 0) {
      score = highGrowth ? "marginal" : "marginal";
      insight = `${cfLabel} margin nearly breakeven (${margin.toFixed(1)}%). ${highGrowth ? "For a fast-growing business this may be acceptable — growth companies invest heavily in capex and working capital. Monitor whether cash generation improves as growth moderates." : "Low but positive. Investigate whether capex is unusually high this period or if this reflects persistent working capital strain."}`;
    } else {
      score = highGrowth ? "marginal" : "fail";
      const negCfMature = 'Negative free cash flow in a mature/slow-growth business is a serious red flag. The company may be surviving on debt or asset sales rather than genuine business operations. Buffett: "I don\'t want a business that needs my constant financial help."';
      const negCfGrowth = 'High-growth company burning cash to fund expansion — acceptable if the runway is clear and debt is low. Watch whether FCF turns positive as scale builds.';
      insight = `${cfLabel} negative (${margin.toFixed(1)}%). ${highGrowth ? negCfGrowth : negCfMature}`;
    }
  } else if (cashflow !== null) {
    // Have cash flow but no revenue to compute margin — show directional signal
    displayValue = cfLabel + (cashflow >= 0 ? " positive" : " negative");
    score = cashflow >= 0 ? "marginal" : "fail";
    insight = cashflow >= 0
      ? `${cfLabel} is positive (₹${(cashflow / 1e7).toFixed(0)}Cr) — business generates real cash, though revenue data unavailable to compute margin.`
      : `${cfLabel} is negative — business is consuming more cash than it generates from operations. Requires investigation.`;
  }

  return {
    id: "cashflow", name: "Cash Flow Quality",
    buffettPrinciple: "Owner earnings — the cash a business truly generates for its owners — matter more than reported net income",
    value: displayValue,
    benchmark: "FCF margin > 8%",
    score, weight: 2, insight,
  };
}

// ─── archetype detection ──────────────────────────────────────────────────────

function detectArchetype(
  f: StockFundamentals,
  criteria: Criterion[],
): { archetype: BuffettArchetype; reason: string; wouldConsider: boolean; note: string } {

  const roe = f.roe !== null ? f.roe * 100 : null;
  const de = f.debtToEquity;
  const pm = f.profitMargin !== null ? f.profitMargin * 100 : null;
  const pe = f.trailingPE;
  const pb = f.priceToBook;
  const rg = f.revenueGrowth !== null ? f.revenueGrowth * 100
           : f.earningsGrowth !== null ? f.earningsGrowth * 100 : null;
  const peg = f.pegRatio;
  const dy = f.dividendYield !== null ? f.dividendYield * 100 : null;
  const gm = f.grossMargin !== null ? f.grossMargin * 100 : null;

  // Separate intentional sector N/As (banks) from genuinely missing data
  // Bank criteria are excluded by design, not because data is missing
  const sectorNAs = criteria.filter(c => c.score === "na" && c.benchmark.startsWith("N/A (Bank")).length;
  const dataNAs   = criteria.filter(c => c.score === "na").length - sectorNAs;
  // Insufficient data only when actual data is missing (not just bank exclusions)
  if (dataNAs >= 6) {
    return {
      archetype: "Insufficient Data",
      reason: "Too many metrics unavailable from Yahoo Finance to classify this business. This is typically an OTC/unlisted stock or one with very limited reporting.",
      wouldConsider: false,
      note: "Insufficient data to form a Buffett-style opinion. Try searching for the NSE/BSE ticker symbol directly.",
    };
  }

  // Wide Moat Compounder — the ideal Buffett stock
  // Gross margin OR net margin can qualify (gross margin more reliable for Indian stocks)
  const marginOk = (pm !== null && pm >= 12) || (gm !== null && gm >= 35);
  if (roe !== null && roe >= 18 && (de === null || de < 100) && marginOk && rg !== null && rg >= 8) {
    const marginStr = gm !== null ? `gross margin ${gm.toFixed(0)}%` : `net margin ${pm?.toFixed(0)}%`;
    return {
      archetype: "Wide Moat Compounder",
      reason: `High ROE (${roe.toFixed(0)}%) + strong ${marginStr} + growing (${rg.toFixed(0)}%) + manageable debt — the hallmarks of a durable competitive moat.`,
      wouldConsider: true,
      note: `"This is exactly the kind of business I want to own forever — high returns on capital, a real moat, and a growing economic engine." — Buffett-style.`,
    };
  }

  // Leveraged ROE Trap — Buffett's explicit warning
  if (roe !== null && roe >= 15 && de !== null && de >= 200) {
    return {
      archetype: "Leveraged ROE Trap",
      reason: `ROE ${roe.toFixed(0)}% is impressive on paper but D/E ${de.toFixed(0)}% reveals it's largely borrowed money doing the work, not genuine business excellence.`,
      wouldConsider: false,
      note: `"High debt amplifies ROE the same way it amplifies losses. I don't want to own a business whose prosperity depends on a banker's mood." — Buffett-style.`,
    };
  }

  // Deep Value Play — Graham-style, Buffett's early style still applicable
  if ((pe !== null && pe < 12) && (pb !== null && pb < 1.5) && (de === null || de < 80)) {
    return {
      archetype: "Deep Value Play",
      reason: `Low P/E (${pe?.toFixed(1)}×), low P/B (${pb?.toFixed(2)}×), and conservative debt — classic Graham-style undervaluation. Buffett bought this way for his first 15 years.`,
      wouldConsider: true,
      note: `"Even now, I'd look hard at this. When a sound business trades near book value at a low earnings multiple, that's the market handing you a margin of safety." — Buffett-style.`,
    };
  }

  // Growth at Fair Price — Munger influence
  if (peg !== null && peg < 1.3 && roe !== null && roe >= 15 && (de === null || de < 120)) {
    return {
      archetype: "Growth at Fair Price",
      reason: `PEG ${peg.toFixed(2)} with ROE ${roe.toFixed(0)}% — Charlie Munger's "wonderful company at a fair price" in action. Growth is not yet fully priced in.`,
      wouldConsider: true,
      note: `"Charlie taught me that it's far better to pay a fair price for a wonderful business than a bargain price for a mediocre one. This fits the bill." — Buffett-style.`,
    };
  }

  // Dividend Compounder
  if (dy !== null && dy >= 2.5 && (de === null || de < 80) && pm !== null && pm >= 8) {
    return {
      archetype: "Dividend Compounder",
      reason: `Dividend yield ${dy.toFixed(1)}% + solid margins + conservative debt — predictable, cash-generative business. Buffett loved dividend-payers like Coca-Cola and Washington Post.`,
      wouldConsider: true,
      note: `"I love businesses that send me a cheque every year, growing bigger over time, without asking for much capital back." — Buffett-style.`,
    };
  }

  // Quality Compounder — solid but not exceptional moat
  if (roe !== null && roe >= 15 && (de === null || de < 100) && (pm !== null && pm >= 8)) {
    return {
      archetype: "Quality Compounder",
      reason: `ROE ${roe.toFixed(0)}% and margin ${pm?.toFixed(0)}% show a profitable, well-run business. Not quite Wide Moat territory but clearly above average quality.`,
      wouldConsider: true,
      note: `"A business earning 15%+ on equity without excessive debt is doing something right. I'd want to understand the moat before committing." — Buffett-style.`,
    };
  }

  // Steady Earner — moderate quality, low debt
  if ((de === null || de < 80) && (pm !== null && pm >= 5) && (roe === null || roe >= 10)) {
    return {
      archetype: "Steady Earner",
      reason: `Profitable business with controlled debt. Not exceptional, but financially sound — the kind of company that can survive downturns and grow steadily.`,
      wouldConsider: false,
      note: `"Mediocre businesses can still be decent investments at the right price. But I'd rather own a wonderful business at a fair price." — Buffett-style.`,
    };
  }

  // Turnaround Candidate — beaten down but fundamentals not broken
  if ((pe === null || pe < 15) && (de === null || de < 60) && (roe === null || roe < 12) && (pm === null || pm > 0)) {
    return {
      archetype: "Turnaround Candidate",
      reason: "Depressed valuation and low ROE but debt is controlled and the business is still profitable — could recover if management improves capital allocation.",
      wouldConsider: false,
      note: `"Turnarounds seldom turn. But when a good business is temporarily depressed and management owns a lot of stock, I'll take a second look." — Buffett-style.`,
    };
  }

  // Capital Destroyer
  if (roe !== null && roe < 8 && de !== null && de > 120) {
    return {
      archetype: "Capital Destroyer",
      reason: `Low ROE (${roe.toFixed(0)}%) combined with high leverage (D/E ${de.toFixed(0)}%) — the business is not earning its cost of capital while simultaneously carrying significant debt risk.`,
      wouldConsider: false,
      note: `"This is a business that destroys value with every passing year. Cheap price doesn't help if the underlying economics keep deteriorating." — Buffett-style.`,
    };
  }

  // High Debt Business — financially risky regardless of earnings
  if (de !== null && de > 150) {
    return {
      archetype: "High Debt Business",
      reason: `D/E ratio of ${de.toFixed(0)}% represents significant financial leverage. Even if current earnings look acceptable, debt amplifies risk in downturns.`,
      wouldConsider: false,
      note: `"I've never borrowed money to buy stocks and I'm cautious about businesses that do the equivalent. Debt is the enemy of staying power." — Buffett-style.`,
    };
  }

  // Mixed Profile — data available but no clear pattern
  return {
    archetype: "Mixed Profile",
    reason: "Business shows mixed signals — no single dominant characteristic. Requires deeper qualitative research to understand the competitive position.",
    wouldConsider: false,
    note: "I'd need to understand this business far better before forming a view. Mixed financials usually mean the moat is unclear.",
  };
}

// ─── main scorer ──────────────────────────────────────────────────────────────

export function analyzeStock(f: StockFundamentals): BuffettAnalysis {
  const criteria: Criterion[] = [
    evalROE(f),
    evalEarningsQuality(f),
    evalGrossMargin(f),
    evalProfitMargin(f),
    evalDebt(f),
    evalPE(f),
    evalCapitalEfficiency(f),
    evalCurrentRatio(f),
    evalRevenueGrowth(f),
    evalCashFlowQuality(f),
    evalPEG(f),
  ];

  // Weighted score — N/A excluded from denominator
  const counted = criteria.filter((c) => c.score !== "na");
  const earned = counted.reduce((s, c) => s + scoreLabel(c.score) * c.weight, 0);
  const possible = counted.reduce((s, c) => s + 2 * c.weight, 0);
  const overallScore = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  // Data quality — only count genuine data gaps, not intentional sector exclusions
  const naCount = criteria.filter((c) => c.score === "na").length;
  const sectorNACount = criteria.filter((c) => c.score === "na" && c.benchmark.startsWith("N/A (Bank")).length;
  const dataNACount = naCount - sectorNACount;
  const dataQuality: BuffettAnalysis["dataQuality"] =
    dataNACount <= 1 ? "rich" : dataNACount <= 3 ? "partial" : "sparse";

  // Top strength and concern by weight
  const passes = counted.filter((c) => c.score === "pass").sort((a, b) => b.weight - a.weight);
  const fails = counted.filter((c) => c.score === "fail").sort((a, b) => b.weight - a.weight);
  const topStrength = passes[0]?.name ?? null;
  const topConcern = fails[0]?.name ?? null;

  const { archetype, reason, wouldConsider, note } = detectArchetype(f, criteria);

  return {
    symbol: f.symbol,
    name: f.name,
    sector: f.sector,
    overallScore,
    grade: grade(overallScore),
    verdict: verdict(overallScore, wouldConsider),
    archetype,
    archetypeReason: reason,
    criteria,
    topStrength,
    topConcern,
    dataQuality,
    buffettWouldConsider: wouldConsider,
    buffettNote: note,
  };
}

// ─── color / style helpers ────────────────────────────────────────────────────

export function gradeColor(g: Grade): string {
  if (g === "A+" || g === "A") return "text-emerald-500";
  if (g === "B") return "text-blue-500";
  if (g === "C") return "text-yellow-500";
  if (g === "D") return "text-orange-500";
  return "text-red-500";
}

export function gradeBg(g: Grade): string {
  if (g === "A+" || g === "A") return "bg-emerald-500/10 border-emerald-500/30";
  if (g === "B") return "bg-blue-500/10 border-blue-500/30";
  if (g === "C") return "bg-yellow-500/10 border-yellow-500/30";
  if (g === "D") return "bg-orange-500/10 border-orange-500/30";
  return "bg-red-500/10 border-red-500/30";
}

export function scoreColor(s: CriterionScore): string {
  if (s === "pass") return "text-emerald-500";
  if (s === "marginal") return "text-yellow-500";
  if (s === "fail") return "text-red-500";
  return "text-muted-foreground";
}

export function scoreBg(s: CriterionScore): string {
  if (s === "pass") return "bg-emerald-500/10";
  if (s === "marginal") return "bg-yellow-500/10";
  if (s === "fail") return "bg-red-500/10";
  return "bg-secondary";
}

export function scoreIcon(s: CriterionScore): string {
  if (s === "pass") return "✓";
  if (s === "marginal") return "~";
  if (s === "fail") return "✗";
  return "—";
}

export function archetypeColor(a: BuffettArchetype): string {
  if (a === "Wide Moat Compounder") return "text-emerald-400";
  if (a === "Deep Value Play") return "text-blue-400";
  if (a === "Dividend Compounder") return "text-teal-400";
  if (a === "Growth at Fair Price") return "text-violet-400";
  if (a === "Quality Compounder") return "text-emerald-400";
  if (a === "Steady Earner") return "text-sky-400";
  if (a === "Leveraged ROE Trap") return "text-orange-400";
  if (a === "Turnaround Candidate") return "text-yellow-400";
  if (a === "Capital Destroyer") return "text-red-400";
  if (a === "High Debt Business") return "text-red-400";
  if (a === "Mixed Profile") return "text-muted-foreground";
  return "text-muted-foreground";
}

export function archetypeBg(a: BuffettArchetype): string {
  if (a === "Wide Moat Compounder") return "bg-emerald-500/10 border-emerald-500/30";
  if (a === "Deep Value Play") return "bg-blue-500/10 border-blue-500/30";
  if (a === "Dividend Compounder") return "bg-teal-500/10 border-teal-500/30";
  if (a === "Growth at Fair Price") return "bg-violet-500/10 border-violet-500/30";
  if (a === "Quality Compounder") return "bg-emerald-500/10 border-emerald-500/20";
  if (a === "Steady Earner") return "bg-sky-500/10 border-sky-500/30";
  if (a === "Leveraged ROE Trap") return "bg-orange-500/10 border-orange-500/30";
  if (a === "Turnaround Candidate") return "bg-yellow-500/10 border-yellow-500/30";
  if (a === "Capital Destroyer") return "bg-red-500/10 border-red-500/30";
  if (a === "High Debt Business") return "bg-red-500/10 border-red-500/20";
  return "bg-secondary border-border";
}
