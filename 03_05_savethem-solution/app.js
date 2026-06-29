/**
 * S03E05 — SaveThem route planner
 *
 * Objective: plan the optimal route for our envoy to reach the city of Skolwin
 * so he can negotiate for wind turbine parts — without exposing the city's
 * location via radio contact.
 *
 * Approach
 * ────────
 * 1. Use the toolsearch registry to dynamically discover all needed endpoints.
 * 2. Fetch the 10×10 terrain map for Skolwin.
 * 3. Fetch vehicle specs (rocket, car, horse, walk).
 * 4. Fetch movement rules from the books archive.
 * 5. Run the route planner (BFS with resource-budget pruning).
 * 6. Submit the optimal answer to /verify and capture the flag.
 *
 * Resources: 10 units of fuel, 10 portions of food.
 * Run from this directory: node app.js
 */

import { fetchMap, fetchVehicles, fetchRules } from './src/tools.js';
import { planRoute }                            from './src/planner.js';
import { renderGrid, findTile }                 from './src/map.js';
import { submitAnswer }                         from './src/helpers/api.js';

async function main() {
  console.log('🗺️  SaveThem — Route Planner');
  console.log('='.repeat(50));

  // ── Step 1: Discover and fetch terrain map ────────────────────────────────
  console.log('\n📡 Step 1: Fetching terrain map for Skolwin…');
  const mapData = await fetchMap('Skolwin');
  const { grid, cityName } = { grid: mapData.map, cityName: mapData.cityName };

  const start = findTile(grid, 'S');
  const goal  = findTile(grid, 'G');

  console.log(`  ✓ City: ${cityName}`);
  console.log(`  ✓ Grid: ${grid.length}×${grid[0].length}`);
  console.log(`  ✓ Start: row ${start.row}, col ${start.col}`);
  console.log(`  ✓ Goal:  row ${goal.row},  col ${goal.col}`);
  console.log('\n  Map:');
  console.log(renderGrid(grid, start));

  // ── Step 2: Discover vehicle catalogue ───────────────────────────────────
  console.log('\n🚗 Step 2: Fetching vehicle specifications…');
  const vehicles = await fetchVehicles();

  for (const [name, c] of Object.entries(vehicles)) {
    console.log(`  ✓ ${name.padEnd(7)} fuel=${c.fuel.toFixed(1)}/move  food=${c.food.toFixed(1)}/move`);
  }

  // ── Step 3: Fetch rules (informational / audit trail) ────────────────────
  console.log('\n📖 Step 3: Fetching movement rules…');
  const rules = await fetchRules();
  console.log(`  ✓ Loaded ${rules.length} rule notes:`);
  for (const note of rules) {
    console.log(`    • [${note.id}] ${note.title}`);
  }

  // ── Step 4: Plan the optimal route ───────────────────────────────────────
  console.log('\n🧭 Step 4: Planning optimal route…');
  const best = planRoute(grid, vehicles);

  console.log(`\n  ✅ Best strategy : ${best.strategy}`);
  console.log(`     Vehicle        : ${best.vehicle}`);
  console.log(`     Total moves    : ${best.answer.length - 1}  (excl. vehicle token)`);
  console.log(`     Fuel used      : ${best.totalFuel.toFixed(2)} / 10`);
  console.log(`     Food used      : ${best.totalFood.toFixed(2)} / 10`);
  console.log(`     Answer array   : ${JSON.stringify(best.answer)}`);

  // Show the route on the map
  const moveSteps = best.answer.filter((s) => ['up','down','left','right'].includes(s));
  const dismountIdx = best.answer.indexOf('dismount');
  const preSteps  = dismountIdx >= 0 ? best.answer.slice(1, dismountIdx) : moveSteps;
  console.log('\n  Route (vehicle leg = *, walk leg = @):');

  // Build a display with two overlays
  const displayGrid = grid.map((r) => [...r]);
  let { row, col } = start;
  let inWalkLeg = false;
  for (const token of best.answer.slice(1)) {
    if (token === 'dismount') { inWalkLeg = true; continue; }
    if (token === 'up')    row--;
    if (token === 'down')  row++;
    if (token === 'left')  col--;
    if (token === 'right') col++;
    if (displayGrid[row]?.[col] && displayGrid[row][col] !== 'G') {
      displayGrid[row][col] = inWalkLeg ? '@' : '*';
    }
  }
  console.log(displayGrid.map((r, i) => `    ${i}: ${r.join('')}`).join('\n'));

  // ── Step 5: Submit ────────────────────────────────────────────────────────
  console.log('\n📤 Step 5: Submitting answer to /verify…');
  const result = await submitAnswer(best.answer);

  if (result.code === 0 || result.message?.includes('{FLG:')) {
    const flag = result.message?.match(/\{FLG:[^}]+\}/)?.[0] ?? result.message;
    console.log(`\n🚩 FLAG: ${flag}`);
    console.log('✅ Mission accomplished!\n');
  } else {
    console.error(`\n❌ Submission rejected (code ${result.code}): ${result.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
