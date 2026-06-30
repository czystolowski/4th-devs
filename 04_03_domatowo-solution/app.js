/**
 * S04E03 — Domatowo Rescue Mission
 *
 * Objective: Locate a partisan hiding in the ruins of Domatowo and evacuate them
 * with a helicopter before running out of action points.
 *
 * Intel summary (intercepted radio signal):
 *   "I survived. Bombs destroyed the city. Soldiers were here, looking for resources,
 *    they took the oil. Now it's empty. I have a weapon, I'm wounded. I hid in one of
 *    the tallest apartment blocks. I have no food. Help."
 *
 * Map (11×11, columns A–K, rows 1–11):
 *   - block3 (B3, "Blok 3p") = tallest 3-floor buildings → where the partisan hides
 *   - 14 block3 tiles in 3 clusters:
 *       Cluster 1 (top):          F1, G1, F2, G2
 *       Cluster 2 (bottom-left):  A10, B10, C10, A11, B11, C11
 *       Cluster 3 (bottom-right): H10, I10, H11, I11
 *
 * Optimal strategy:
 *   Budget: 300 points. Estimated spend: ~163 points.
 *
 *   1. Create one transporter carrying 3 scouts (cost: 5 + 3×5 = 20 pts)
 *      — all spawn at slot A6 (main horizontal road)
 *   2. Drive transporter A6 → E2 via road network (8 steps = 8 pts)
 *   3. Dismount Scout-1 at E2, scout covers Cluster 1 (F1,G1,F2,G2)
 *      — walks: E2→F2→F1→G1→G2 (4 moves = 28 pts, 4 inspects = 4 pts)
 *   4. Drive transporter E2 → B9 (10 steps = 10 pts)
 *   5. Dismount Scout-2 at B9, scout covers Cluster 2 (A10–C11)
 *      — walks: B9→A9→A10→A11→B11→C11→C10→B10 (7 moves = 49 pts, 6 inspects = 6 pts)
 *   6. Drive transporter B9 → H9 (6 steps = 6 pts)
 *   7. Dismount Scout-3 at H9, scout covers Cluster 3 (H10,I10,H11,I11)
 *      — walks: H9→H10→H11→I11→I10 (4 moves = 28 pts, 4 inspects = 4 pts)
 *   8. As soon as any scout confirms the partisan → callHelicopter
 *
 * Cost table:
 *   create transporter (3 pax): 5 + 3×5  =  20
 *   transport moves:             8+10+6   =  24
 *   scout walks:                 4+7+4    = 105  (×7 pts/step)
 *   inspections:                 4+6+4    =  14  (×1 pt each)
 *   ─────────────────────────────────────────────
 *   TOTAL (worst case):                   = 163 pts  (budget 300)
 *
 * Resilience patterns applied (lesson S04E03):
 *   - Retry with exponential back-off + jitter for transient API errors
 *   - Schema validation on every API response
 *   - Early-exit on partisan found (no wasted inspections)
 *   - DLQ-style failed-action tracking for post-mortem debugging
 *
 * Run from this directory:
 *   node app.js
 */

import '../config.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const HUB_URL   = 'https://hub.ag3nts.org/verify';
const TASK      = 'domatowo';
const API_KEY   = process.env.AGENT_TOKEN?.trim() ?? '';

if (!API_KEY) {
  console.error('❌  AGENT_TOKEN is not set. Add it to your root .env file.');
  process.exit(1);
}

// ── HTTP / retry helpers ──────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call the Domatowo API with exponential back-off + decorrelated jitter.
 * Only retries on transient errors (network, 5xx); never on 4xx.
 *
 * @param {object} answer  - The "answer" payload
 * @param {object} [opts]
 * @param {number} [opts.maxAttempts=4]
 * @param {number} [opts.baseDelayMs=500]
 * @returns {Promise<object>}
 */
async function api(answer, { maxAttempts = 4, baseDelayMs = 500 } = {}) {
  let lastError;
  let delay = baseDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(HUB_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apikey: API_KEY, task: TASK, answer }),
      });

      // 4xx → permanent failure, do NOT retry
      if (res.status >= 400 && res.status < 500) {
        const text = await res.text();
        throw Object.assign(
          new Error(`HTTP ${res.status} (permanent): ${text}`),
          { permanent: true }
        );
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();

    } catch (err) {
      lastError = err;

      if (err.permanent || attempt === maxAttempts) break;

      // Decorrelated jitter: next delay = random between baseDelay and 3×current
      const jitter = Math.random() * (3 * delay - baseDelayMs) + baseDelayMs;
      console.warn(
        `  ⚠️  API call failed (attempt ${attempt}/${maxAttempts}): ${err.message}. ` +
        `Retrying in ${Math.round(jitter)}ms…`
      );
      await sleep(jitter);
      delay = Math.min(delay * 2, 8000); // cap at 8 s
    }
  }

  throw lastError;
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Assert that a response has an expected structure.
 * Throws a descriptive error if validation fails.
 *
 * @param {object} res      - Parsed API response
 * @param {string} context  - Human-readable label for error messages
 * @param {string[]} fields - Required top-level fields
 */
function assertFields(res, context, fields) {
  for (const field of fields) {
    if (res[field] === undefined || res[field] === null) {
      throw new Error(
        `Schema validation failed for "${context}": missing field "${field}". ` +
        `Response: ${JSON.stringify(res)}`
      );
    }
  }
}

// ── Failed-action tracker (lightweight DLQ) ───────────────────────────────────

const failedActions = [];

function recordFailure(label, payload, error) {
  failedActions.push({ timestamp: new Date().toISOString(), label, payload, error: error.message });
}

// ── Mission actions ───────────────────────────────────────────────────────────

/**
 * Reset board to a clean state.
 */
async function resetBoard() {
  const res = await api({ action: 'reset' });
  assertFields(res, 'reset', ['code', 'status']);
  if (res.status !== 'ok') throw new Error(`Reset failed: ${res.message}`);
  return res;
}

/**
 * Create a transporter with the given number of passengers (scouts).
 *
 * @param {number} passengers - 1–4
 * @returns {Promise<object>} API response with unit hash(es)
 */
async function createTransporter(passengers) {
  const res = await api({ action: 'create', type: 'transporter', passengers });
  assertFields(res, 'create transporter', ['code', 'message']);
  return res;
}

/**
 * Move a unit (transporter or scout) to a target cell.
 *
 * @param {string} hash   - Unit identifier
 * @param {string} where  - Destination, e.g. "E2"
 */
async function moveUnit(hash, where) {
  const res = await api({ action: 'move', object: hash, where });
  assertFields(res, `move ${hash} → ${where}`, ['code', 'message']);
  return res;
}

/**
 * Dismount passengers from a transporter.
 *
 * @param {string} hash        - Transporter identifier
 * @param {number} passengers  - Number to dismount
 */
async function dismount(hash, passengers) {
  const res = await api({ action: 'dismount', object: hash, passengers });
  assertFields(res, `dismount from ${hash}`, ['code', 'message']);
  return res;
}

/**
 * Inspect the current field of a scout.
 *
 * @param {string} hash - Scout identifier
 * @returns {Promise<object>}
 */
async function inspect(hash) {
  const res = await api({ action: 'inspect', object: hash });
  assertFields(res, `inspect ${hash}`, ['code', 'message']);
  return res;
}

/**
 * Return all units currently on the board.
 */
async function getObjects() {
  const res = await api({ action: 'getObjects' });
  assertFields(res, 'getObjects', ['code']);
  return res;
}

/**
 * Return all inspection logs.
 */
async function getLogs() {
  const res = await api({ action: 'getLogs' });
  assertFields(res, 'getLogs', ['code']);
  return res;
}

/**
 * Return current action-point expenditure.
 */
async function getExpenses() {
  const res = await api({ action: 'expenses' });
  assertFields(res, 'expenses', ['code']);
  return res;
}

/**
 * Call evacuation helicopter to a confirmed location.
 *
 * @param {string} destination - Grid cell, e.g. "F2"
 */
async function callHelicopter(destination) {
  const res = await api({ action: 'callHelicopter', destination });
  assertFields(res, 'callHelicopter', ['code', 'message']);
  return res;
}

// ── Unit extraction ───────────────────────────────────────────────────────────

/**
 * Extract unit hashes directly from the creation response.
 * The API returns `object` (transporter hash) and `crew[].id` (scout IDs).
 *
 * @param {object} createRes - Response from createTransporter()
 * @param {string} spawn     - Spawn cell for log display
 * @returns {{ tHash: string, scoutHashes: string[] }}
 */
function extractUnitsFromCreate(createRes, spawn) {
  const tHash = createRes.object;
  if (!tHash) throw new Error('Transporter hash missing from create response');

  const crew = createRes.crew ?? [];
  if (crew.length < 3) {
    throw new Error(`Expected ≥3 crew members, got ${crew.length}`);
  }

  const scoutHashes = crew.map((c) => c.id ?? c.hash);
  return { tHash, scoutHashes, spawn: createRes.spawn ?? spawn };
}

// ── Partisan detection ────────────────────────────────────────────────────────

/**
 * Detect a positive partisan-found message from the inspection log entry.
 *
 * Strategy: positive messages always describe the person (contain "Mężczyzna" or
 * "Kobieta" in Polish), whereas ALL negative messages only describe the empty room.
 * As an additional safety net, also match confirmed positive phrase prefixes.
 *
 * Confirmed positive messages observed:
 *   "Poszukiwany odnaleziony. Mężczyzna po trzydziestce, schowany w szafie technicznej."
 *   "Jest kontakt. Mężczyzna, około 30 lat, próbował przeczekać w schowku na parterze."
 *   "Kontakt potwierdzony. Mężczyzna około 30 lat, ukrywał się na parterze za ladą."
 */
function isPositiveFinding(text) {
  if (!text) return false;
  const t = text.toLowerCase();

  // Direct person-description keywords — appear ONLY in positive messages
  if (t.includes('mężczyzna') || t.includes('kobieta') || t.includes('mezczyzna')) return true;

  // Confirmed positive-contact phrase prefixes
  if (
    t.startsWith('poszukiwany') ||
    t.startsWith('jest kontakt') ||
    t.startsWith('kontakt potwierdzony') ||
    t.startsWith('znalazłem człowieka') ||
    t.startsWith('znalazłem osobę') ||
    t.includes('kontakt z osobą')
  ) return true;

  // English fallbacks
  if (
    t.includes('found the human') ||
    t.includes('found survivor') ||
    t.includes('partisan located') ||
    t.includes('contact confirmed')
  ) return true;

  return false;
}

function detectPartisan(logs) {
  if (!Array.isArray(logs)) return null;

  for (const entry of logs) {
    // API response uses `msg`; check common aliases as fallback
    const text = entry.msg ?? entry.message ?? entry.log ?? entry.result ?? '';

    if (entry.found === true || isPositiveFinding(text)) {
      // `field` is the position key confirmed from live API
      return entry.field ?? entry.position ?? null;
    }
  }
  return null;
}

// ── Scout patrol helpers ──────────────────────────────────────────────────────

/**
 * Walk a scout along an ordered list of cells, inspecting each one.
 * Returns immediately if any inspection reveals the partisan.
 *
 * @param {string}   hash         - Scout identifier
 * @param {string[]} cells        - Ordered cells to visit (not including start)
 * @param {string}   label        - Human-readable cluster name for logging
 * @returns {Promise<string|null>} Partisan's position or null
 */
async function patrolCluster(hash, cells, label) {
  console.log(`\n  🔍 Scout [${hash.slice(0, 8)}…] patrolling ${label} (${cells.length} cells)`);

  for (const cell of cells) {
    // Move to cell
    try {
      const moveRes = await moveUnit(hash, cell);
      console.log(`    → move to ${cell}: ${moveRes.message}`);
    } catch (err) {
      recordFailure(`move scout to ${cell}`, { hash, cell }, err);
      console.error(`    ✗ move to ${cell} failed: ${err.message}`);
      continue; // best-effort: skip cell, don't abort mission
    }

    // Inspect
    try {
      await inspect(hash);

      // Fetch updated logs — the actual result is in the log entry (API says "check logs")
      const logsRes = await getLogs();
      const logs    = logsRes.logs ?? logsRes.entries ?? [];

      // Display the most recent log entry for this cell
      const latestEntry = logs.slice().reverse().find((e) => e.field === cell);
      if (latestEntry) {
        console.log(`    🔭 inspect ${cell}: ${latestEntry.msg ?? latestEntry.message}`);
      }

      const found = detectPartisan(logs);
      if (found) {
        console.log(`\n  🎯 PARTISAN CONFIRMED at ${found}!`);
        return found;
      }
    } catch (err) {
      recordFailure(`inspect at ${cell}`, { hash, cell }, err);
      console.error(`    ✗ inspect at ${cell} failed: ${err.message}`);
    }
  }

  return null;
}

// ── Main mission orchestration ────────────────────────────────────────────────

async function main() {
  console.log('🚁  Domatowo Rescue Mission — S04E03');
  console.log('='.repeat(54));
  console.log('📡 Intercepted signal: partisan hiding in a tallest block');
  console.log('🗺️  Target: 14 block3 tiles across 3 clusters\n');

  // ── Phase 0: Reset board ──────────────────────────────────────────────────
  console.log('Phase 0: Resetting board…');
  const resetRes = await resetBoard();
  console.log(`  ✓ ${resetRes.message}`);

  // ── Phase 1: Deploy transporter + 3 scouts ────────────────────────────────
  console.log('\nPhase 1: Deploying transporter with 3 scouts…');
  const createRes = await createTransporter(3);
  console.log(`  ✓ ${createRes.message}`);

  const { tHash, scoutHashes, spawn } = extractUnitsFromCreate(createRes, 'A6');
  const [s1, s2, s3] = scoutHashes;

  console.log(`  🚛 Transporter: [${tHash.slice(0, 8)}…] spawned at ${spawn}`);
  console.log(`  🪖 Scout-1:     [${s1.slice(0, 8)}…]`);
  console.log(`  🪖 Scout-2:     [${s2.slice(0, 8)}…]`);
  console.log(`  🪖 Scout-3:     [${s3.slice(0, 8)}…]`);

  // Track partisan position; once found all remaining ops are skipped
  let partisanAt = null;

  // ── Phase 2: Drive to Cluster 1 (F1,G1,F2,G2) ────────────────────────────
  console.log('\nPhase 2: Drive to Cluster 1 area (top-right, F1–G2)…');
  console.log('  Route: A6→B6→C6→D6→D5→D4→D3→D2→E2  (8 road steps)');
  const moveT1 = await moveUnit(tHash, 'E2');
  console.log(`  ✓ ${moveT1.message}`);

  console.log('  Dismounting Scout-1 at E2…');
  await dismount(tHash, 1);

  // Scout-1 patrols: E2→F2→F1→G1→G2
  const cluster1Cells = ['F2', 'F1', 'G1', 'G2'];
  partisanAt = await patrolCluster(s1, cluster1Cells, 'Cluster 1 (F1,G1,F2,G2)');

  // ── Phase 3: Drive to Cluster 2 (A10–C11) ────────────────────────────────
  if (!partisanAt) {
    console.log('\nPhase 3: Drive to Cluster 2 area (bottom-left, A10–C11)…');
    console.log('  Route: E2→D2→D3→D4→D5→D6→D7→D8→D9→C9→B9  (10 road steps)');
    const moveT2 = await moveUnit(tHash, 'B9');
    console.log(`  ✓ ${moveT2.message}`);

    console.log('  Dismounting Scout-2 at B9…');
    await dismount(tHash, 1);

    // Scout-2 patrols: B9→A9→A10→A11→B11→C11→C10→B10
    const cluster2Cells = ['A9', 'A10', 'A11', 'B11', 'C11', 'C10', 'B10'];
    partisanAt = await patrolCluster(s2, cluster2Cells, 'Cluster 2 (A10–C11)');
  }

  // ── Phase 4: Drive to Cluster 3 (H10–I11) ────────────────────────────────
  if (!partisanAt) {
    console.log('\nPhase 4: Drive to Cluster 3 area (bottom-right, H10–I11)…');
    console.log('  Route: B9→C9→D9→E9→F9→G9→H9  (6 road steps)');
    const moveT3 = await moveUnit(tHash, 'H9');
    console.log(`  ✓ ${moveT3.message}`);

    console.log('  Dismounting Scout-3 at H9…');
    await dismount(tHash, 1);

    // Scout-3 patrols: H9→H10→H11→I11→I10
    const cluster3Cells = ['H10', 'H11', 'I11', 'I10'];
    partisanAt = await patrolCluster(s3, cluster3Cells, 'Cluster 3 (H10–I11)');
  }

  // ── Phase 5: Helicopter evacuation ────────────────────────────────────────
  if (!partisanAt) {
    // Paranoia check: scan all logs one final time
    const logsRes  = await getLogs();
    const logs     = logsRes.logs ?? logsRes.entries ?? [];
    partisanAt     = detectPartisan(logs);
  }

  if (!partisanAt) {
    throw new Error(
      'Partisan NOT found after exhaustive search of all 14 block3 tiles. ' +
      'Check failed-actions log for details.'
    );
  }

  console.log(`\nPhase 5: Calling helicopter to ${partisanAt}…`);
  const heliRes = await callHelicopter(partisanAt);
  console.log(`  ✓ ${heliRes.message}`);

  // ── Phase 6: Results ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(54));

  const flag = heliRes.message?.match(/\{FLG:[^}]+\}/)?.[0] ?? heliRes.flag;
  if (flag) {
    console.log(`\n🚩 FLAG: ${flag}`);
    console.log('✅ Mission accomplished — partisan evacuated!\n');
  } else if (heliRes.code === 0) {
    console.log(`\n✅ Helicopter dispatched successfully.`);
    if (heliRes.message) console.log(`   Response: ${heliRes.message}`);
  } else {
    console.warn('\n⚠️  Unexpected helicopter response:');
    console.log(JSON.stringify(heliRes, null, 2));
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────
  console.log('\n📊 Mission diagnostics:');
  const expRes = await getExpenses();
  const spent  = (expRes.expenses ?? expRes.history ?? []).reduce(
    (sum, e) => sum + (e.cost ?? 0), 0
  );
  console.log(`  Action points spent: ${spent} / 300`);
  console.log(`  Remaining:           ${300 - spent} pts`);

  if (failedActions.length) {
    console.warn(`\n⚠️  Failed actions (DLQ — ${failedActions.length} entries):`);
    for (const entry of failedActions) {
      console.warn(`  [${entry.timestamp}] ${entry.label}: ${entry.error}`);
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  if (failedActions.length) {
    console.error(`\nFailed-action queue (${failedActions.length} entries):`);
    for (const f of failedActions) {
      console.error(`  ${f.label}: ${f.error}`);
    }
  }
  process.exit(1);
});
