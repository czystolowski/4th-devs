/**
 * S04E04 — Filesystem: Organize Natan's trade notes
 * 
 * Task: Build a virtual filesystem with /miasta, /osoby, /towary directories
 * - /miasta/<city>: JSON with city's needs (goods + quantities)
 * - /osoby/<person>: Person's name + markdown link to their city file
 * - /towary/<good>: Markdown link(s) to city/cities that sell this good
 */

import { AGENT_TOKEN } from "../config.js";

const API_URL = "https://hub.ag3nts.org/verify";
const TASK = "filesystem";
const API_KEY = AGENT_TOKEN;

// ─── DATA EXTRACTED FROM NATAN'S NOTES ───────────────────────────────────────

// From ogłoszenia.txt: city needs (no units, Polish-char-free keys)
const CITY_NEEDS = {
  opalino:   { chleb: 45, woda: 120, mlotki: 6 },
  domatowo:  { makaron: 60, woda: 150, lopaty: 8 },
  brudzewo:  { ryz: 55, woda: 140, wiertarki: 5 },
  darzlubie: { wolowina: 25, woda: 130, kilofy: 7 },
  celbowo:   { kurczak: 40, woda: 125, mlotki: 6 },
  mechowo:   { ziemniaki: 100, kapusta: 70, marchew: 65, woda: 165, lopaty: 9 },
  puck:      { chleb: 50, ryz: 45, woda: 175, wiertarki: 7 },
  karlinkowo:{ makaron: 52, wolowina: 22, ziemniaki: 95, woda: 155, kilofy: 6 },
};

// From rozmowy.txt: person responsible for trade in each city
// filename-safe: first_last (underscore, lowercase, no Polish chars)
const CITY_TRADERS = {
  domatowo:  { firstName: "Natan",  lastName: "Rams",    filename: "natan_rams" },
  opalino:   { firstName: "Iga",    lastName: "Kapecka", filename: "iga_kapecka" },
  brudzewo:  { firstName: "Rafal",  lastName: "Kisiel",  filename: "rafal_kisiel" },
  darzlubie: { firstName: "Marta",  lastName: "Frantz",  filename: "marta_frantz" },
  celbowo:   { firstName: "Oskar",  lastName: "Radtke",  filename: "oskar_radtke" },
  mechowo:   { firstName: "Eliza",  lastName: "Redmann", filename: "eliza_redmann" },
  puck:      { firstName: "Damian", lastName: "Kroll",   filename: "damian_kroll" },
  karlinkowo:{ firstName: "Lena",   lastName: "Konkel",  filename: "lena_konkel" },
};

// From transakcje.txt: city → goods it SELLS (normalized to singular nominative, no Polish chars)
// Raw: Darzlubie->ryż->Puck means Darzlubie sells ryż
// Good names: Polish diacritics stripped, using exact names system expects
// (verified against API response: mlotki, maka, lopata, wolowina, ryz, ziemniaki)
const TRANSACTIONS = [
  { seller: "darzlubie", good: "ryz",       buyer: "puck" },
  { seller: "puck",      good: "marchew",   buyer: "mechowo" },
  { seller: "domatowo",  good: "chleb",     buyer: "opalino" },
  { seller: "opalino",   good: "wolowina",  buyer: "darzlubie" },
  { seller: "puck",      good: "kilof",     buyer: "darzlubie" },
  { seller: "karlinkowo",good: "wiertarka", buyer: "puck" },
  { seller: "celbowo",   good: "chleb",     buyer: "opalino" },
  { seller: "brudzewo",  good: "maka",      buyer: "karlinkowo" },
  { seller: "karlinkowo",good: "mlotki",    buyer: "opalino" },
  { seller: "opalino",   good: "makaron",   buyer: "domatowo" },
  { seller: "celbowo",   good: "kapusta",   buyer: "mechowo" },
  { seller: "domatowo",  good: "ziemniaki", buyer: "mechowo" },
  { seller: "opalino",   good: "ryz",       buyer: "brudzewo" },
  { seller: "mechowo",   good: "kilof",     buyer: "karlinkowo" },
  { seller: "brudzewo",  good: "chleb",     buyer: "puck" },
  { seller: "darzlubie", good: "ziemniaki", buyer: "karlinkowo" },
  { seller: "darzlubie", good: "kurczak",   buyer: "celbowo" },
  { seller: "karlinkowo",good: "ryz",       buyer: "brudzewo" },
  { seller: "brudzewo",  good: "lopata",    buyer: "domatowo" },
  { seller: "puck",      good: "lopata",    buyer: "domatowo" },
  { seller: "mechowo",   good: "maka",      buyer: "domatowo" },
  { seller: "mechowo",   good: "mlotki",    buyer: "celbowo" },
  { seller: "celbowo",   good: "kilof",     buyer: "darzlubie" },
  { seller: "domatowo",  good: "wiertarka", buyer: "brudzewo" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function buildGoodsByCities() {
  /** Returns Map<good, Set<sellerCity>> */
  const map = new Map();
  for (const { seller, good } of TRANSACTIONS) {
    if (!map.has(good)) map.set(good, new Set());
    map.get(good).add(seller);
  }
  return map;
}

async function apiCall(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: API_KEY, task: TASK, answer: payload }),
  });
  return res.json();
}

// ─── BATCH OPERATIONS ────────────────────────────────────────────────────────

function buildBatchOperations() {
  const ops = [];

  // 1. Reset filesystem to clean state
  ops.push({ action: "reset" });

  // 2. Create top-level directories
  for (const dir of ["miasta", "osoby", "towary"]) {
    ops.push({ action: "createDirectory", path: `/${dir}` });
  }

  // 3. /miasta/<city> — JSON of needs
  for (const [city, needs] of Object.entries(CITY_NEEDS)) {
    ops.push({
      action: "createFile",
      path: `/miasta/${city}`,
      content: JSON.stringify(needs),
    });
  }

  // 4. /osoby/<first_last> — person's full name + link to city file
  for (const [city, trader] of Object.entries(CITY_TRADERS)) {
    const fullName = `${trader.firstName} ${trader.lastName}`;
    const content = `${fullName}\n\n[${city}](/miasta/${city})`;
    ops.push({
      action: "createFile",
      path: `/osoby/${trader.filename}`,
      content,
    });
  }

  // 5. /towary/<good> — links to cities that sell this good
  const goodsMap = buildGoodsByCities();
  for (const [good, sellers] of goodsMap) {
    const links = [...sellers]
      .map((city) => `[${city}](/miasta/${city})`)
      .join("\n");
    ops.push({
      action: "createFile",
      path: `/towary/${good}`,
      content: links,
    });
  }

  return ops;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== S04E04 Filesystem Task ===\n");

  const ops = buildBatchOperations();
  console.log(`Sending ${ops.length} batch operations (reset + dirs + files)…`);

  // Send batch (reset first, then creates)
  // Note: reset must be separate — it clears everything, so we split:
  //   1. reset call
  //   2. everything else

  const resetResult = await apiCall({ action: "reset" });
  console.log("Reset:", JSON.stringify(resetResult));

  const buildOps = ops.filter((o) => o.action !== "reset");
  console.log(`Building filesystem with ${buildOps.length} operations…`);
  const buildResult = await apiCall(buildOps);
  console.log("Build result:", JSON.stringify(buildResult, null, 2));

  // Verify
  console.log("\nListing root…");
  const listRoot = await apiCall({ action: "listFiles", path: "/" });
  console.log(JSON.stringify(listRoot, null, 2));

  // Submit
  console.log("\nSubmitting for verification…");
  const doneResult = await apiCall({ action: "done" });
  console.log("DONE result:", JSON.stringify(doneResult, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
