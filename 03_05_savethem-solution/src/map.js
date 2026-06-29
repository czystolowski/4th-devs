/**
 * Map utilities and BFS pathfinder.
 *
 * Tile legend (from books/legend-markers):
 *   S  — starting position
 *   G  — goal
 *   .  — open ground (always passable)
 *   T  — trees (passable by all; powered vehicles pay +0.2 fuel)
 *   R  — rocks (impassable for everyone)
 *   W  — water (passable only by horse and walk)
 *
 * Coordinate system: grid[row][col], row 0 = top, col 0 = left.
 * Directions: "up" decrements row, "down" increments row,
 *             "left" decrements col, "right" increments col.
 */

/** Four cardinal direction vectors. */
const DIRECTIONS = [
  { name: 'up',    dr: -1, dc:  0 },
  { name: 'down',  dr:  1, dc:  0 },
  { name: 'left',  dr:  0, dc: -1 },
  { name: 'right', dr:  0, dc:  1 },
];

/**
 * Return whether `vehicle` can enter a tile with the given symbol.
 *
 * @param {string} vehicle  One of: rocket | car | horse | walk
 * @param {string} tile
 */
export function canEnter(vehicle, tile) {
  if (tile === 'R') return false;                         // rocks block everything
  if (tile === 'W') return vehicle === 'horse' || vehicle === 'walk'; // only flesh/feet can ford
  return true;
}

/**
 * Extra fuel cost for powered vehicles entering a tree tile.
 * Pure vehicles (horse/walk) burn no fuel so this never applies.
 */
export const TREE_FUEL_PENALTY = 0.2;

/**
 * Find the position of a tile symbol on the grid.
 *
 * @param {string[][]} grid
 * @param {string}     symbol
 * @returns {{ row: number, col: number }}
 */
export function findTile(grid, symbol) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === symbol) return { row, col };
    }
  }
  throw new Error(`Tile "${symbol}" not found on grid`);
}

/**
 * BFS shortest path between two positions for a single vehicle.
 *
 * BFS guarantees fewest moves.  Resource costs are computed but the
 * search is pruned once fuel or food would exceed the budget, which
 * means it only returns routes that are actually feasible.
 *
 * @param {string[][]} grid
 * @param {{ row: number, col: number }} from
 * @param {{ row: number, col: number }} to
 * @param {string} vehicle    One of: rocket | car | horse | walk
 * @param {{ fuel: number, food: number }} consumption   Per-move base costs
 * @param {{ fuel: number, food: number }} budget        Max totals (default 10/10)
 * @param {{ fuelSpent?: number, foodSpent?: number }}   Already-consumed resources
 *
 * @returns {{ path: string[], fuel: number, food: number } | null}
 *   null if no feasible path exists within the budget.
 */
export function bfsPath(
  grid,
  from,
  to,
  vehicle,
  consumption,
  budget = { fuel: 10, food: 10 },
  spent  = { fuelSpent: 0, foodSpent: 0 },
) {
  const rows = grid.length;
  const cols = grid[0].length;

  // BFS state: position + accumulated costs for THIS leg of the journey.
  // Using a plain deque (array) is fast enough for a 10×10 grid.
  const queue = [{ row: from.row, col: from.col, path: [], fuel: 0, food: 0 }];
  const visited = new Set([`${from.row},${from.col}`]);

  while (queue.length > 0) {
    const { row, col, path, fuel, food } = queue.shift();

    if (row === to.row && col === to.col) {
      return { path, fuel, food };
    }

    for (const { name, dr, dc } of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      const key = `${nr},${nc}`;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (visited.has(key)) continue;

      const tile = grid[nr][nc];
      if (!canEnter(vehicle, tile)) continue;

      // Compute per-move costs for this tile
      const moveFuel = consumption.fuel + (tile === 'T' ? TREE_FUEL_PENALTY : 0);
      const moveFood = consumption.food;

      const newFuel = fuel + moveFuel;
      const newFood = food + moveFood;

      // Prune if budget would be exceeded (total = already spent + this leg)
      if (spent.fuelSpent + newFuel > budget.fuel) continue;
      if (spent.foodSpent + newFood > budget.food) continue;

      visited.add(key);
      queue.push({ row: nr, col: nc, path: [...path, name], fuel: newFuel, food: newFood });
    }
  }

  return null; // no feasible path found
}

/**
 * Render the grid as a compact ASCII string for logging.
 * Optionally overlays a route (* marks visited tiles).
 *
 * @param {string[][]} grid
 * @param {{ row: number, col: number }} start
 * @param {string[]} [moves]
 */
export function renderGrid(grid, start, moves = []) {
  const display = grid.map((row) => [...row]);

  let { row, col } = start;
  for (const move of moves) {
    if (move === 'up')    row--;
    if (move === 'down')  row++;
    if (move === 'left')  col--;
    if (move === 'right') col++;
    if (display[row]?.[col] && display[row][col] !== 'G') {
      display[row][col] = '*';
    }
  }

  return display.map((r, i) => `  ${i}: ${r.join('')}`).join('\n');
}
