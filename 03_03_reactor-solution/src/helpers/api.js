/**
 * Hub API wrapper for the reactor task.
 */

// config.js import loads .env from project root automatically
import '../../../config.js';

const HUB_URL = 'https://hub.ag3nts.org/verify';
const AGENT_TOKEN = process.env.AGENT_TOKEN?.trim() ?? '';

/**
 * Send a single command to the reactor API.
 * @param {string} command  One of: start | left | right | wait | reset
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function sendCommand(command) {
  if (!AGENT_TOKEN) {
    throw new Error('AGENT_TOKEN is not set. Add it to your .env file.');
  }

  const response = await fetch(HUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      task: 'reactor',
      answer: { command },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hub HTTP error ${response.status}: ${text}`);
  }

  return response.json();
}
