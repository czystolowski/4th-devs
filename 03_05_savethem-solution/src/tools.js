/**
 * Tool discovery layer — wraps toolsearch so the agent can dynamically
 * find and call hub endpoints by intent rather than hard-coded URLs.
 *
 * The hub enforces English-only queries and each tool always returns
 * the 3 best-matching results, never the full catalogue.
 */

import { toolsearch, callTool } from './helpers/api.js';

// Cache discovered tool paths so we don't hammer toolsearch on every call.
const _toolCache = new Map(); // intent → toolPath

/**
 * Resolve the hub path for a given intent string.
 * Falls back to the cache before calling toolsearch again.
 *
 * @param {string} intent   Short description, e.g. "terrain maps"
 * @returns {Promise<string>} Hub path, e.g. "/api/maps"
 */
async function resolveToolPath(intent) {
  if (_toolCache.has(intent)) return _toolCache.get(intent);

  const tools = await toolsearch(intent);
  if (!tools.length) throw new Error(`No tool found for intent: "${intent}"`);

  const path = tools[0].url;
  _toolCache.set(intent, path);
  console.log(`  🔍 Resolved "${intent}" → ${path}`);
  return path;
}

/**
 * Fetch the terrain map for a target city.
 *
 * @param {string} city  e.g. "Skolwin"
 * @returns {Promise<{ cityName: string, map: string[][] }>}
 */
export async function fetchMap(city) {
  const path = await resolveToolPath('terrain maps city location');
  const data = await callTool(path, city);
  if (!data.map) throw new Error(`Map not found for city: ${city}. Response: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Fetch information about all available vehicles.
 * The tool only returns 3 results per query, so we query each known
 * vehicle by name to build a complete catalogue.
 *
 * Known vehicles: rocket, car, horse, walk
 *
 * @returns {Promise<Record<string, { fuel: number, food: number }>>}
 *   Map from vehicle name to per-move consumption figures.
 */
export async function fetchVehicles() {
  const path = await resolveToolPath('vehicles transportation fuel consumption');
  const knownVehicles = ['rocket', 'car', 'horse', 'walk'];
  const catalogue = {};

  for (const name of knownVehicles) {
    const data = await callTool(path, name);
    if (data.consumption) {
      catalogue[name] = { fuel: data.consumption.fuel, food: data.consumption.food };
    }
  }

  return catalogue;
}

/**
 * Fetch all relevant rule notes from the books endpoint.
 * Multiple queries cover the full rule set (tools return top-3 only).
 *
 * @returns {Promise<{ id: string, title: string, content: string }[]>}
 */
export async function fetchRules() {
  const path = await resolveToolPath('notes rules books');

  const queries = [
    'movement rules terrain map symbols tiles passable',
    'water rock tree obstacle impassable',
    'dismount vehicle switch change transport',
    'tree fuel consumption penalty',
  ];

  const seen = new Set();
  const notes = [];

  for (const q of queries) {
    const data = await callTool(path, q);
    for (const note of (data.notes ?? [])) {
      if (!seen.has(note.id)) {
        seen.add(note.id);
        notes.push(note);
      }
    }
  }

  return notes;
}
