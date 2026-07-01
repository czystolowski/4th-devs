/**
 * S05E01 — Radio Monitoring
 *
 * Pipeline
 * ────────
 * 1. Start a listening session on the hub.
 * 2. Repeatedly call "listen" until the pool is exhausted.
 * 3. For each signal, route it through the data router:
 *      TEXT / JSON  → accumulate in the text corpus (no LLM cost yet)
 *      IMAGE        → analyse with the vision model, accumulate description
 *      UNKNOWN_BINARY / NOISE → skip
 * 4. Once the pool is empty, send the full corpus to the text model and
 *    extract the four intelligence fields.
 * 5. Transmit the final report to the hub.
 *
 * Run from this directory:
 *   node app.js
 *
 * Why this approach is efficient
 * ───────────────────────────────
 * - Binary data is decoded locally first; we never Base64-blast a raw payload
 *   into an LLM prompt.
 * - Images are routed to gpt-4o only when necessary.
 * - All text signals are batched into a single gpt-4o-mini call at the end.
 * - Noise signals are filtered deterministically — zero LLM cost.
 */

import { startSession, listenNext, transmitReport } from './src/helpers/api.js';
import { routeSignal, signalSummary, isEndOfPool } from './src/router.js';
import { analyseImage, transcribeAudio, extractIntelligence } from './src/analyze.js';

// ── Config ─────────────────────────────────────────────────────────────────

/** Maximum listen calls in one run (safety cap — avoids infinite loops). */
const MAX_SIGNALS = 200;

/** Delay between consecutive listen calls (ms) to be a polite client. */
const LISTEN_DELAY_MS = 300;

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad(n, width = 3) {
  return String(n).padStart(width, ' ');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('📡  Radio Monitoring — S05E01');
  console.log('='.repeat(52));

  // ── Step 1: Start session ──────────────────────────────────────────────
  console.log('\n🔌 Step 1: Starting listening session…');
  const startResult = await startSession();
  console.log(`  ✓ ${signalSummary(startResult)}`);

  // ── Step 2: Listen loop ────────────────────────────────────────────────
  console.log('\n📻 Step 2: Intercepting signals…');

  const textCorpus  = [];   // TEXT and JSON signal content
  const imageNotes  = [];   // vision model descriptions of IMAGE signals
  let   signalCount = 0;
  let   noiseCount  = 0;
  let   done        = false;

  while (!done && signalCount < MAX_SIGNALS) {
    await sleep(LISTEN_DELAY_MS);

    const raw     = await listenNext();
    const routed  = routeSignal(raw);
    signalCount++;

    const prefix = `  [${pad(signalCount)}]`;

    // Check end-of-pool BEFORE processing content
    if (isEndOfPool(raw)) {
      console.log(`${prefix} 🛑 End of pool — ${signalSummary(raw)}`);
      done = true;
      // Still process any content in the final message
    }

    switch (routed.type) {
      case 'TEXT':
        textCorpus.push(routed.text);
        console.log(`${prefix} 📝 TEXT   (${routed.text.length} chars) — "${routed.text.slice(0, 80).replace(/\n/g, ' ')}…"`);
        break;

      case 'JSON':
        textCorpus.push(routed.text);
        console.log(`${prefix} 🗃️  JSON   (${routed.text.length} chars)`);
        break;

      case 'IMAGE':
        console.log(`${prefix} 🖼️  IMAGE  (${routed.imageMime}) — analysing with vision model…`);
        try {
          const description = await analyseImage(routed.imageBase64, routed.imageMime);
          imageNotes.push(description);
          console.log(`         ↳ "${description.slice(0, 120).replace(/\n/g, ' ')}…"`);
        } catch (err) {
          console.warn(`         ↳ ⚠ Vision model error: ${err.message}`);
        }
        break;

      case 'AUDIO':
        console.log(`${prefix} 🔊 AUDIO  (${routed.audioMime}, ${routed.audioBuf.length} bytes) — transcribing…`);
        try {
          const transcript = await transcribeAudio(routed.audioBuf, routed.audioMime);
          if (transcript) {
            textCorpus.push(`[AUDIO TRANSCRIPT]\n${transcript}`);
            console.log(`         ↳ "${transcript.slice(0, 120).replace(/\n/g, ' ')}"`);
          } else {
            console.warn(`         ↳ ⚠ Audio transcription unavailable (set OPENAI_API_KEY or top up OpenRouter ≥ $0.50)`);
          }
        } catch (err) {
          console.warn(`         ↳ ⚠ Audio transcription error: ${err.message}`);
        }
        break;

      case 'UNKNOWN_BINARY':
        console.log(`${prefix} 🔒 UNKNOWN BINARY — skipping (filesize: ${raw.filesize ?? '?'})`);
        break;

      case 'NOISE':
      default:
        noiseCount++;
        // Don't print noise unless it has a message worth logging
        if (raw.message && raw.message !== 'Signal captured.') {
          console.log(`${prefix} 〰️  NOISE  — ${signalSummary(raw)}`);
        }
        break;
    }

    if (done) break;
  }

  if (signalCount >= MAX_SIGNALS) {
    console.warn(`\n⚠️  Reached MAX_SIGNALS cap (${MAX_SIGNALS}). Processing what we have.`);
  }

  console.log(`\n  Summary: ${signalCount} signals total, ${noiseCount} noise, ${textCorpus.length} text, ${imageNotes.length} images`);

  if (textCorpus.length === 0 && imageNotes.length === 0) {
    console.error('\n❌ No usable signals collected. Cannot produce a report.');
    process.exit(1);
  }

  // ── Step 3: Extract intelligence ──────────────────────────────────────
  console.log('\n🧠 Step 3: Extracting intelligence from corpus…');
  const intel = await extractIntelligence(textCorpus, imageNotes);

  console.log('\n  Extracted fields:');
  console.log(`    cityName        : ${intel.cityName}`);
  console.log(`    cityArea        : ${intel.cityArea}`);
  console.log(`    warehousesCount : ${intel.warehousesCount}`);
  console.log(`    phoneNumber     : ${intel.phoneNumber}`);

  // Validate completeness before transmitting
  const missing = ['cityName', 'cityArea', 'warehousesCount', 'phoneNumber']
    .filter((k) => intel[k] == null);

  if (missing.length > 0) {
    console.error(`\n❌ Missing fields: ${missing.join(', ')}. Cannot transmit incomplete report.`);
    console.error('  Review the collected signals in the log above and try again.');
    process.exit(1);
  }

  // ── Step 4: Transmit report ────────────────────────────────────────────
  console.log('\n📤 Step 4: Transmitting final report to the hub…');

  const report = {
    cityName:        intel.cityName,
    cityArea:        String(intel.cityArea),
    warehousesCount: Number(intel.warehousesCount),
    phoneNumber:     String(intel.phoneNumber),
  };

  const result = await transmitReport(report);
  console.log(`  Response: [${result.code}] ${result.message}`);

  // Extract flag if present
  const flag = result.message?.match(/\{FLG:[^}]+\}/)?.[0];
  if (flag || result.code === 0) {
    console.log(`\n🚩 FLAG: ${flag ?? result.message}`);
    console.log('✅ Mission accomplished — Syjon located!\n');
  } else {
    console.error(`\n❌ Verification failed (code ${result.code}): ${result.message}`);
    console.error('  Dump of transmitted report:', JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
