/**
 * S04E05 – Food Warehouse Task
 *
 * Strategy:
 *  1. Fetch city needs from food4cities.json
 *  2. Query the SQLite DB for destination codes (city name → destination_id)
 *  3. Pick a single creator (user_id=1, login=azurek) to sign every order
 *  4. For each city:
 *     a. Generate a signature via signatureGenerator
 *     b. Create the order (title, creatorID, destination, signature)
 *     c. Append all required items in one batch call
 *  5. Call "done" to trigger final validation and retrieve the flag
 */

import { AGENT_TOKEN } from "../config.js";

const HUB_URL = "https://hub.ag3nts.org/verify";
const FOOD_URL = "https://hub.ag3nts.org/dane/food4cities.json";

// Creator we use for every order — must have role 2 ("Obsługa transportów")
// user_id=2, login=tgajewski, birthday=1991-04-06, role=2
const CREATOR_ID = 2;
const CREATOR_LOGIN = "tgajewski";
const CREATOR_BIRTHDAY = "1991-04-06";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function hubCall(answer) {
  const res = await fetch(HUB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: AGENT_TOKEN, task: "foodwarehouse", answer }),
  });
  const data = await res.json();
  return data;
}

async function hubCallWithRetry(answer, retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await hubCall(answer);
    if (result.code !== -9999) return result;
    const waitMs = delayMs * attempt; // exponential backoff
    console.log(`  Rate limited, waiting ${waitMs}ms before retry ${attempt}/${retries}...`);
    await sleep(waitMs);
  }
  throw new Error("Rate limit retries exhausted");
}

async function dbQuery(query) {
  const result = await hubCallWithRetry({ tool: "database", query });
  if (result.code !== 170 && result.code !== 160 && result.code !== 150) {
    throw new Error(`DB query failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function generateSignature(login, birthday, destination) {
  const result = await hubCallWithRetry({
    tool: "signatureGenerator",
    action: "generate",
    login,
    birthday,
    destination,
  });
  if (result.code !== 130) throw new Error(`Signature generation failed: ${JSON.stringify(result)}`);
  return result.hash;
}

async function createOrder(title, creatorID, destination, signature) {
  const result = await hubCallWithRetry({
    tool: "orders",
    action: "create",
    title,
    creatorID,
    destination,
    signature,
  });
  // API returns code 110 on success
  if (result.code !== 110 && result.code !== 102) throw new Error(`Order creation failed: ${JSON.stringify(result)}`);
  const id = result.order?.id ?? result.id;
  console.log(`  Created order id=${id} for destination=${destination}`);
  return id;
}

async function appendItems(id, items) {
  const result = await hubCallWithRetry({ tool: "orders", action: "append", id, items });
  // API returns code 120 on success
  if (result.code !== 120 && result.code !== 103) throw new Error(`Append items failed: ${JSON.stringify(result)}`);
  return result;
}

async function resetOrders() {
  const result = await hubCallWithRetry({ tool: "reset" });
  console.log("Reset result:", result.message);
}

async function deleteOrder(id) {
  const result = await hubCallWithRetry({ tool: "orders", action: "delete", id });
  return result;
}

async function getOrders() {
  const result = await hubCallWithRetry({ tool: "orders", action: "get" });
  return result.orders ?? [];
}

async function loadDestinations() {
  // Fetch all 40 destinations (two pages of 30)
  const page1 = await dbQuery("select * from destinations LIMIT 30 OFFSET 0");
  const page2 = await dbQuery("select * from destinations LIMIT 30 OFFSET 30");
  const allRows = [...(page1.rows ?? []), ...(page2.rows ?? [])];
  // Build lowercase-name → destination_id map
  const map = {};
  for (const row of allRows) {
    map[row.name.toLowerCase()] = row.destination_id;
  }
  return map;
}

async function loadCityNeeds() {
  const res = await fetch(FOOD_URL);
  return res.json(); // { opalino: {chleb:45, woda:120, mlotek:6}, ... }
}

async function main() {
  console.log("=== Food Warehouse Solution ===\n");

  // 1. Reset to clean state
  console.log("→ Resetting orders to initial state...");
  await resetOrders();

  // 2. Load city needs
  console.log("→ Loading city needs from food4cities.json...");
  const cityNeeds = await loadCityNeeds();
  const cities = Object.keys(cityNeeds);
  console.log(`  Found ${cities.length} cities: ${cities.join(", ")}\n`);

  // 3. Load destination map
  console.log("→ Loading destinations from DB...");
  const destMap = await loadDestinations();

  // Verify all cities have matching destinations
  for (const city of cities) {
    if (!destMap[city]) {
      throw new Error(`No destination found for city: "${city}". Available: ${Object.keys(destMap).join(", ")}`);
    }
  }
  console.log("  All city destinations resolved.\n");

  // 3b. Delete any pre-existing seeded orders that don't belong to our cities
  console.log("→ Removing pre-existing seeded orders...");
  const existingOrders = await getOrders();
  const validDestinations = new Set(cities.map((c) => destMap[c]));
  for (const order of existingOrders) {
    if (!validDestinations.has(order.destination)) {
      console.log(`  Deleting seeded order id=${order.id} (${order.title})`);
      await deleteOrder(order.id);
    }
  }

  // 4. Process each city
  const results = [];
  for (const city of cities) {
    const destinationId = destMap[city];
    const needs = cityNeeds[city];
    const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);

    console.log(`→ Processing ${cityLabel} (destination=${destinationId})...`);
    console.log(`  Items needed:`, needs);

    // 4a. Generate signature
    const signature = await generateSignature(CREATOR_LOGIN, CREATOR_BIRTHDAY, destinationId);
    console.log(`  Signature: ${signature}`);

    // 4b. Create order (small pause to avoid rate limiting)
    await sleep(500);
    const orderId = await createOrder(
      `Dostawa dla ${cityLabel}`,
      CREATOR_ID,
      destinationId,
      signature
    );

    // 4c. Append all items in one batch call
    await sleep(500);
    await appendItems(orderId, needs);
    console.log(`  Items appended successfully.\n`);

    results.push({ city, destinationId, orderId, signature });
  }

  // 5. Summary
  console.log("=== Orders Summary ===");
  for (const r of results) {
    console.log(`  ${r.city} → orderId=${r.orderId}, destination=${r.destinationId}`);
  }

  // 6. Verify current orders before calling done
  console.log("\n→ Verifying current orders...");
  const ordersResult = await hubCall({ tool: "orders", action: "get" });
  console.log(`  Total orders: ${ordersResult.count}`);
  // Log order details for debugging
  for (const o of (ordersResult.orders ?? [])) {
    console.log(`    ${o.title} → dest=${o.destination}, items=${o.items.length}`);
  }

  // 7. Call done
  console.log("\n→ Calling done...");
  const doneResult = await hubCall({ tool: "done" });
  console.log("Done result:", JSON.stringify(doneResult, null, 2));

  if (doneResult.code === 200 && doneResult.flag) {
    console.log(`\n🎉 FLAG: ${doneResult.flag}`);
  } else if (doneResult.message) {
    console.log(`\nMessage: ${doneResult.message}`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
