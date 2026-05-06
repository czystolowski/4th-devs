/**
 * Agent - handles only compression logic
 */

import { AI_API_KEY, RESPONSES_API_ENDPOINT, EXTRA_API_HEADERS, resolveModelForProvider } from "../../config.js";
import { api } from "./config.js";

/**
 * Compress logs using AI
 * Takes processed logs and returns compressed version
 */
export const compressLogs = async (logText, feedback = "") => {
  const instructions = `You are a log compression expert. Compress these power plant failure logs to fit under 1500 tokens while preserving ALL critical information.

COMPRESSION RULES:
1. Format: HH:MM [LVL] COMPONENT: brief_message
2. Remove date (keep only time HH:MM)
3. Shorten level: CRIT→CRT, ERRO→ERR, WARN→WRN
4. Abbreviate aggressively:
   - temperature→temp, pressure→pres, cooling→cool
   - emergency→emerg, reactor→react, reported→""
   - Protection interlock initiated→"", is no longer→→no
   - cannot maintain→→no, Immediate protective actions are required→!
5. Use symbols: →(to/into), ↓(below/decrease), !(critical)
6. Remove filler words, articles (a, the), conjunctions

${feedback ? `FEEDBACK FROM PREVIOUS ATTEMPT:\n${feedback}\n\nAdjust compression accordingly.` : ""}

Examples:
"[2026-04-29 06:04:13] [CRIT] ECCS8 reported runaway outlet temperature. Protection interlock initiated reactor trip."
→ "06:04 [CRT] ECCS8: runaway temp→react trip"

"[2026-04-29 10:15:56] [CRIT] WTANK07 coolant level is below critical threshold. Shutdown logic is moving to hard trip stage."
→ "10:15 [CRT] WTANK07: coolant↓crit→hard trip"

Output ONLY the compressed log lines, one per line. NO markdown, NO explanations, NO extra text.`;

  const body = {
    model: resolveModelForProvider(api.model),
    input: logText,
    instructions,
    max_output_tokens: api.maxOutputTokens
  };

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract text from response
  const messageItem = data.output?.find(item => item.type === "message");
  let compressed = messageItem?.content?.[0]?.text || "";
  
  // Clean up any markdown formatting
  compressed = compressed.replace(/```(?:plaintext|text)?\n?/g, "");
  compressed = compressed.replace(/```\n?/g, "");
  compressed = compressed.trim();
  
  return compressed;
};
