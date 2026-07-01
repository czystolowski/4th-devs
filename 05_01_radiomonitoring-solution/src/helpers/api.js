/**
 * Hub API wrapper for the radiomonitoring task.
 *
 * All hub calls are routed through a single `post()` primitive so the
 * rest of the pipeline stays clean and declarative.
 *
 * Imports root config.js which auto-loads .env and enforces Node 24+.
 */

import '../../../config.js';

const HUB_BASE  = 'https://hub.ag3nts.org';
const TASK_NAME = 'radiomonitoring';

export const AGENT_TOKEN = process.env.AGENT_TOKEN?.trim() ?? '';

if (!AGENT_TOKEN) {
  console.error('❌  AGENT_TOKEN is not set. Add it to your root .env file.');
  process.exit(1);
}

// ── Low-level primitive ────────────────────────────────────────────────────

/**
 * POST JSON to a hub endpoint, injecting the apikey automatically.
 *
 * @param {string} path   e.g. "/verify"
 * @param {object} body   Fields merged alongside apikey
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
 * Start a new listening session. The server prepares the pool of signals
 * to be captured.
 *
 * @returns {Promise<object>}
 */
export async function startSession() {
  return post('/verify', { task: TASK_NAME, answer: { action: 'start' } });
}

/**
 * Retrieve the next intercepted signal from the pool.
 *
 * The response is one of:
 *   - { code, message, transcription }           — text / voice transcript
 *   - { code, message, meta, attachment, filesize } — binary file in Base64
 *   - { code, message }                           — noise / end-of-pool signal
 *
 * @returns {Promise<object>}
 */
export async function listenNext() {
  return post('/verify', { task: TASK_NAME, answer: { action: 'listen' } });
}

/**
 * Transmit the final intelligence report to the hub.
 *
 * @param {{ cityName: string, cityArea: string, warehousesCount: number, phoneNumber: string }} report
 * @returns {Promise<object>}
 */
export async function transmitReport(report) {
  return post('/verify', {
    task:   TASK_NAME,
    answer: {
      action: 'transmit',
      ...report,
    },
  });
}
