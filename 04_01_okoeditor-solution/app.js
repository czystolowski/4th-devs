/**
 * S04E01 — OKO Editor
 *
 * Cover up the Skolwin rocket incident by making three precise edits to the
 * OKO operational monitoring centre, using the hub backend API (not the web UI).
 *
 * Steps
 * ─────
 * 1. Log in to the OKO web panel (read-only — just to inspect the live state).
 * 2. Confirm the incident code classification table from the operator notes.
 * 3. Reclassify the Skolwin incident: MOVE03 (vehicle+human) → MOVE04 (animals).
 * 4. Mark the Skolwin task as done; update its description to mention beavers.
 * 5. Insert a human-movement decoy report near Komarowo (MOVE01).
 * 6. Call the hub "done" action to verify all conditions and capture the flag.
 *
 * Incident-code reference (from OKO operator notes):
 *   MOVE01 = human  MOVE02 = vehicle  MOVE03 = vehicle+human  MOVE04 = animals
 *   RECO01..04 = reconnaissance types
 *   PROB01..03 = intercepted signal types
 *
 * Run from this directory:
 *   node app.js
 */

import {
  login,
  listIncidents,
  listTasks,
  getNote,
} from './src/oko.js';

import {
  reclassifySkolwinIncident,
  completeSkolwinTask,
  insertKomarowoIncident,
  ID_SKOLWIN,
  ID_KOMAROWO_SLOT,
} from './src/edits.js';

import { submitDone } from './src/helpers/api.js';

// OKO operator credentials (from lesson notes — shared training account)
const OKO_CREDS = {
  login:     'Zofia',
  password:  'Zofia2026!',
  accessKey: process.env.AGENT_TOKEN?.trim() ?? '',
};

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🕵️  OKO Editor — S04E01');
  console.log('='.repeat(52));

  // ── Step 1: Log in and inspect current state ───────────────────────────
  console.log('\n🔐 Step 1: Logging in to OKO operator panel…');
  await login(OKO_CREDS);
  console.log('  ✓ Session established');

  // Fetch incidents so we can confirm the Skolwin entry exists
  const incidents = await listIncidents();
  const skolwinInc = incidents.find((i) => i.id === ID_SKOLWIN);
  if (!skolwinInc) throw new Error('Skolwin incident not found in the panel.');

  console.log(`\n  Current incidents (${incidents.length} total):`);
  for (const inc of incidents) {
    const marker = inc.id === ID_SKOLWIN        ? ' ← SKOLWIN'
                 : inc.id === ID_KOMAROWO_SLOT   ? ' ← KOMAROWO SLOT'
                 : '';
    console.log(`    [${inc.id.slice(0, 8)}…] ${inc.title}${marker}`);
  }

  // Confirm the Skolwin task is in the task list
  const tasks = await listTasks();
  const skolwinTask = tasks.find((t) => t.id === ID_SKOLWIN);
  if (!skolwinTask) throw new Error('Skolwin task not found in the panel.');

  console.log(`\n  Skolwin task:  "${skolwinTask.title}"  done=${skolwinTask.done}`);

  // ── Step 2: Read incident code table ──────────────────────────────────
  console.log('\n📋 Step 2: Reading incident-code classification table…');
  const note = await getNote(ID_SKOLWIN);
  // Trim to the relevant MOVE lines for a compact log
  const moveLines = note.content
    .split(' ')
    .join(' ')
    .match(/MOVE[^M]+/)?.[0]
    ?.trim() ?? note.content.slice(0, 200);
  console.log(`  ✓ ${moveLines}`);

  // ── Step 3: Reclassify Skolwin incident ────────────────────────────────
  console.log('\n✏️  Step 3: Reclassifying Skolwin incident → MOVE04 (animals)…');
  console.log(`  Before: "${skolwinInc.title}"`);
  const edit1 = await reclassifySkolwinIncident();
  console.log(`  After:  "${edit1.updated?.title}"`);
  console.log(`  ✓ code ${edit1.code} — ${edit1.message}`);

  // ── Step 4: Complete Skolwin task ──────────────────────────────────────
  console.log('\n✅ Step 4: Marking Skolwin task as done (beavers observed)…');
  const edit2 = await completeSkolwinTask();
  console.log(`  done  = ${edit2.updated?.done}`);
  console.log(`  status= ${edit2.updated?.displayStatus}`);
  console.log(`  ✓ code ${edit2.code} — ${edit2.message}`);

  // ── Step 5: Insert Komarowo decoy incident ─────────────────────────────
  console.log('\n🏚️  Step 5: Inserting Komarowo human-movement decoy (MOVE01)…');
  const edit3 = await insertKomarowoIncident();
  console.log(`  New title: "${edit3.updated?.title}"`);
  console.log(`  ✓ code ${edit3.code} — ${edit3.message}`);

  // ── Step 6: Submit "done" and capture the flag ─────────────────────────
  console.log('\n📤 Step 6: Submitting "done" to the hub…');
  const result = await submitDone();

  if (result.code === 0 || result.message?.includes('{FLG:')) {
    const flag = result.message?.match(/\{FLG:[^}]+\}/)?.[0] ?? result.message;
    console.log(`\n🚩 FLAG: ${flag}`);
    console.log('✅ Mission accomplished — Skolwin is safe!\n');
  } else {
    console.error(`\n❌ Verification failed (code ${result.code}): ${result.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
