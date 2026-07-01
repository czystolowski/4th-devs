/**
 * Intelligence Analysis — extracts structured data about the city "Syjon"
 * from the collected radio signals.
 *
 * Strategy
 * ────────
 * 1. All collected TEXT / JSON signals are aggregated into a text corpus.
 * 2. A single LLM call with the full corpus extracts the four required fields.
 * 3. Images are analysed via the Chat Completions vision endpoint (better
 *    OpenRouter compatibility than Responses API image inputs).
 * 4. Audio signals are transcribed via OpenAI Whisper when OPENAI_API_KEY is
 *    set. With OpenRouter only, audio requires ≥ $0.50 account balance — see
 *    transcribeAudio() for details.
 */

import { AI_API_KEY, CHAT_API_BASE_URL, RESPONSES_API_ENDPOINT, resolveModelForProvider } from '../../config.js';

// Text / vision model — gpt-4o gives best accuracy for structured extraction.
const TEXT_MODEL   = 'gpt-4o';
const VISION_MODEL = 'gpt-4o';

// Audio transcription model via OpenRouter.
// Falls back to whisper-1 via api.openai.com when OPENAI_API_KEY is present.
//
// Free option: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
//   → blocked by OpenRouter's $0.50 audio gate (account-level, not per-model)
//
// Paid option: 'google/gemini-2.5-flash-lite'   (cheap, ~$0.002/min)
// Paid option: 'google/gemini-2.5-flash'         (more accurate, ~$0.015/min)
const AUDIO_MODEL_OPENROUTER = 'google/gemini-2.5-flash-lite';

// ── LLM helpers ────────────────────────────────────────────────────────────

/**
 * Generic call to the OpenAI Responses API (text-only).
 *
 * @param {string} model
 * @param {object[]} input  Input items array
 * @returns {Promise<string>} First text output
 */
async function callLLM(model, input) {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model:       resolveModelForProvider(model),
      input,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Responses API: output[0].content[0].text
  const output = data.output ?? [];
  for (const item of output) {
    for (const part of (item.content ?? [])) {
      if (part.type === 'output_text' || part.type === 'text') {
        return part.text ?? '';
      }
    }
  }

  throw new Error('No text output from LLM');
}

// ── Audio transcription ────────────────────────────────────────────────────

/**
 * Transcribe an MP3/audio buffer to text.
 *
 * Priority order:
 *   1. OPENAI_API_KEY present → Whisper via api.openai.com (always works)
 *   2. OpenRouter with ≥ $0.50 balance → Gemini via AUDIO_MODEL_OPENROUTER
 *   3. Neither available → returns null (caller logs a warning)
 *
 * @param {Buffer} buf      Raw audio bytes
 * @param {string} mime     e.g. "audio/mpeg"
 * @returns {Promise<string|null>}
 */
export async function transcribeAudio(buf, mime) {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  // ── Path 1: direct Whisper via OpenAI ─────────────────────────────────
  if (openaiKey) {
    const boundary = `----WB${Date.now()}`;
    const ext      = mime.includes('mp3') || mime.includes('mpeg') ? 'mp3'
                   : mime.includes('wav')                          ? 'wav'
                   : 'mp3';

    const headerStr  = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
                     + `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\npl\r\n`
                     + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mime}\r\n\r\n`;
    const footerStr  = `\r\n--${boundary}--\r\n`;
    const body       = Buffer.concat([Buffer.from(headerStr), buf, Buffer.from(footerStr)]);

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        Authorization:    `Bearer ${openaiKey}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.text ?? null;
    }

    const errText = await resp.text();
    throw new Error(`Whisper API error ${resp.status}: ${errText}`);
  }

  // ── Path 2: Gemini via OpenRouter (requires ≥ $0.50 balance) ──────────
  const base64 = buf.toString('base64');
  const body   = {
    model:    AUDIO_MODEL_OPENROUTER,
    // To use a different paid model, swap the line above with e.g.:
    // model: 'google/gemini-2.5-flash',
    messages: [{
      role:    'user',
      content: [
        { type: 'text', text: 'Transcribe this audio completely in Polish. Return only the transcription text.' },
        { type: 'file', file: { filename: 'audio.mp3', file_data: `data:${mime};base64,${base64}` } },
      ],
    }],
    max_tokens: 1000,
  };

  const resp = await fetch(`${CHAT_API_BASE_URL}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (resp.ok) {
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? null;
  }

  const err = await resp.json().catch(() => ({}));

  // OpenRouter blocks audio/file content below $0.50 balance — not fatal
  if (err?.error?.code === 402) {
    return null;   // caller will warn and skip
  }

  throw new Error(`Audio transcription error ${resp.status}: ${JSON.stringify(err)}`);
}

// ── Image analysis ────────────────────────────────────────────────────────

/**
 * Send an image to the vision model via Chat Completions (better compatibility).
 * Transcribes ALL visible text and describes any relevant content.
 *
 * @param {string} base64   Raw Base64 string (no data-URL prefix)
 * @param {string} mime     e.g. "image/png"
 * @returns {Promise<string>} Description / transcription text
 */
export async function analyseImage(base64, mime) {
  const dataUrl = `data:${mime};base64,${base64}`;

  const response = await fetch(`${CHAT_API_BASE_URL}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model:       resolveModelForProvider(VISION_MODEL),
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an intelligence analyst examining an image intercepted from a radio transmission.
Describe EVERYTHING you see in detail. Transcribe ALL visible text verbatim — handwriting, typed text, numbers, names.
Pay special attention to: city names, phone numbers, area/size data, warehouse counts, contact persons.
This is a postapocalyptic fiction context. The hidden city is codenamed "Syjon".
If you see a handwritten note, sign, document, map, or table — read and reproduce it fully.
Respond in English or Polish.`,
            },
            {
              type:      'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vision API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'No relevant data.';
}

// ── Text corpus extraction ────────────────────────────────────────────────

/**
 * Extract the four required intelligence fields from a corpus of text signals.
 *
 * @param {string[]} textChunks  Individual signal texts/transcripts
 * @param {string[]} imageNotes  Descriptions produced by analyseImage()
 * @returns {Promise<{ cityName: string, cityArea: string, warehousesCount: number, phoneNumber: string }>}
 */
export async function extractIntelligence(textChunks, imageNotes) {
  const allText = [
    ...textChunks,
    ...imageNotes.map((n, i) => `[IMAGE ${i + 1}]\n${n}`),
  ].join('\n\n---\n\n');

  const systemPrompt = `You are an intelligence analyst tasked with finding information about a hidden city codenamed "Syjon".
Analyse ALL the radio intercepts below carefully and extract exactly these four fields:

1. cityName    — the real Polish name of the city referred to as "Syjon"
   - "Syjon" is a codename; look for its real name in text, JSON, XML, or image descriptions
   - Check which city in the JSON data has riverAccess=true AND farmAnimals=true
   - Cross-reference with text messages about trading cattle (bydło) and water access
   - The city was "erased from the map" — it won't appear under "Syjon" in the JSON

2. cityArea    — the surface area in km², rounded to exactly 2 decimal places (e.g. "12.34")
   - Look in the JSON data for the matching city's "occupiedArea" field
   - Round mathematically to 2 decimal places

3. warehousesCount — the number of warehouses / storage facilities (integer)
   - Look in XML/JSON for warehouse fields, or in image/audio descriptions for this number

4. phoneNumber — the contact phone number for the city Syjon (digits only, no spaces or dashes)
   - Look in image descriptions — a handwritten note may contain it
   - Remove ALL spaces, dashes, and formatting

IMPORTANT:
- The JSON list of cities does NOT include "Syjon" by that name — find which real city it is
- Pay special attention to image descriptions — they may contain phone numbers or warehouse counts
- cityArea MUST have exactly two decimal digits (mathematical rounding).
- warehousesCount MUST be an integer.
- phoneNumber: digits only, remove ALL spaces and dashes.
- If data for a field is not found, set its value to null.
- Respond with ONLY a valid JSON object — no markdown, no prose.

JSON format:
{
  "cityName": "...",
  "cityArea": "12.34",
  "warehousesCount": 42,
  "phoneNumber": "123456789"
}`;

  const input = [
    {
      role:    'system',
      content: systemPrompt,
    },
    {
      role:    'user',
      content: `RADIO INTERCEPTS:\n\n${allText}`,
    },
  ];

  const raw = await callLLM(TEXT_MODEL, input);

  // Strip optional markdown fences if the model includes them
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse LLM output as JSON.\nRaw:\n${raw}\nError: ${err.message}`);
  }

  return parsed;
}
