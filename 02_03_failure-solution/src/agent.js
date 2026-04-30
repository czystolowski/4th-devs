/**
 * Agent logic for log analysis and compression
 */

import { AI_API_KEY, RESPONSES_API_ENDPOINT, EXTRA_API_HEADERS, resolveModelForProvider } from "../../config.js";
import { api, logLevels, powerPlantComponents } from "./config.js";

/**
 * Filter logs to only critical events (WARN, ERRO, CRIT)
 */
export const filterCriticalLogs = (logText) => {
  const lines = logText.split("\n");
  const criticalLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // Check if line contains any critical log level
    return logLevels.critical.some(level => trimmed.includes(`[${level}]`));
  });
  
  return criticalLines.join("\n");
};

/**
 * Identify power plant components mentioned in logs
 */
export const identifyComponents = (logText) => {
  const components = new Set();
  
  for (const component of powerPlantComponents) {
    if (logText.includes(component)) {
      components.add(component);
    }
  }
  
  return Array.from(components);
};

/**
 * Extract structured log entry information
 */
const parseLogEntry = (line) => {
  // Expected format: timestamp [LEVEL] component_id: message
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s+\[(\w+)\]\s+(\w+):\s*(.+)$/);
  
  if (!match) return null;
  
  return {
    timestamp: match[1],
    level: match[2],
    component: match[3],
    message: match[4]
  };
};

/**
 * Compress logs using AI while preserving key information
 */
export const compressLogs = async (logText, missingComponents = []) => {
  const instructions = `You are a log compression expert. Your task is to compress power plant failure logs while preserving ALL critical information.

REQUIREMENTS:
1. Keep ONLY entries related to power plant failure (WARN, ERRO, CRIT levels)
2. Preserve: timestamp, log level, component ID, and core message
3. Remove redundant information and verbose details
4. Keep chronological order
5. Ensure ALL power plant components are represented if they appear in logs
${missingComponents.length > 0 ? `6. IMPORTANT: Make sure to include entries for these components: ${missingComponents.join(", ")}` : ""}

Power plant components to watch for: ${powerPlantComponents.join(", ")}

Format each line as: timestamp [LEVEL] component: brief_message

Example compression:
Input: "2024-01-15T10:23:45.123Z [ERRO] ECCS: Emergency Core Cooling System pressure drop detected in primary loop, initiating backup cooling sequence"
Output: "2024-01-15T10:23:45Z [ERRO] ECCS: pressure drop, backup cooling initiated"

CRITICAL: Output ONLY the log lines, one per line. Do NOT wrap in markdown code blocks (no \`\`\`plaintext or \`\`\`). Do NOT add any formatting, explanations, or extra text. Just the raw log lines.`;

  const input = `Compress these logs:\n\n${logText}`;

  const body = {
    model: resolveModelForProvider(api.model),
    input,
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
  
  // Extract text from response output
  const messageItem = data.output?.find(item => item.type === "message");
  let compressed = messageItem?.content?.[0]?.text || "";
  
  // Strip markdown code blocks if present
  compressed = compressed.replace(/```(?:plaintext|text)?\n?/g, "");
  compressed = compressed.replace(/```\n?/g, "");
  
  return compressed.trim();
};

/**
 * Analyze hub feedback to identify missing components
 */
export const analyzeFeedback = (feedback) => {
  const missing = [];
  
  // Look for patterns like "missing ECCS" or "no PUMP entries"
  for (const component of powerPlantComponents) {
    const patterns = [
      new RegExp(`missing\\s+${component}`, "i"),
      new RegExp(`no\\s+${component}`, "i"),
      new RegExp(`${component}\\s+not\\s+found`, "i"),
      new RegExp(`lacks?\\s+${component}`, "i")
    ];
    
    if (patterns.some(pattern => pattern.test(feedback))) {
      missing.push(component);
    }
  }
  
  // Also extract component IDs from feedback (e.g., "STMTURB12", "WTRPMP03")
  // This catches cases where feedback mentions specific component instances
  const componentIdPattern = /\b([A-Z]+)(\d+)\b/g;
  let match;
  while ((match = componentIdPattern.exec(feedback)) !== null) {
    const componentPrefix = match[1];
    // Check if this is a known component and not already in missing list
    if (powerPlantComponents.includes(componentPrefix) && !missing.includes(componentPrefix)) {
      missing.push(componentPrefix);
    }
  }
  
  return missing;
};

/**
 * Improve compression based on feedback
 */
export const improveCompression = async (originalLogs, currentCompressed, feedback, missingComponents) => {
  // If we have missing components, try to find them in original logs
  if (missingComponents.length > 0) {
    const lines = originalLogs.split("\n");
    const missingLines = [];
    
    for (const component of missingComponents) {
      // Find lines with this component
      const componentLines = lines.filter(line => 
        line.includes(component) && logLevels.critical.some(level => line.includes(`[${level}]`))
      );
      
      if (componentLines.length > 0) {
        // Take first occurrence of each missing component
        missingLines.push(componentLines[0]);
      }
    }
    
    if (missingLines.length > 0) {
      // Add missing lines to current compressed logs
      const combined = currentCompressed + "\n" + missingLines.join("\n");
      return compressLogs(combined, []);
    }
  }
  
  // Otherwise, re-compress with feedback context
  return compressLogs(originalLogs, missingComponents);
};

