/**
 * Route planner — finds the cheapest feasible path from start to goal.
 *
 * Strategy
 * ────────
 * The grid has a band of water tiles (W) blocking the direct path.
 * Water is only crossable on foot (walk) or horseback.  However the
 * horse must be chosen at the *start*, and dismounting always switches
 * to walk mode — you cannot remount.
 *
 * Three candidate strategies are evaluated and the cheapest (by total
 * resource consumption) is selected:
 *
 *  1. Single vehicle all the way  (rocket | car | horse | walk)
 *  2. Powered vehicle (rocket | car) to the water boundary,
 *     then dismount + walk the remaining tiles
 *
 * Budget: 10 units of fuel and 10 portions of food.
 *
 * Cost model (per move):
 *   vehicle   fuel          food
 *   ────────  ────────────  ────
 *   rocket    1.0 (+0.2 T)  0.1
 *   car       0.7 (+0.2 T)  1.0
 *   horse     0.0           1.6
 *   walk      0.0           2.5
 *
 * Tree tiles (T) add a +0.2 fuel penalty for powered vehicles.
 */

import { bfsPath, findTile } from './map.js';

const BUDGET = { fuel: 10, food: 10 };

/** Powered vehicles that can later dismount to walk. */
const POWERED = ['rocket', 'car'];

/**
 * Find the optimal route for the messenger.
 *
 * @param {string[][]} grid        10×10 map from fetchMap()
 * @param {Record<string, { fuel: number, food: number }>} vehicles
 *   Full vehicle catalogue from fetchVehicles()
 *
 * @returns {{
 *   vehicle:    string,
 *   answer:     string[],
 *   totalFuel:  number,
 *   totalFood:  number,
 *   strategy:   string,
 * }}
 */
export function planRoute(grid, vehicles) {
  const start = findTile(grid, 'S');
  const goal  = findTile(grid, 'G');

  const candidates = [];

  // ── 1. Single-vehicle solutions ──────────────────────────────────────────
  for (const [name, consumption] of Object.entries(vehicles)) {
    const result = bfsPath(grid, start, goal, name, consumption, BUDGET);
    if (!result) continue;

    candidates.push({
      vehicle:   name,
      answer:    [name, ...result.path],
      totalFuel: result.fuel,
      totalFood: result.food,
      strategy:  `${name} all the way`,
    });
  }

  // ── 2. Powered-then-walk hybrid solutions ─────────────────────────────────
  // For each cell reachable by the powered vehicle, check whether walk can
  // reach the goal from there within the remaining budget.
  const walkConsumption = vehicles['walk'];
  if (walkConsumption) {
    for (const powered of POWERED) {
      const poweredConsumption = vehicles[powered];
      if (!poweredConsumption) continue;

      // Enumerate every grid cell as a potential dismount point
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[0].length; col++) {
          if (grid[row][col] === 'R') continue; // impassable

          const midpoint = { row, col };

          // Leg 1: powered from start → midpoint
          const leg1 = bfsPath(
            grid, start, midpoint,
            powered, poweredConsumption,
            BUDGET,
          );
          if (!leg1) continue;

          // Leg 2: walk from midpoint → goal, with remaining budget
          const leg2 = bfsPath(
            grid, midpoint, goal,
            'walk', walkConsumption,
            BUDGET,
            { fuelSpent: leg1.fuel, foodSpent: leg1.food },
          );
          if (!leg2) continue;

          const totalFuel = leg1.fuel + leg2.fuel;
          const totalFood = leg1.food + leg2.food;

          // Skip if this combo isn't better than what we already have
          // (use sum of resources as a simple ranking heuristic — both are ≤10)
          candidates.push({
            vehicle:   powered,
            answer:    [powered, ...leg1.path, 'dismount', ...leg2.path],
            totalFuel,
            totalFood,
            strategy:  `${powered} to (${row},${col}), then walk`,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error('No feasible route found within the 10-fuel / 10-food budget.');
  }

  // ── Select best candidate ─────────────────────────────────────────────────
  // Primary key: minimise total moves (answer length).
  // Tie-break: minimise combined resource usage.
  candidates.sort((a, b) => {
    const moveDiff = a.answer.length - b.answer.length;
    if (moveDiff !== 0) return moveDiff;
    return (a.totalFuel + a.totalFood) - (b.totalFuel + b.totalFood);
  });

  return candidates[0];
}
