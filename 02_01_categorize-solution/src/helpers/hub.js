import { hub } from "../config.js";

/**
 * Fetch CSV data from the hub.
 */
export const fetchCsvData = async (apiKey) => {
  const url = `${hub.baseUrl}/data/${apiKey}/${hub.task}.csv`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  return parseCsv(text);
};

/**
 * Parse CSV text into array of objects.
 * Handles quoted fields properly.
 */
const parseCsv = (text) => {
  const lines = text.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] || "";
      return obj;
    }, {});
  });
};

/**
 * Parse a single CSV line, handling quoted fields.
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

/**
 * Send classification prompt to hub for verification.
 */
export const verifyPrompt = async (apiKey, prompt) => {
  const url = `${hub.baseUrl}/verify`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: hub.task,
      answer: { prompt }
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `Hub error: ${response.status}`);
  }
  
  return data;
};

/**
 * Reset the hub counter.
 */
export const resetHub = async (apiKey) => {
  return verifyPrompt(apiKey, "reset");
};

/**
 * Calculate token cost in PP.
 */
export const calculateCost = (inputTokens, cachedTokens, outputTokens, costs) => {
  const inputCost = (inputTokens / 10) * costs.inputCost;
  const cachedCost = (cachedTokens / 10) * costs.cachedCost;
  const outputCost = (outputTokens / 10) * costs.outputCost;
  
  return inputCost + cachedCost + outputCost;
};

/**
 * Count tokens (approximate, similar to GPT tokenizer).
 */
export const countTokens = (text) => {
  // Rough approximation: ~4 chars per token for English
  // More conservative for mixed content
  return Math.ceil(text.length / 3.5);
};
