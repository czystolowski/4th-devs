/**
 * Hub API wrapper for the okoeditor task.
 *
 * All hub calls go through a single `post()` primitive; task-specific helpers
 * are exported above it so the rest of the code stays declarative.
 *
 * Import from root config.js — it auto-loads .env and enforces Node 24+.
 */

import '../../../config.js';

const HUB_BASE   = 'https://hub.ag3nts.org';
const TASK_NAME  = 'okoeditor';

export const AGENT_TOKEN = process.env.AGENT_TOKEN?.trim() ?? '';

if (!AGENT_TOKEN) {
  console.error('❌  AGENT_TOKEN is not set. Add it to your root .env file.');
  process.exit(1);
}

// ── Low-level primitive ────────────────────────────────────────────────────

/**
 * POST JSON to a hub endpoint, injecting the apikey automatically.
 *
 * @param {string} path  e.g. "/verify"
 * @param {object} body  Fields merged alongside apikey
 * @returns {Promise<object>}
 */
async function post(path, body) {
  const url      = `${HUB_BASE}${path}`;
  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ apikey: AGENT_TOKEN, ...body }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} from ${url}: ${text}`);
  }

  return response.json();
}

// ── Task-specific helpers ──────────────────────────────────────────────────

/**
 * Fetch the full API reference for this task.
 * Useful for discovery / debugging without opening the lesson notes.
 *
 * @returns {Promise<object>}
 */
export async function fetchHelp() {
  return post('/verify', { task: TASK_NAME, answer: { action: 'help' } });
}

/**
 * Update an existing OKO record.
 *
 * Rules enforced by the server:
 *   - `id` must match an existing record on `page`
 *   - At least one of `title` or `content` must be provided
 *   - `done` is only accepted for page "zadania" (values: "YES" | "NO")
 *   - Page "uzytkownicy" is read-only
 *
 * @param {{ page: string, id: string, title?: string, content?: string, done?: 'YES'|'NO' }} opts
 * @returns {Promise<object>}
 */
export async function updateEntry({ page, id, title, content, done }) {
  const answer = { action: 'update', page, id };
  if (title   !== undefined) answer.title   = title;
  if (content !== undefined) answer.content = content;
  if (done    !== undefined) answer.done    = done;

  return post('/verify', { task: TASK_NAME, answer });
}

/**
 * Signal the hub that all edits are complete and request flag verification.
 *
 * @returns {Promise<object>}
 */
export async function submitDone() {
  return post('/verify', { task: TASK_NAME, answer: { action: 'done' } });
}
