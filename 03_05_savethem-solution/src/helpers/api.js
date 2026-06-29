/**
 * Hub API helpers for the savethem task.
 *
 * All remote calls funnel through here so the rest of the code stays clean.
 * Import from root config.js which auto-loads .env and resolves the provider.
 */

import '../../../config.js';

const HUB_BASE = 'https://hub.ag3nts.org';
export const AGENT_TOKEN = process.env.AGENT_TOKEN?.trim() ?? '';

if (!AGENT_TOKEN) {
  console.error('❌  AGENT_TOKEN is not set. Add it to your .env file.');
  process.exit(1);
}

/**
 * Low-level POST helper shared by all hub endpoints.
 *
 * @param {string} path   Endpoint path, e.g. "/api/toolsearch"
 * @param {object} body   JSON body (apikey is injected automatically)
 * @returns {Promise<object>}
 */
async function post(path, body) {
  const url = `${HUB_BASE}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: AGENT_TOKEN, ...body }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} from ${url}: ${text}`);
  }

  return response.json();
}

/**
 * Search the tool registry for tools matching a natural-language query.
 *
 * @param {string} query  Natural language or keyword query (English only)
 * @returns {Promise<{ name: string, url: string, description: string }[]>}
 */
export async function toolsearch(query) {
  const data = await post('/api/toolsearch', { query });
  return data.tools ?? [];
}

/**
 * Call any discovered hub tool with a query string.
 * All hub tools share the same interface: { apikey, query } → { ... }.
 *
 * @param {string} toolPath  e.g. "/api/maps"
 * @param {string} query
 * @returns {Promise<object>}
 */
export async function callTool(toolPath, query) {
  return post(toolPath, { query });
}

/**
 * Submit the final route answer to /verify.
 *
 * @param {string[]} answer  e.g. ["rocket","up","up","right","dismount","right"]
 * @returns {Promise<object>}
 */
export async function submitAnswer(answer) {
  return post('/verify', { task: 'savethem', answer });
}
