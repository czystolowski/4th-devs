/**
 * Hub API helper for submitting results
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Load environment variables from project root (Node 24+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');
process.loadEnvFile(join(projectRoot, '.env'));

const HUB_URL = "https://hub.ag3nts.org";

/**
 * Submit anomalies to hub
 * @param {Array} anomalies - Array of file IDs with anomalies
 * @returns {Promise<Object>} Hub response
 */
export async function submitAnomalies(anomalies) {
  const apiKey = process.env.AGENT_TOKEN;
  if (!apiKey) {
    throw new Error("AGENT_TOKEN not found in environment");
  }

  const response = await fetch(`${HUB_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: "evaluation",
      answer: {
        recheck: anomalies
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hub error: ${response.status} - ${text}`);
  }

  return await response.json();
}

