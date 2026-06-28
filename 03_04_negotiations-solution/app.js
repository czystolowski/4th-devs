import express from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

process.loadEnvFile("../.env");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.NEGOTIATIONS_PORT || 3033;

// ── Load CSV data ──────────────────────────────────────────────────────────────
function loadData() {
  const cities = {}; // code -> name
  readFileSync(path.join(__dirname, "cities.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .forEach((line) => {
      const [name, code] = line.split(",");
      cities[code] = name;
    });

  const items = {}; // code -> name
  readFileSync(path.join(__dirname, "items.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .forEach((line) => {
      const idx = line.lastIndexOf(",");
      const name = line.substring(0, idx);
      const code = line.substring(idx + 1);
      items[code] = name;
    });

  // cityCode -> Set of item codes
  const cityItems = {};
  // itemCode -> Set of city codes
  const itemCities = {};
  readFileSync(path.join(__dirname, "connections.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .forEach((line) => {
      const [itemCode, cityCode] = line.split(",");
      if (!cityItems[cityCode]) cityItems[cityCode] = new Set();
      cityItems[cityCode].add(itemCode);
      if (!itemCities[itemCode]) itemCities[itemCode] = new Set();
      itemCities[itemCode].add(cityCode);
    });

  return { cities, items, cityItems, itemCities };
}

const { cities, items, cityItems, itemCities } = loadData();

// ── Fuzzy item search ─────────────────────────────────────────────────────────
// Tokenize and score by word overlap
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(" ").filter((t) => t.length > 1);
}

function scoreMatch(queryTokens, itemName) {
  const itemTokens = tokenize(itemName);
  let hits = 0;
  for (const qt of queryTokens) {
    if (itemTokens.some((it) => it.includes(qt) || qt.includes(it))) hits++;
  }
  return hits;
}

/**
 * Find items matching the natural language query.
 * Returns array of { code, name, score } sorted desc.
 */
function findMatchingItems(query, topN = 10) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = Object.entries(items).map(([code, name]) => ({
    code,
    name,
    score: scoreMatch(queryTokens, name),
  }));

  const maxScore = Math.max(...scored.map((s) => s.score));
  if (maxScore === 0) return [];

  return scored
    .filter((s) => s.score === maxScore && s.score >= 1)
    .slice(0, topN);
}

// ── Express server ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", JSON.stringify(req.body));
  }
  next();
});

// Tool: search_item
// Accepts natural language description of a single item.
// Returns a JSON with list of city names that sell matching items.
app.post("/api/search", async (req, res) => {
  try {
    const { params } = req.body;
    if (!params) {
      return res.json({ output: "Error: missing params" });
    }

    const query = String(params);
    const matches = findMatchingItems(query, 8);

    if (matches.length === 0) {
      return res.json({
        output: "Nie znaleziono przedmiotow pasujacych do zapytania. Sprobuj innych slow kluczowych.",
      });
    }

    // Get cities for all matching item codes
    const itemCodes = matches.map((m) => m.code);
    const allCitySets = itemCodes.map((code) => [...(itemCities[code] || [])].map((c) => cities[c]).filter(Boolean));

    // Flatten and deduplicate
    const allCities = [...new Set(allCitySets.flat())].sort();

    const topItems = matches.slice(0, 3).map((m) => m.name).join("; ");
    const citiesStr = allCities.join(", ");

    let output = `Przedmioty: ${topItems}. Miasta: ${citiesStr}`;

    // Ensure under 500 bytes
    if (Buffer.byteLength(output, "utf8") > 490) {
      output = `Miasta: ${citiesStr}`.substring(0, 460);
    }

    console.log(`✅ Found ${matches.length} items, ${allCities.length} cities`);
    return res.json({ output });
  } catch (err) {
    console.error("Error:", err);
    return res.json({ output: "Blad serwera: " + err.message.substring(0, 80) });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "ok", items: Object.keys(items).length, cities: Object.keys(cities).length });
});

app.listen(PORT, () => {
  console.log("🚀 Negotiations Tool Server");
  console.log("=".repeat(50));
  console.log(`✓ Running on port ${PORT}`);
  console.log(`✓ Tool endpoint: POST http://localhost:${PORT}/api/search`);
  console.log("\n💡 Expose publicly:");
  console.log(`   ngrok http ${PORT}`);
  console.log(`   ssh -p 443 -R0:localhost:${PORT} a.pinggy.io`);
  console.log("\n⏳ Waiting for requests...\n");
});
