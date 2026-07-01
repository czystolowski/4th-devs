/**
 * Signal Router — classifies every intercepted signal and decides
 * how to handle it WITHOUT sending large blobs straight to an LLM.
 *
 * Classification strategy
 * ───────────────────────
 *   TEXT        transcription field is present and non-empty
 *   BINARY      attachment field present  (meta + Base64 payload)
 *   NOISE       everything else (no information worth analysing)
 *
 * Binary handling strategy (cheapest-first)
 * ──────────────────────────────────────────
 *   1.  Decode Base64 → raw bytes locally.
 *   2.  Sniff MIME from the `meta` field and the first bytes.
 *   3.  For JSON / plain-text content → convert to string, treat as TEXT.
 *   4.  For images → forward to vision model (callers decision).
 *   5.  For all others that look like structured text → try UTF-8 decode.
 *   6.  Truly opaque binary → mark UNKNOWN_BINARY (skip LLM, log a warning).
 *
 * Returned signal object shape:
 * {
 *   type: 'TEXT' | 'JSON' | 'IMAGE' | 'UNKNOWN_BINARY' | 'NOISE',
 *   text?: string,        // for TEXT / JSON types
 *   imageBase64?: string, // for IMAGE type (raw Base64, no data-URL prefix)
 *   imageMime?: string,   // e.g. "image/png"
 *   raw: object,          // original API response
 * }
 */

// MIME types we can decode as text without an LLM
const TEXT_MIMES = new Set([
  'application/json',
  'text/plain',
  'text/html',
  'text/xml',
  'application/xml',
  'text/csv',
  'application/ld+json',
]);

// MIME types that require a vision model
const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

// MIME types to skip entirely (audio — transcription requires paid balance)
const AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
]);

/**
 * Sniff whether raw Buffer bytes look like valid UTF-8 text.
 * We try to decode the first 4 KB; if it throws, it's binary.
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
function looksLikeText(buf) {
  try {
    const sample = buf.subarray(0, 4096);
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

/**
 * Route a raw API response to the appropriate handling bucket.
 *
 * @param {object} signal  Raw response from listenNext()
 * @returns {{ type: string, text?: string, imageBase64?: string, imageMime?: string, raw: object }}
 */
export function routeSignal(signal) {
  // ── TEXT path ─────────────────────────────────────────────────────────────
  if (signal.transcription && typeof signal.transcription === 'string') {
    const text = signal.transcription.trim();
    if (!text) return { type: 'NOISE', raw: signal };

    return { type: 'TEXT', text, raw: signal };
  }

  // ── BINARY path ───────────────────────────────────────────────────────────
  if (signal.attachment && typeof signal.attachment === 'string') {
    const meta     = (signal.meta ?? '').toLowerCase().split(';')[0].trim();
    const raw64    = signal.attachment.trim();

    // Decode Base64 → Buffer
    let buf;
    try {
      buf = Buffer.from(raw64, 'base64');
    } catch {
      return { type: 'NOISE', raw: signal };  // malformed Base64
    }

    // 0) Audio — pass buffer through for transcription attempt
    if (AUDIO_MIMES.has(meta)) {
      return { type: 'AUDIO', audioBuf: buf, audioMime: meta, raw: signal };
    }

    // 1) Known text MIME — decode as string
    if (TEXT_MIMES.has(meta)) {
      const text = buf.toString('utf-8');
      return { type: meta === 'application/json' ? 'JSON' : 'TEXT', text, raw: signal };
    }

    // 2) Known image MIME — forward as image
    if (IMAGE_MIMES.has(meta)) {
      return { type: 'IMAGE', imageBase64: raw64, imageMime: meta, raw: signal };
    }

    // 3) Unknown MIME — try sniffing JSON / text from raw bytes
    if (looksLikeText(buf)) {
      const text = buf.toString('utf-8');
      // Quick heuristic: starts with { or [ → treat as JSON
      const trimmed = text.trimStart();
      const type = (trimmed.startsWith('{') || trimmed.startsWith('[')) ? 'JSON' : 'TEXT';
      return { type, text, raw: signal };
    }

    // 4) Truly opaque binary — skip LLM, just log
    return { type: 'UNKNOWN_BINARY', raw: signal };
  }

  // ── NOISE / end-of-pool ───────────────────────────────────────────────────
  return { type: 'NOISE', raw: signal };
}

/**
 * Human-readable label for the signal's code / message pair.
 *
 * @param {object} signal
 * @returns {string}
 */
export function signalSummary(signal) {
  const code = signal.code ?? '?';
  const msg  = signal.message ?? '';
  return `[${code}] ${msg}`;
}

/**
 * Returns true if the server indicates there are no more signals to receive.
 *
 * @param {object} signal
 * @returns {boolean}
 */
export function isEndOfPool(signal) {
  // The server uses a non-100 code or a message like "No more signals"
  if (signal.code !== undefined && signal.code !== 100) return true;

  const msg = (signal.message ?? '').toLowerCase();
  return (
    msg.includes('no more') ||
    msg.includes('end of') ||
    msg.includes('enough data') ||
    msg.includes('wystarczaj') ||
    msg.includes('koniec') ||
    msg.includes('brak') ||
    msg.includes('all signals') ||
    // code 0 or negative often means "done"
    signal.code === 0
  );
}
