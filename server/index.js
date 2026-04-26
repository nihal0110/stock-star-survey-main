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

const EMPTY = { stocks: [], gold: [], dividends: [], targets: {}, watchlist: [], sectorTargets: {}, goals: [], sells: [] };

function readData() {
  if (!fs.existsSync(DATAFILE)) return { ...EMPTY };
  try { return { ...EMPTY, ...JSON.parse(fs.readFileSync(DATAFILE, "utf-8")) }; }
  catch (e) { console.error("[data] Failed to parse data file:", e.message); return { ...EMPTY }; }
}

function writeData(data) {
  fs.writeFileSync(DATAFILE, JSON.stringify(data, null, 2));
}

// ── stocks ────────────────────────────────────────────────────────────────────
app.get("/stock",          (_req, res) => res.json(readData().stocks));
app.post("/stock",         (req,  res) => { const d = readData(); d.stocks.push(req.body); writeData(d); res.json({ success: true, data: d.stocks }); });
app.put("/stock/:id",      (req,  res) => { const d = readData(); d.stocks = d.stocks.map(i => i.id === req.params.id ? { ...i, ...req.body, id: req.params.id } : i); writeData(d); res.json({ success: true, data: d.stocks }); });
app.delete("/stock/:id",   (req,  res) => { const d = readData(); d.stocks = d.stocks.filter(i => i.id !== req.params.id); writeData(d); res.json({ success: true, data: d.stocks }); });

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
  const { symbol, note } = req.body;
  const idx = d.watchlist.findIndex(w => w.symbol === symbol.toUpperCase());
  if (idx >= 0) {
    d.watchlist[idx].note = note ?? "";
  } else {
    d.watchlist.push({ symbol: symbol.toUpperCase(), addedAt: new Date().toISOString().split("T")[0], note: note ?? "" });
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

// ── sells ─────────────────────────────────────────────────────────────────────
app.get("/sells",          (_req, res) => res.json(readData().sells ?? []));
app.post("/sells",         (req,  res) => { const d = readData(); d.sells = [...(d.sells ?? []), req.body]; writeData(d); res.json({ success: true, data: d.sells }); });
app.put("/sells/:id",      (req,  res) => { const d = readData(); d.sells = (d.sells ?? []).map(s => s.id === req.params.id ? { ...s, ...req.body, id: req.params.id } : s); writeData(d); res.json({ success: true, data: d.sells }); });
app.delete("/sells/:id",   (req,  res) => { const d = readData(); d.sells = (d.sells ?? []).filter(s => s.id !== req.params.id); writeData(d); res.json({ success: true, data: d.sells }); });

// ── goals ─────────────────────────────────────────────────────────────────────
app.get("/goals",          (_req, res) => res.json(readData().goals ?? []));
app.post("/goals",         (req,  res) => { const d = readData(); d.goals = [...(d.goals ?? []), req.body]; writeData(d); res.json({ success: true, data: d.goals }); });
app.put("/goals/:id",      (req,  res) => { const d = readData(); d.goals = (d.goals ?? []).map(g => g.id === req.params.id ? { ...g, ...req.body, id: req.params.id } : g); writeData(d); res.json({ success: true, data: d.goals }); });
app.delete("/goals/:id",   (req,  res) => { const d = readData(); d.goals = (d.goals ?? []).filter(g => g.id !== req.params.id); writeData(d); res.json({ success: true, data: d.goals }); });

// ── sector rebalancing targets ────────────────────────────────────────────────
app.get("/sector-targets", (_req, res) => res.json(readData().sectorTargets ?? {}));

app.post("/sector-targets", (req, res) => {
  const d = readData();
  d.sectorTargets = req.body;
  writeData(d);
  res.json({ success: true, data: d.sectorTargets });
});

// ── Yahoo Finance crumb auth ──────────────────────────────────────────────────
const YF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": YF_UA, ...headers } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ body, headers: res.headers, status: res.statusCode }));
    }).on("error", reject);
  });
}

const yfCreds = { crumb: null, cookie: null, expiresAt: 0 };

async function getYFCreds() {
  if (yfCreds.crumb && Date.now() < yfCreds.expiresAt) return yfCreds;

  const fc = await httpsGet("https://fc.yahoo.com");
  const cookie = (fc.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");

  const { body: crumb } = await httpsGet(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    { Cookie: cookie }
  );

  yfCreds.crumb = crumb.trim();
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
app.get("/stock-info/:symbol", async (req, res) => {
  try {
    const { crumb, cookie } = await getYFCreds();
    const symbol = req.params.symbol.toUpperCase() + ".NS";
    const modules = "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

    const { body } = await httpsGet(url, { Cookie: cookie });
    const result = JSON.parse(body)?.quoteSummary?.result?.[0];
    if (!result) {
      const errMsg = JSON.parse(body)?.quoteSummary?.error?.description ?? "Symbol not found on NSE";
      return res.status(404).json({ error: errMsg });
    }

    const { price, summaryDetail, defaultKeyStatistics, financialData, assetProfile } = result;
    res.json({
      symbol: req.params.symbol.toUpperCase(),
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
      revenueGrowth: financialData?.revenueGrowth?.raw ?? null,
      currentRatio: financialData?.currentRatio?.raw ?? null,
      sector: assetProfile?.sector ?? null,
      industry: assetProfile?.industry ?? null,
      description: assetProfile?.longBusinessSummary ?? null,
      employees: assetProfile?.fullTimeEmployees ?? null,
      website: assetProfile?.website ?? null,
    });
  } catch (err) {
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
