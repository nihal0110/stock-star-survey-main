import fs from "fs";
import https from "https";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { execSync } from "child_process";

try {
  if (process.platform === "win32") {
    const out = execSync("netstat -ano", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    const match = out.match(/0\.0\.0\.0:3001\s+\S+\s+LISTENING\s+(\d+)/);
    if (match?.[1] && match[1] !== String(process.pid)) {
      execSync(`taskkill /F /PID ${match[1]}`, { stdio: "pipe" });
      await new Promise((r) => setTimeout(r, 400));
    }
  } else {
    execSync("kill -9 $(lsof -t -i:3001) 2>/dev/null || true", { shell: true });
    await new Promise((r) => setTimeout(r, 400));
  }
} catch {}

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_TEST = process.env.TEST_MODE === "true" || process.argv.includes("--test");
const DATAFILE = IS_TEST
  ? path.join(__dirname, "test-data.json")
  : path.join(__dirname, "../../../../OneDrive/Desktop/data.json");

if (IS_TEST) console.log("[backend] ⚡ TEST MODE — using test-data.json");

const EMPTY = { stocks: [], gold: [], dividends: [], targets: {}, watchlist: [], sectorTargets: {}, goals: [], sells: [], fundamentals: [], holdings: [], mf: [], mfSells: [], mfHoldings: [] };

// Rebuild holdings[] from buys and sells — called after every write to stocks or sells
function rebuildHoldings(stocks, sells) {
  const buys = stocks.filter(s => s.status !== "sold");
  const buyMap = new Map();
  for (const b of buys) {
    const key = b.stockName.trim().toUpperCase();
    if (!buyMap.has(key)) buyMap.set(key, { stockName: b.stockName.trim(), sector: b.sector ?? "", qty: 0, cost: 0 });
    const t = buyMap.get(key);
    t.qty  += b.quantity;
    t.cost += b.amount;
  }
  const soldQty = new Map();
  for (const s of (sells ?? [])) {
    const key = s.stockName.trim().toUpperCase();
    soldQty.set(key, (soldQty.get(key) ?? 0) + s.quantity);
  }
  const result = [];
  for (const [key, buy] of buyMap) {
    const sold = soldQty.get(key) ?? 0;
    const rem  = buy.qty - sold;
    if (rem <= 0) continue;
    const avgPrice = buy.qty > 0 ? buy.cost / buy.qty : 0;
    result.push({ stockName: buy.stockName, sector: buy.sector, qty: rem, totalCost: rem * avgPrice, avgPrice });
  }
  return result.sort((a, b) => b.totalCost - a.totalCost);
}

// ── expense tracker (separate file) ──────────────────────────────────────────
const EXPFILE = path.join(__dirname, "../../../../OneDrive/Desktop/expense.json");
const EXPENSE_EMPTY = { config: { initialBalance: { investment: 0, policies: 0, family: 0, savings: 0, emergencyFund: 0, gold: 0, personalExpenses: 0 } }, months: [] };

function readExpense() {
  if (!fs.existsSync(EXPFILE)) return { ...EXPENSE_EMPTY };
  try { return { ...EXPENSE_EMPTY, ...JSON.parse(fs.readFileSync(EXPFILE, "utf-8")) }; }
  catch { return { ...EXPENSE_EMPTY }; }
}
function writeExpense(data) { fs.writeFileSync(EXPFILE, JSON.stringify(data, null, 2)); }

app.get("/expense/config", (_req, res) => res.json(readExpense().config));
app.put("/expense/config", (req, res) => { const d = readExpense(); d.config = req.body; writeExpense(d); res.json({ success: true, data: d.config }); });

app.get("/expense/months", (_req, res) => res.json(readExpense().months));
app.post("/expense/months", (req, res) => { const d = readExpense(); d.months = [...d.months, req.body]; writeExpense(d); res.json({ success: true, data: d.months }); });
app.put("/expense/months/:id", (req, res) => { const d = readExpense(); d.months = d.months.map(m => m.id === req.params.id ? { ...m, ...req.body, id: req.params.id } : m); writeExpense(d); res.json({ success: true, data: d.months }); });
app.delete("/expense/months/:id", (req, res) => { const d = readExpense(); d.months = d.months.filter(m => m.id !== req.params.id); writeExpense(d); res.json({ success: true, data: d.months }); });

// ── personal expense tracker (separate section in expense.json) ───────────────
app.get("/personal-expense/months", (_req, res) => {
  const d = readExpense();
  res.json(d.personalMonths ?? []);
});
app.post("/personal-expense/months", (req, res) => {
  const d = readExpense();
  d.personalMonths = [...(d.personalMonths ?? []), req.body];
  writeExpense(d);
  res.json({ success: true, data: d.personalMonths });
});
app.put("/personal-expense/months/:id", (req, res) => {
  const d = readExpense();
  d.personalMonths = (d.personalMonths ?? []).map(m => m.id === req.params.id ? { ...m, ...req.body, id: req.params.id } : m);
  writeExpense(d);
  res.json({ success: true, data: d.personalMonths });
});
app.delete("/personal-expense/months/:id", (req, res) => {
  const d = readExpense();
  d.personalMonths = (d.personalMonths ?? []).filter(m => m.id !== req.params.id);
  writeExpense(d);
  res.json({ success: true, data: d.personalMonths });
});

function readData() {
  if (!fs.existsSync(DATAFILE)) return { ...EMPTY };
  try { return { ...EMPTY, ...JSON.parse(fs.readFileSync(DATAFILE, "utf-8")) }; }
  catch (e) { console.error("[data] Failed to parse data file:", e.message); return { ...EMPTY }; }
}

function writeData(data) {
  fs.writeFileSync(DATAFILE, JSON.stringify(data, null, 2));
}

// Rebuild mfHoldings[] from MF buys and mfSells
function rebuildMfHoldings(mf, mfSells) {
  const buyMap = new Map();
  for (const b of (mf ?? [])) {
    const key = b.fundName.trim().toUpperCase();
    if (!buyMap.has(key)) buyMap.set(key, { fundName: b.fundName.trim(), code: b.code ?? "", category: b.category ?? "", units: 0, cost: 0 });
    const t = buyMap.get(key);
    t.units += b.units;
    t.cost  += b.amount;
  }
  const soldMap = new Map();
  for (const s of (mfSells ?? [])) {
    const key = s.fundName.trim().toUpperCase();
    soldMap.set(key, (soldMap.get(key) ?? 0) + s.units);
  }
  const result = [];
  for (const [key, buy] of buyMap) {
    const sold = soldMap.get(key) ?? 0;
    const rem  = buy.units - sold;
    if (rem <= 0) continue;
    const avgNav = buy.units > 0 ? buy.cost / buy.units : 0;
    result.push({ fundName: buy.fundName, code: buy.code, category: buy.category, units: rem, totalCost: rem * avgNav, avgNav });
  }
  return result.sort((a, b) => b.totalCost - a.totalCost);
}

// ── mutual funds ──────────────────────────────────────────────────────────────
app.get("/mf",           (_req, res) => res.json(readData().mf ?? []));
app.post("/mf",          (req,  res) => { const d = readData(); d.mf = [...(d.mf ?? []), req.body]; d.mfHoldings = rebuildMfHoldings(d.mf, d.mfSells); writeData(d); res.json({ success: true, data: d.mf }); });
app.put("/mf/:id",       (req,  res) => { const d = readData(); d.mf = (d.mf ?? []).map(i => i.id === req.params.id ? { ...i, ...req.body, id: req.params.id } : i); d.mfHoldings = rebuildMfHoldings(d.mf, d.mfSells); writeData(d); res.json({ success: true, data: d.mf }); });
app.delete("/mf/:id",    (req,  res) => { const d = readData(); d.mf = (d.mf ?? []).filter(i => i.id !== req.params.id); d.mfHoldings = rebuildMfHoldings(d.mf, d.mfSells); writeData(d); res.json({ success: true, data: d.mf }); });

// ── MF sells ──────────────────────────────────────────────────────────────────
app.get("/mf-sells",        (_req, res) => res.json(readData().mfSells ?? []));
app.post("/mf-sells",       (req,  res) => { const d = readData(); d.mfSells = [...(d.mfSells ?? []), req.body]; d.mfHoldings = rebuildMfHoldings(d.mf, d.mfSells); writeData(d); res.json({ success: true, data: d.mfSells }); });
app.delete("/mf-sells/:id", (req,  res) => { const d = readData(); d.mfSells = (d.mfSells ?? []).filter(s => s.id !== req.params.id); d.mfHoldings = rebuildMfHoldings(d.mf, d.mfSells); writeData(d); res.json({ success: true, data: d.mfSells }); });

// ── MF holdings (server-maintained) ──────────────────────────────────────────
app.get("/mf-holdings", (_req, res) => res.json(readData().mfHoldings ?? []));

// ── stocks (buys only — sells are in /sells) ──────────────────────────────────
app.get("/stock",        (_req, res) => res.json(readData().stocks));
app.post("/stock",       (req,  res) => { const d = readData(); d.stocks.push(req.body); d.holdings = rebuildHoldings(d.stocks, d.sells); writeData(d); res.json({ success: true, data: d.stocks }); });
app.put("/stock/:id",    (req,  res) => { const d = readData(); d.stocks = d.stocks.map(i => i.id === req.params.id ? { ...i, ...req.body, id: req.params.id } : i); d.holdings = rebuildHoldings(d.stocks, d.sells); writeData(d); res.json({ success: true, data: d.stocks }); });
app.delete("/stock/:id", (req,  res) => { const d = readData(); d.stocks = d.stocks.filter(i => i.id !== req.params.id); d.holdings = rebuildHoldings(d.stocks, d.sells); writeData(d); res.json({ success: true, data: d.stocks }); });

// ── gold ──────────────────────────────────────────────────────────────────────
app.get("/gold",           (_req, res) => res.json(readData().gold));
app.post("/gold",          (req,  res) => { const d = readData(); d.gold.push(req.body); writeData(d); res.json({ success: true, data: d.gold }); });
app.put("/gold/:id",       (req,  res) => { const d = readData(); d.gold = d.gold.map(i => i.id === req.params.id ? { ...i, ...req.body, id: req.params.id } : i); writeData(d); res.json({ success: true, data: d.gold }); });
app.delete("/gold/:id",    (req,  res) => { const d = readData(); d.gold = d.gold.filter(i => i.id !== req.params.id); writeData(d); res.json({ success: true, data: d.gold }); });

// ── dividends ─────────────────────────────────────────────────────────────────
app.get("/dividend",       (_req, res) => res.json(readData().dividends));
app.post("/dividend",      (req,  res) => { const d = readData(); d.dividends.push(req.body); writeData(d); res.json({ success: true, data: d.dividends }); });
app.put("/dividend/:id",   (req,  res) => { const d = readData(); d.dividends = d.dividends.map(i => i.id === req.params.id ? { ...i, ...req.body, id: req.params.id } : i); writeData(d); res.json({ success: true, data: d.dividends }); });
app.delete("/dividend/:id",(req,  res) => { const d = readData(); d.dividends = d.dividends.filter(i => i.id !== req.params.id); writeData(d); res.json({ success: true, data: d.dividends }); });

// ── targets ───────────────────────────────────────────────────────────────────
app.get("/targets", (_req, res) => res.json(readData().targets));

app.post("/targets/:stock", (req, res) => {
  const d = readData();
  const stock = req.params.stock;
  const { price } = req.body;

  if (price === null || price === undefined) {
    delete d.targets[stock];
  } else {
    const existing = d.targets[stock];
    const history = existing
      ? [...existing.history, { price: existing.price, setAt: existing.setAt }]
      : [];
    d.targets[stock] = { price, setAt: new Date().toISOString().split("T")[0], history };
  }

  writeData(d);
  res.json({ success: true, data: d.targets });
});

// ── watchlist ─────────────────────────────────────────────────────────────────
app.get("/watchlist", (_req, res) => res.json(readData().watchlist ?? []));

app.post("/watchlist", (req, res) => {
  const d = readData();
  if (!d.watchlist) d.watchlist = [];
  const { symbol, note, sector } = req.body;
  const idx = d.watchlist.findIndex(w => w.symbol === symbol.toUpperCase());
  if (idx >= 0) {
    d.watchlist[idx].note = note ?? "";
    if (sector !== undefined) d.watchlist[idx].sector = sector;
  } else {
    d.watchlist.push({ symbol: symbol.toUpperCase(), addedAt: new Date().toISOString().split("T")[0], note: note ?? "", sector: sector ?? "" });
  }
  writeData(d);
  res.json({ success: true, data: d.watchlist });
});

app.delete("/watchlist/:symbol", (req, res) => {
  const d = readData();
  d.watchlist = (d.watchlist ?? []).filter(w => w.symbol !== req.params.symbol.toUpperCase());
  writeData(d);
  res.json({ success: true, data: d.watchlist });
});

// ── sells (sell transactions — buys never touched) ────────────────────────────
app.get("/sells",        (_req, res) => res.json(readData().sells ?? []));
app.post("/sells",       (req,  res) => { const d = readData(); d.sells = [...(d.sells ?? []), req.body]; d.holdings = rebuildHoldings(d.stocks, d.sells); writeData(d); res.json({ success: true, data: d.sells }); });
app.put("/sells/:id",    (req,  res) => { const d = readData(); d.sells = (d.sells ?? []).map(s => s.id === req.params.id ? { ...s, ...req.body, id: req.params.id } : s); d.holdings = rebuildHoldings(d.stocks, d.sells); writeData(d); res.json({ success: true, data: d.sells }); });
app.delete("/sells/:id", (req,  res) => { const d = readData(); d.sells = (d.sells ?? []).filter(s => s.id !== req.params.id); d.holdings = rebuildHoldings(d.stocks, d.sells); writeData(d); res.json({ success: true, data: d.sells }); });

// ── holdings (server-maintained current positions) ────────────────────────────
app.get("/holdings", (_req, res) => res.json(readData().holdings ?? []));

// ── goals ─────────────────────────────────────────────────────────────────────
app.get("/goals",          (_req, res) => res.json(readData().goals ?? []));
app.post("/goals",         (req,  res) => { const d = readData(); d.goals = [...(d.goals ?? []), req.body]; writeData(d); res.json({ success: true, data: d.goals }); });
app.put("/goals/:id",      (req,  res) => { const d = readData(); d.goals = (d.goals ?? []).map(g => g.id === req.params.id ? { ...g, ...req.body, id: req.params.id } : g); writeData(d); res.json({ success: true, data: d.goals }); });
app.delete("/goals/:id",   (req,  res) => { const d = readData(); d.goals = (d.goals ?? []).filter(g => g.id !== req.params.id); writeData(d); res.json({ success: true, data: d.goals }); });

// ── fundamentals (manual Buffett analysis) ────────────────────────────────────
app.get("/fundamentals",       (_req, res) => res.json(readData().fundamentals ?? []));
app.post("/fundamentals",      (req,  res) => { const d = readData(); d.fundamentals = [...(d.fundamentals ?? []), req.body]; writeData(d); res.json({ success: true, data: d.fundamentals }); });
app.put("/fundamentals/:id",   (req,  res) => { const d = readData(); d.fundamentals = (d.fundamentals ?? []).map(f => f.id === req.params.id ? { ...f, ...req.body, id: req.params.id } : f); writeData(d); res.json({ success: true, data: d.fundamentals }); });
app.delete("/fundamentals/:id",(req,  res) => { const d = readData(); d.fundamentals = (d.fundamentals ?? []).filter(f => f.id !== req.params.id); writeData(d); res.json({ success: true, data: d.fundamentals }); });

// ── sector rebalancing targets ────────────────────────────────────────────────
app.get("/sector-targets", (_req, res) => res.json(readData().sectorTargets ?? {}));

app.post("/sector-targets", (req, res) => {
  const d = readData();
  d.sectorTargets = req.body;
  writeData(d);
  res.json({ success: true, data: d.sectorTargets });
});

// ── Yahoo Finance crumb auth ──────────────────────────────────────────────────
const YF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      maxHeaderSize: 32768,
      headers: { "User-Agent": YF_UA, Accept: "*/*", ...extraHeaders },
    };
    const req = https.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return httpsGet(res.headers.location, extraHeaders).then(resolve).catch(reject);
      }
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ body, headers: res.headers, status: res.statusCode }));
    });
    req.on("error", reject);
    req.end();
  });
}

const yfCreds = { crumb: null, cookie: null, expiresAt: 0 };

async function getYFCreds() {
  if (yfCreds.crumb && Date.now() < yfCreds.expiresAt) return yfCreds;

  // fc.yahoo.com is a lightweight endpoint that sets the session cookie
  const fc = await httpsGet("https://fc.yahoo.com");
  const cookie = (fc.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");

  const { body: crumbBody } = await httpsGet(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    { Cookie: cookie }
  );

  const crumb = crumbBody.trim();
  if (!crumb || crumb.length > 40 || crumb.startsWith("<") || crumb.includes("Unauthorized")) {
    console.error("[yfCreds] bad crumb:", JSON.stringify(crumb.slice(0, 80)));
    throw new Error("Yahoo Finance auth failed — could not obtain crumb");
  }

  console.log("[yfCreds] crumb refreshed ok");
  yfCreds.crumb = crumb;
  yfCreds.cookie = cookie;
  yfCreds.expiresAt = Date.now() + 3_600_000;
  return yfCreds;
}

// ── stock name search (Yahoo Finance autocomplete) ───────────────────────────
app.get("/search", async (req, res) => {
  const q = (req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0&region=IN&lang=en-IN`;
    const { body } = await httpsGet(url);
    const quotes = JSON.parse(body)?.quotes ?? [];
    res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=60");
    res.json(
      quotes
        .filter((q) => q.quoteType === "EQUITY" && (q.exchDisp === "NSE" || q.exchDisp === "BSE"))
        .map((q) => ({
          symbol: q.symbol.replace(/\.(NS|BO)$/, ""),
          name: q.longname ?? q.shortname ?? q.symbol,
          exchange: q.exchDisp ?? "NSE",
          sector: q.sector ?? null,
        }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── stock fundamentals (Yahoo Finance quoteSummary) ───────────────────────────
const MODULES = "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,earningsTrend";

async function fetchQuoteSummary(yfSymbol) {
  // query1 v10 with crumb is the only combination that reliably returns data
  const { crumb, cookie } = await getYFCreds();
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yfSymbol)}?modules=${MODULES}&crumb=${encodeURIComponent(crumb)}`;
  const { body } = await httpsGet(url, { Cookie: cookie });
  return JSON.parse(body)?.quoteSummary?.result?.[0] ?? null;
}

app.get("/stock-info/:symbol", async (req, res) => {
  try {
    const base = req.params.symbol.toUpperCase();
    let found = null;
    let usedSymbol = base;

    for (const suffix of [".NS", ".BO"]) {
      const result = await fetchQuoteSummary(base + suffix);
      if (result) { found = result; usedSymbol = base + suffix; break; }
      console.log(`[stock-info] ${base}${suffix} → no data`);
    }

    if (!found) {
      return res.status(404).json({ error: `Symbol not found: ${base}` });
    }

    const { price, summaryDetail, defaultKeyStatistics, financialData, assetProfile,
            incomeStatementHistory, balanceSheetHistory, cashflowStatementHistory, earningsTrend } = found;

    // ── Derive missing metrics from raw statements when financialData is sparse ──

    // Revenue growth: YoY from income statement if financialData.revenueGrowth is null
    let revenueGrowth = financialData?.revenueGrowth?.raw ?? null;
    if (revenueGrowth === null) {
      const stmts = incomeStatementHistory?.incomeStatementHistory ?? [];
      const r0 = stmts[0]?.totalRevenue?.raw;
      const r1 = stmts[1]?.totalRevenue?.raw;
      if (r0 && r1 && r1 !== 0) revenueGrowth = (r0 - r1) / Math.abs(r1);
    }
    // Also try earningsTrend revenue growth estimate as last resort
    if (revenueGrowth === null) {
      const trend = earningsTrend?.trend ?? [];
      const annual = trend.find(t => t.period === "0y" || t.period === "+1y");
      revenueGrowth = annual?.revenueEstimate?.growth?.raw ?? null;
    }

    // Current ratio: currentAssets / currentLiabilities from balance sheet
    let currentRatio = financialData?.currentRatio?.raw ?? null;
    if (currentRatio === null) {
      const bs = balanceSheetHistory?.balanceSheetStatements?.[0];
      const ca = bs?.totalCurrentAssets?.raw;
      const cl = bs?.totalCurrentLiabilities?.raw;
      if (ca && cl && cl !== 0) currentRatio = ca / cl;
    }

    // Free cash flow: operatingCF - capex from cashflow statement
    let freeCashflow = financialData?.freeCashflow?.raw ?? null;
    if (freeCashflow === null) {
      const cf = cashflowStatementHistory?.cashflowStatements?.[0];
      const ocf = cf?.totalCashFromOperatingActivities?.raw;
      const capex = cf?.capitalExpenditures?.raw; // usually negative
      if (ocf != null && capex != null) freeCashflow = ocf + capex; // capex is negative so adding gives FCF
    }

    // Operating cash flow from cashflow statement if financialData missing
    let operatingCashflow = financialData?.operatingCashflow?.raw ?? null;
    if (operatingCashflow === null) {
      const cf = cashflowStatementHistory?.cashflowStatements?.[0];
      operatingCashflow = cf?.totalCashFromOperatingActivities?.raw ?? null;
    }

    // Total revenue from income statement if financialData missing
    let totalRevenue = financialData?.totalRevenue?.raw ?? null;
    if (totalRevenue === null) {
      totalRevenue = incomeStatementHistory?.incomeStatementHistory?.[0]?.totalRevenue?.raw ?? null;
    }

    // Gross margin: compute from income statement if missing
    let grossMargin = financialData?.grossMargins?.raw ?? null;
    if (grossMargin === null) {
      const stmt = incomeStatementHistory?.incomeStatementHistory?.[0];
      const gp = stmt?.grossProfit?.raw;
      const rev = stmt?.totalRevenue?.raw;
      if (gp != null && rev && rev !== 0) grossMargin = gp / rev;
    }

    // Return on assets: netIncome / totalAssets
    let returnOnAssets = financialData?.returnOnAssets?.raw ?? null;
    if (returnOnAssets === null) {
      const stmt = incomeStatementHistory?.incomeStatementHistory?.[0];
      const bs = balanceSheetHistory?.balanceSheetStatements?.[0];
      const ni = stmt?.netIncome?.raw;
      const ta = bs?.totalAssets?.raw;
      if (ni != null && ta && ta !== 0) returnOnAssets = ni / ta;
    }

    res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=60");
    res.json({
      symbol: base,
      yfSymbol: usedSymbol,
      name: price?.longName ?? price?.shortName ?? null,
      currentPrice: price?.regularMarketPrice?.raw ?? null,
      change: price?.regularMarketChange?.raw ?? null,
      changePercent: price?.regularMarketChangePercent?.raw ?? null,
      marketCap: price?.marketCap?.raw ?? null,
      trailingPE: summaryDetail?.trailingPE?.raw ?? null,
      forwardPE: summaryDetail?.forwardPE?.raw ?? null,
      dividendYield: summaryDetail?.dividendYield?.raw ?? null,
      dividendRate: summaryDetail?.dividendRate?.raw ?? null,
      high52: summaryDetail?.fiftyTwoWeekHigh?.raw ?? null,
      low52: summaryDetail?.fiftyTwoWeekLow?.raw ?? null,
      eps: defaultKeyStatistics?.trailingEps?.raw ?? null,
      bookValue: defaultKeyStatistics?.bookValue?.raw ?? null,
      priceToBook: defaultKeyStatistics?.priceToBook?.raw ?? null,
      pegRatio: defaultKeyStatistics?.pegRatio?.raw ?? null,
      beta: defaultKeyStatistics?.beta?.raw ?? null,
      roe: financialData?.returnOnEquity?.raw ?? null,
      profitMargin: financialData?.profitMargins?.raw ?? null,
      debtToEquity: financialData?.debtToEquity?.raw ?? null,
      revenueGrowth,
      currentRatio,
      sector: assetProfile?.sector ?? null,
      industry: assetProfile?.industry ?? null,
      description: assetProfile?.longBusinessSummary ?? null,
      employees: assetProfile?.fullTimeEmployees ?? null,
      website: assetProfile?.website ?? null,
      grossMargin,
      operatingMargin: financialData?.operatingMargins?.raw ?? null,
      operatingCashflow,
      freeCashflow,
      returnOnAssets,
      totalRevenue,
      totalDebt: financialData?.totalDebt?.raw ?? balanceSheetHistory?.balanceSheetStatements?.[0]?.longTermDebt?.raw ?? null,
      earningsGrowth: financialData?.earningsGrowth?.raw ?? defaultKeyStatistics?.earningsQuarterlyGrowth?.raw ?? null,
    });
  } catch (err) {
    console.error("[stock-info] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Nifty 50 historical prices ────────────────────────────────────────────────
app.get("/nifty-prices", async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date("2000-01-01");
    const to   = new Date();
    const period1 = Math.floor(from.getTime() / 1000);
    const period2 = Math.floor(to.getTime()   / 1000) + 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&period1=${period1}&period2=${period2}`;
    const { body } = await httpsGet(url);
    const result = JSON.parse(body)?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: "Could not fetch Nifty data" });
    const timestamps = result.timestamp ?? [];
    const closes     = result.indicators?.quote?.[0]?.close ?? [];
    res.json(
      timestamps
        .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().split("T")[0], close: closes[i] }))
        .filter((p) => p.close != null)
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── live price proxy (Yahoo Finance) ─────────────────────────────────────────
// ── Mutual fund NAV — tries .BO (regular MFs) then .NS (ETFs) then bare ──────
app.get("/mf-nav/:code", async (req, res) => {
  const base = req.params.code.toUpperCase();
  // Yahoo Finance mutual fund codes start with "0P" → use .BO; ETF codes → use .NS
  const suffixes = base.startsWith("0P") ? [".BO", ""] : [".NS", ".BO", ""];

  for (const suffix of suffixes) {
    const symbol = base + suffix;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    try {
      const result = await new Promise((resolve) => {
        https.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }, (response) => {
          let body = "";
          response.on("data", (c) => (body += c));
          response.on("end", () => {
            try {
              const meta = JSON.parse(body)?.chart?.result?.[0]?.meta;
              if (meta?.regularMarketPrice) {
                resolve({
                  code: base, symbol,
                  price: meta.regularMarketPrice,
                  previousClose: meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? null,
                  currency: meta.currency ?? "INR",
                  marketState: meta.marketState ?? "UNKNOWN",
                });
              } else resolve(null);
            } catch { resolve(null); }
          });
        }).on("error", () => resolve(null));
      });
      if (result) return res.json(result);
    } catch {}
  }
  res.status(404).json({ error: "NAV not found", code: base });
});

app.get("/live-price/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase() + ".NS";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  https.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }, (response) => {
    let body = "";
    response.on("data", (chunk) => (body += chunk));
    response.on("end", () => {
      try {
        const meta = JSON.parse(body)?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return res.status(404).json({ error: "Symbol not found", symbol });
        res.json({
          symbol,
          price: meta.regularMarketPrice,
          previousClose: meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? null,
          high52: meta.fiftyTwoWeekHigh ?? null,
          low52: meta.fiftyTwoWeekLow ?? null,
          dayHigh: meta.regularMarketDayHigh ?? null,
          dayLow: meta.regularMarketDayLow ?? null,
          currency: meta.currency ?? "INR",
          exchange: meta.exchangeName ?? "NSE",
          marketState: meta.marketState ?? "UNKNOWN",
        });
      } catch {
        res.status(500).json({ error: "Parse error", symbol });
      }
    });
  }).on("error", (err) => res.status(500).json({ error: err.message, symbol }));
});

// ── Live gold price via GOLDBEES.NS → Indian retail ───────────────────────────
// GOLDBEES NAV uses same LBMA benchmark as Indian jewellers, so it stays
// in sync with Indian market hours and avoids overnight COMEX divergence.
// 1 unit = 0.01 g  →  × 100 = INR per gram (London spot, INR-denominated)
// Retail = spot × 1.25  (import duty 11.6% + GST 3% + dealer margin ~8%)
// Validated: GOLDBEES ₹123.94 × 100 × 1.25 = ₹15,493 ≈ GoodReturns ₹15,491
const goldCache = { data: null, at: 0 };
const GOLD_CACHE_MS = 15 * 60 * 1000; // 15-minute cache
const INDIA_RETAIL_MULTIPLIER = 1.25;

app.get("/gold-price", async (req, res) => {
  try {
    if (goldCache.data && Date.now() - goldCache.at < GOLD_CACHE_MS) {
      return res.json(goldCache.data);
    }

    const { body } = await httpsGet(
      "https://query1.finance.yahoo.com/v8/finance/chart/GOLDBEES.NS?interval=1d&range=5d",
      { "User-Agent": YF_UA }
    );
    const result = JSON.parse(body)?.chart?.result?.[0];
    const meta   = result?.meta;

    if (!meta?.regularMarketPrice) {
      return res.status(502).json({ error: "Could not fetch GOLDBEES price from NSE" });
    }

    // Spot in INR per gram (0.01 g per unit × 100)
    const spotPerGram    = meta.regularMarketPrice * 100;
    const prevSpotPerGram = (meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? null);
    const prevSpot        = prevSpotPerGram ? prevSpotPerGram * 100 : null;

    const retail24k = Math.round(spotPerGram * INDIA_RETAIL_MULTIPLIER);
    const retail22k = Math.round(retail24k * (22 / 24));
    const retail18k = Math.round(retail24k * (18 / 24));

    const change    = prevSpot !== null ? Math.round((spotPerGram - prevSpot) * INDIA_RETAIL_MULTIPLIER) : null;
    const changePct = (prevSpot !== null && prevSpot > 0) ? Math.round(((spotPerGram - prevSpot) / prevSpot) * 10000) / 100 : null;

    const data = {
      retail24k, retail22k, retail18k,
      spot24k:  Math.round(spotPerGram),
      change, changePct,
      source: "GOLDBEES.NS × 1.25 (import duty + GST + margin)",
      updatedAt: new Date().toISOString(),
    };
    goldCache.data = data;
    goldCache.at   = Date.now();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log("[backend] Running on http://localhost:3001"));
