import fs from "fs";
import https from "https";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(__dirname, "../../../../../OneDrive/Desktop/stock.json");
const GOLDFILE = path.join(__dirname, "../../../../../OneDrive/Desktop/gold.json");
const DIVIDENDFILE = path.join(__dirname, "../../../../../OneDrive/Desktop/dividend.json");

console.log("Stock file:", FILE);

// ─── Stock CRUD ───────────────────────────────────────────────────────────────

app.get("/stock", (req, res) => {
  if (!fs.existsSync(FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(FILE)));
});

app.post("/stock", (req, res) => {
  let data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf-8") || "[]") : [];
  data.push(req.body);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

app.put("/stock/:id", (req, res) => {
  let data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf-8") || "[]") : [];
  data = data.map((item) => (item.id === req.params.id ? { ...item, ...req.body, id: req.params.id } : item));
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

app.delete("/stock/:id", (req, res) => {
  let data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf-8") || "[]") : [];
  data = data.filter((item) => item.id !== req.params.id);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

// ─── Gold CRUD ────────────────────────────────────────────────────────────────

app.get("/gold", (req, res) => {
  if (!fs.existsSync(GOLDFILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(GOLDFILE)));
});

app.post("/gold", (req, res) => {
  let data = fs.existsSync(GOLDFILE) ? JSON.parse(fs.readFileSync(GOLDFILE, "utf-8") || "[]") : [];
  data.push(req.body);
  fs.writeFileSync(GOLDFILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

app.put("/gold/:id", (req, res) => {
  let data = fs.existsSync(GOLDFILE) ? JSON.parse(fs.readFileSync(GOLDFILE, "utf-8") || "[]") : [];
  data = data.map((item) => (item.id === req.params.id ? { ...item, ...req.body, id: req.params.id } : item));
  fs.writeFileSync(GOLDFILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

app.delete("/gold/:id", (req, res) => {
  let data = fs.existsSync(GOLDFILE) ? JSON.parse(fs.readFileSync(GOLDFILE, "utf-8") || "[]") : [];
  data = data.filter((item) => item.id !== req.params.id);
  fs.writeFileSync(GOLDFILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

// ─── Dividend CRUD ────────────────────────────────────────────────────────────

app.get("/dividend", (req, res) => {
  if (!fs.existsSync(DIVIDENDFILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(DIVIDENDFILE)));
});

app.post("/dividend", (req, res) => {
  let data = fs.existsSync(DIVIDENDFILE) ? JSON.parse(fs.readFileSync(DIVIDENDFILE, "utf-8") || "[]") : [];
  data.push(req.body);
  fs.writeFileSync(DIVIDENDFILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

app.put("/dividend/:id", (req, res) => {
  let data = fs.existsSync(DIVIDENDFILE) ? JSON.parse(fs.readFileSync(DIVIDENDFILE, "utf-8") || "[]") : [];
  data = data.map((item) => (item.id === req.params.id ? { ...item, ...req.body, id: req.params.id } : item));
  fs.writeFileSync(DIVIDENDFILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

app.delete("/dividend/:id", (req, res) => {
  let data = fs.existsSync(DIVIDENDFILE) ? JSON.parse(fs.readFileSync(DIVIDENDFILE, "utf-8") || "[]") : [];
  data = data.filter((item) => item.id !== req.params.id);
  fs.writeFileSync(DIVIDENDFILE, JSON.stringify(data, null, 2));
  res.json({ success: true, data });
});

// ─── Live Price Proxy (Yahoo Finance) ─────────────────────────────────────────
// Fetches NSE stock price via Yahoo Finance (free, no API key needed)
// Symbol format: RELIANCE → RELIANCE.NS

app.get("/live-price/:symbol", (req, res) => {
  const raw = req.params.symbol.toUpperCase();
  // Append .NS for NSE if no exchange suffix provided
  const symbol = raw.includes(".") ? raw : `${raw}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  const options = {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  };

  https.get(url, options, (response) => {
    let body = "";
    response.on("data", (chunk) => (body += chunk));
    response.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const meta = parsed?.chart?.result?.[0]?.meta;
        if (!meta) {
          return res.status(404).json({ error: "Symbol not found", symbol });
        }
        res.json({
          symbol,
          price: meta.regularMarketPrice ?? null,
          previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
          currency: meta.currency ?? "INR",
          exchange: meta.exchangeName ?? "NSE",
          marketState: meta.marketState ?? "UNKNOWN",
        });
      } catch {
        res.status(500).json({ error: "Failed to parse response", symbol });
      }
    });
  }).on("error", (err) => {
    res.status(500).json({ error: err.message, symbol });
  });
});

app.listen(3001, () => console.log("Backend running on http://localhost:3001"));
