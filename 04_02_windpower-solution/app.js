/**
 * S04E02 — Wind Turbine Scheduler (windpower)
 *
 * Goal: Program a wind turbine schedule within a 40-second service window.
 *
 * Turbine spec (from /documentation):
 *   - Rated power: 14 kW
 *   - Storm cutoff: >14 m/s → pitch 90°, turbineMode idle (protection)
 *   - Min wind for production: 4 m/s
 *   - Pitch 0° = 100% yield, pitch 45° = 65%, pitch 90° = 0%
 *   - Wind yield (interpolated): 4 m/s≈12.5%, 6 m/s≈35%, 8 m/s≈65%, 10 m/s≈95%, ≥12 m/s≈100%
 *   - Turbine resets ~1h after each storm → may need multiple storm-protection points
 *
 * Time-budget analysis (40s window):
 *   ~0s   – start + queue weather + powerplantcheck in parallel
 *   ~24s  – weather arrives (slowest; powerplantcheck finishes earlier)
 *   ~24s  – analyse → queue N unlock codes in parallel
 *   ~26s  – collect codes → submit bulk config
 *   ~26s  – queue turbinecheck (just needs to be queued, not collected) → done
 *   ~26s  – flag returned ✓
 *
 * Critical optimizations:
 *   • Weather and powerplantcheck queued simultaneously at start
 *   • All unlock codes queued in parallel (not serial)
 *   • turbinecheck only needs to be QUEUED before done, not collected
 *   • Minimal polling interval (100ms) to reduce wasted time
 *
 * Run from this directory:
 *   node app.js
 */

import '../config.js';

// ── Config ────────────────────────────────────────────────────────────────────

const HUB_BASE  = 'https://hub.ag3nts.org';
const TASK_NAME = 'windpower';
const TOKEN     = process.env.AGENT_TOKEN?.trim() ?? '';

/** Above this wind speed (m/s) the turbine must be in storm-protection mode */
const STORM_CUTOFF_MS  = 14;
/** Below this wind speed (m/s) the turbine cannot generate electricity */
const MIN_WIND_MS      = 4;
/** Turbine rated power at 100% yield (kW) */
const TURBINE_RATED_KW = 14;

if (!TOKEN) {
  console.error('❌  AGENT_TOKEN is not set. Add it to your root .env file.');
  process.exit(1);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function post(path, body) {
  const url = `${HUB_BASE}${path}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ apikey: TOKEN, ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${text}`);
  }
  return res.json();
}

const api = (answer) => post('/verify', { task: TASK_NAME, answer });

// ── Polling helper ────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll getResult until `count` items arrive. Returns them in arrival order.
 * Uses a tight 100ms back-off to keep within the 40s service window.
 */
async function collectResults(count, timeoutMs = 35_000) {
  const results  = [];
  const deadline = Date.now() + timeoutMs;

  while (results.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${count} results (got ${results.length})`);
    }
    const res = await api({ action: 'getResult' });
    if (res.sourceFunction) {
      results.push(res);
    } else {
      await sleep(100);
    }
  }

  return results;
}

// ── Power estimation ──────────────────────────────────────────────────────────

/**
 * Wind yield fraction (0–1) via linear interpolation between breakpoints.
 *
 * Breakpoints (midpoints of documented percentage ranges):
 *   0 m/s  →   0 %
 *   4 m/s  → 12.5%
 *   6 m/s  →  35 %
 *   8 m/s  →  65 %
 *  10 m/s  →  95 %
 * ≥12 m/s  → 100 %
 */
const WIND_BREAKPOINTS = [
  { ms: 0,  frac: 0     },
  { ms: 4,  frac: 0.125 },
  { ms: 6,  frac: 0.35  },
  { ms: 8,  frac: 0.65  },
  { ms: 10, frac: 0.95  },
  { ms: 12, frac: 1.00  },
];

function windYieldFraction(windMs) {
  if (windMs <= 0) return 0;
  for (let i = 1; i < WIND_BREAKPOINTS.length; i++) {
    const lo = WIND_BREAKPOINTS[i - 1];
    const hi = WIND_BREAKPOINTS[i];
    if (windMs <= hi.ms) {
      const t = (windMs - lo.ms) / (hi.ms - lo.ms);
      return lo.frac + t * (hi.frac - lo.frac);
    }
  }
  return 1.0;
}

/** Estimated output power (kW) at pitch 0° for a given wind speed */
const estimatedKw = (windMs) => TURBINE_RATED_KW * windYieldFraction(windMs);

// ── Config builder ────────────────────────────────────────────────────────────

/**
 * Parse the API's power deficit string (e.g. "2-3", "3-4") and return the
 * minimum value — the turbine must produce AT LEAST this many kW.
 */
function parseDeficitMin(deficitStr) {
  if (typeof deficitStr === 'number') return deficitStr;
  return parseFloat(String(deficitStr).split('-')[0]);
}

/**
 * Build the scheduling config points from the weather forecast:
 *
 * 1. Every storm slot (wind > 14 m/s): pitch 90°, mode idle  (protection)
 * 2. First non-storm slot where pitch-0° output ≥ required kW: pitch 0°, mode production
 *
 * Returns an array of `{ date, time, windMs, pitchAngle, turbineMode }` objects.
 */
function buildConfigPoints(forecast, deficitStr) {
  const requiredKw = parseDeficitMin(deficitStr);
  const points     = [];
  let productionScheduled = false;

  for (const slot of forecast) {
    const wind         = slot.windMs;
    const [date, time] = slot.timestamp.split(' ');

    if (wind > STORM_CUTOFF_MS) {
      points.push({ date, time, windMs: wind, pitchAngle: 90, turbineMode: 'idle' });
      continue;
    }

    if (!productionScheduled && wind >= MIN_WIND_MS && estimatedKw(wind) >= requiredKw) {
      points.push({ date, time, windMs: wind, pitchAngle: 0, turbineMode: 'production' });
      productionScheduled = true;
    }
  }

  if (!productionScheduled) {
    const best = Math.max(
      ...forecast
        .filter((s) => s.windMs >= MIN_WIND_MS && s.windMs <= STORM_CUTOFF_MS)
        .map((s) => estimatedKw(s.windMs))
    );
    throw new Error(
      `No production window found! Required: ${requiredKw} kW, best available: ${best.toFixed(2)} kW`
    );
  }

  return { points, requiredKw };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const t0      = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  console.log('🌬️  Wind Turbine Scheduler — S04E02');
  console.log('='.repeat(52));
  console.log('⏱️  Time limit: 40 seconds\n');

  // ── Phase 1: Start service window and queue async data requests ────────────
  console.log(`[${elapsed()}] Phase 1: Starting service window…`);
  const startRes = await api({ action: 'start' });
  console.log(`[${elapsed()}] ${startRes.message}`);

  // Queue weather and powerplantcheck simultaneously — weather takes ~24s so
  // fire these as early as possible.
  console.log(`[${elapsed()}] Queuing: weather + powerplantcheck (parallel)…`);
  await Promise.all([
    api({ action: 'get', param: 'weather' }),
    api({ action: 'get', param: 'powerplantcheck' }),
  ]);
  console.log(`[${elapsed()}] Both requests queued`);

  // ── Phase 2: Collect data results ─────────────────────────────────────────
  console.log(`\n[${elapsed()}] Phase 2: Collecting results (weather ≈24s)…`);
  const dataResults = await collectResults(2);

  const weatherResult    = dataResults.find((r) => r.sourceFunction === 'weather');
  const powerPlantResult = dataResults.find((r) => r.sourceFunction === 'powerplantcheck');

  if (!weatherResult || !powerPlantResult) {
    throw new Error(`Missing results. Got: ${dataResults.map((r) => r.sourceFunction).join(', ')}`);
  }

  const forecast   = weatherResult.forecast ?? weatherResult.data ?? [];
  const deficitStr = powerPlantResult.powerDeficitKw;

  console.log(`[${elapsed()}] ✓ Forecast slots: ${forecast.length}`);
  console.log(`[${elapsed()}] ✓ Power deficit: ${deficitStr} kW`);

  // ── Phase 3: Analyse forecast ─────────────────────────────────────────────
  console.log(`\n[${elapsed()}] Phase 3: Analysing forecast…`);
  const { points, requiredKw } = buildConfigPoints(forecast, deficitStr);

  console.log(`[${elapsed()}] Config points (${points.length}):`);
  for (const p of points) {
    const kw = p.turbineMode === 'production'
      ? `  ~${estimatedKw(p.windMs).toFixed(2)} kW  (required ≥ ${requiredKw} kW)`
      : '  (storm protection)';
    console.log(`  ${p.date} ${p.time}  wind=${p.windMs} m/s  pitch=${p.pitchAngle}°  ${p.turbineMode}${kw}`);
  }

  // ── Phase 4: Generate unlock codes in parallel ────────────────────────────
  console.log(`\n[${elapsed()}] Phase 4: Queuing ${points.length} unlock code requests (parallel)…`);
  await Promise.all(
    points.map((p) => api({
      action:     'unlockCodeGenerator',
      startDate:  p.date,
      startHour:  p.time,
      windMs:     p.windMs,
      pitchAngle: p.pitchAngle,
    }))
  );
  console.log(`[${elapsed()}] All unlock code requests queued`);

  const codeResults = await collectResults(points.length);
  console.log(`[${elapsed()}] ✓ Got ${codeResults.length} unlock codes`);

  // Build date-time → unlockCode lookup
  const codeByKey = {};
  for (const r of codeResults) {
    const { startDate, startHour } = r.signedParams;
    codeByKey[`${startDate} ${startHour}`] = r.unlockCode;
    console.log(`  ${startDate} ${startHour} → ${r.unlockCode}`);
  }

  // ── Phase 5: Submit bulk configuration ────────────────────────────────────
  console.log(`\n[${elapsed()}] Phase 5: Submitting bulk configuration…`);

  const configs = {};
  for (const p of points) {
    const key        = `${p.date} ${p.time}`;
    const unlockCode = codeByKey[key];
    if (!unlockCode) throw new Error(`No unlock code for config point ${key}`);
    configs[key] = { pitchAngle: p.pitchAngle, turbineMode: p.turbineMode, unlockCode };
  }

  const configRes = await api({ action: 'config', configs });
  console.log(`[${elapsed()}] Config: code=${configRes.code}  ${configRes.message}  stored=${configRes.storedPoints}`);

  if (configRes.code !== 10 && configRes.code !== 0) {
    throw new Error(`Config rejected: ${JSON.stringify(configRes)}`);
  }

  // ── Phase 6: Queue turbine check ──────────────────────────────────────────
  // The API requires turbinecheck to be queued before calling done.
  // We do NOT need to collect the result — done validates the config internally.
  console.log(`\n[${elapsed()}] Phase 6: Queuing turbine check…`);
  await api({ action: 'get', param: 'turbinecheck' });
  console.log(`[${elapsed()}] Turbine check queued`);

  // ── Phase 7: Done ─────────────────────────────────────────────────────────
  console.log(`\n[${elapsed()}] Phase 7: Sending done…`);
  const doneRes = await api({ action: 'done' });
  console.log(`[${elapsed()}] Response: code=${doneRes.code}  elapsed=${doneRes.elapsedSeconds}s`);

  const flag = doneRes.message?.match(/\{FLG:[^}]+\}/)?.[0] ?? doneRes.flag;
  if (flag) {
    console.log(`\n🚩 FLAG: ${flag}`);
    console.log('✅ Mission accomplished — turbine configured and power production scheduled!\n');
  } else if (doneRes.code === 0) {
    console.log(`\n✅ Success: ${doneRes.message}\n`);
  } else {
    console.warn('\n⚠️  Unexpected response from done:');
    console.log(JSON.stringify(doneRes, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
