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
  // Handle both formats: [timestamp] [LEVEL] or timestamp [LEVEL]
  const match = line.match(/\[?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]?\s+\[(\w+)\]\s+(.+)/);
  
  if (!match) return null;
  
  const messageText = match[3];
  
  // Extract component from message - try with number first, then without
  let component = null;
  let componentId = null;
  
  // Try pattern with number (e.g., "ECCS8", "STMTURB12")
  const componentWithNum = messageText.match(/\b([A-Z]{3,})(\d+)\b/);
  if (componentWithNum) {
    component = componentWithNum[1];
    componentId = componentWithNum[0];
  } else {
    // Try pattern without number for components like "WTRPMP", "FIRMWARE"
    for (const comp of powerPlantComponents) {
      if (messageText.includes(comp)) {
        component = comp;
        componentId = comp;
        break;
      }
    }
  }
  
  return {
    timestamp: match[1],
    level: match[2],
    component: component,
    componentId: componentId,
    message: messageText
  };
};

/**
 * Pre-process logs to remove redundancy and normalize format
 */
const preprocessLogs = (logText) => {
  const lines = logText.split("\n").filter(l => l.trim());
  const processed = [];
  const componentEntries = new Map(); // Track entries per component
  
  for (const line of lines) {
    const entry = parseLogEntry(line);
    if (!entry || !entry.component) continue;
    
    // Normalize timestamp format (remove brackets if present)
    const timestamp = entry.timestamp.replace(/[\[\]]/g, '');
    
    // Reconstruct line in consistent format
    const normalizedLine = `${timestamp} [${entry.level}] ${entry.message}`;
    
    // Group by component to ensure all components are represented
    if (!componentEntries.has(entry.component)) {
      componentEntries.set(entry.component, []);
    }
    componentEntries.get(entry.component).push({
      line: normalizedLine,
      level: entry.level,
      timestamp: timestamp
    });
  }
  
  // For each component, keep diverse entries (different levels and time periods)
  for (const [component, entries] of componentEntries) {
    // Sort by timestamp
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    
    // Keep first ERRO/CRIT, and sample of WARN entries
    const critical = entries.filter(e => e.level === 'CRIT' || e.level === 'ERRO');
    const warnings = entries.filter(e => e.level === 'WARN');
    
    // Add all critical entries
    critical.forEach(e => processed.push(e.line));
    
    // Add sample of warnings (first, middle, last to show progression)
    if (warnings.length > 0) {
      processed.push(warnings[0].line); // First warning
      if (warnings.length > 2) {
        processed.push(warnings[Math.floor(warnings.length / 2)].line); // Middle
      }
      if (warnings.length > 1) {
        processed.push(warnings[warnings.length - 1].line); // Last warning
      }
    }
  }
  
  // Sort by timestamp to maintain chronological order
  processed.sort((a, b) => {
    const timeA = a.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1] || '';
    const timeB = b.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1] || '';
    return timeA.localeCompare(timeB);
  });
  
  return processed.join("\n");
};

/**
 * Compress logs using AI while preserving key information
 */
export const compressLogs = async (logText, missingComponents = []) => {
  // Pre-process logs to remove redundancy
  const preprocessed = preprocessLogs(logText);
  
  const instructions = `You are a log compression expert. Compress power plant failure logs to ABSOLUTE MINIMUM while preserving critical information.

ULTRA-AGGRESSIVE COMPRESSION RULES:
1. Format: HH:MM [LVL] CMP: msg (remove date, use 3-letter level codes)
2. Abbreviate everything: temperature→temp, pressure→pres, cooling→cool, emergency→emerg, reactor→react
3. Remove articles (a, the), conjunctions, filler words
4. Use symbols: →(to/into), ↑(increase/high), ↓(decrease/low), !(critical), ?(uncertain)
5. Combine related events on same line if same component+time
${missingComponents.length > 0 ? `6. MUST include: ${missingComponents.join(", ")}` : ""}

Components: ${powerPlantComponents.join(", ")}

Examples:
"2024-01-15 10:23:45 [ERRO] ECCS8 reported runaway outlet temperature. Protection interlock initiated reactor trip."
→ "10:23 [ERR] ECCS8: runaway temp→react trip"

"2024-01-15 10:25:12 [CRIT] WTANK07 coolant level below critical threshold, shutdown moving to hard trip"
→ "10:25 [CRT] WTANK07: coolant↓crit→hard trip"

Output ONLY compressed lines, no markdown, no explanations.`;

  const input = `Compress:\n\n${preprocessed}`;

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
      // Find lines with this component - get both ERRO and CRIT levels
      const componentLines = lines.filter(line =>
        line.includes(component) && logLevels.critical.some(level => line.includes(`[${level}]`))
      );
      
      if (componentLines.length > 0) {
        // Take multiple occurrences to ensure component story is told
        // Get first CRIT or ERRO
        const critical = componentLines.find(l => l.includes('[CRIT]') || l.includes('[ERRO]'));
        if (critical) missingLines.push(critical);
        
        // Get a WARN if no critical found
        if (!critical && componentLines.length > 0) {
          missingLines.push(componentLines[0]);
        }
      }
    }
    
    if (missingLines.length > 0) {
      // Add missing lines to current compressed logs and return WITHOUT re-compressing
      // This preserves the missing component entries
      const combined = currentCompressed + "\n" + missingLines.join("\n");
      
      // Sort by timestamp to maintain chronological order
      const allLines = combined.split("\n").filter(l => l.trim());
      allLines.sort((a, b) => {
        const timeA = a.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1] || '';
        const timeB = b.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1] || '';
        return timeA.localeCompare(timeB);
      });
      
      return allLines.join("\n");
    }
  }
  
  // Otherwise, re-compress with feedback context
  return compressLogs(originalLogs, missingComponents);
};

