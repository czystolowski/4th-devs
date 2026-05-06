/**
 * Failure Log Compression Solution
 * 
 * Main orchestration - handles all data processing:
 * - Download, filter, deduplicate, format
 * - Token counting and verification
 * - Iterative improvement loop
 * 
 * Agent only handles: compression logic
 */

import { fetchLogFile, verifyLogs, countTokens } from "./src/helpers/hub.js";
import { compressLogs } from "./src/agent.js";
import log from "./src/helpers/logger.js";
import { writeFile } from "fs/promises";
import { join } from "path";

const getApiKey = () => {
  const key = process.env.AGENT_TOKEN;
  if (!key) {
    throw new Error("AGENT_TOKEN not found in environment");
  }
  return key;
};

const saveToWorkspace = async (filename, content) => {
  const filepath = join(process.cwd(), "workspace", filename);
  await writeFile(filepath, content, "utf-8");
  return filepath;
};

/**
 * Filter logs to only CRIT level
 */
const filterCriticalLogs = (logText) => {
  const lines = logText.split("\n");
  return lines.filter(line => {
    const trimmed = line.trim();
    return trimmed && trimmed.includes("[CRIT]");
  }).join("\n");
};

/**
 * Remove duplicate log entries
 */
const removeDuplicates = (logText) => {
  const lines = logText.split("\n").filter(l => l.trim());
  const seen = new Set();
  const unique = [];
  
  for (const line of lines) {
    // Normalize for comparison (remove timestamp variations)
    const normalized = line.replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/, "TIME");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(line);
    }
  }
  
  return unique.join("\n");
};

/**
 * Format logs consistently
 */
const formatLogs = (logText) => {
  const lines = logText.split("\n").filter(l => l.trim());
  return lines.map(line => {
    // Ensure consistent format: [timestamp] [LEVEL] message
    const match = line.match(/\[?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]?\s+\[(\w+)\]\s+(.+)/);
    if (match) {
      return `[${match[1]}] [${match[2]}] ${match[3]}`;
    }
    return line;
  }).join("\n");
};

/**
 * Check if within token budget
 */
const checkBudget = (text, maxTokens = 1500) => {
  const tokens = countTokens(text);
  const withinBudget = tokens <= maxTokens;
  return {
    tokens,
    withinBudget,
    maxTokens,
    remaining: maxTokens - tokens
  };
};

const main = async () => {
  log.box("Failure Log Compression\nRule-Based Processing\nAI Compression");
  
  const apiKey = getApiKey();
  const MAX_ATTEMPTS = 10;
  
  try {
    // Step 1: Download
    log.start("Downloading failure logs from hub...");
    const rawLogs = await fetchLogFile(apiKey);
    log.success(`Downloaded ${rawLogs.length} characters`);
    await saveToWorkspace("raw-logs.txt", rawLogs);
    console.log("");
    
    // Step 2: Filter to CRIT only
    log.start("Filtering to CRIT level only...");
    let processedLogs = filterCriticalLogs(rawLogs);
    const critCount = processedLogs.split("\n").filter(l => l.trim()).length;
    log.success(`Filtered to ${critCount} CRIT entries`);
    
    // Step 3: Remove duplicates
    log.start("Removing duplicates...");
    processedLogs = removeDuplicates(processedLogs);
    const uniqueCount = processedLogs.split("\n").filter(l => l.trim()).length;
    log.success(`${uniqueCount} unique entries (removed ${critCount - uniqueCount} duplicates)`);
    
    // Step 4: Format consistently
    processedLogs = formatLogs(processedLogs);
    await saveToWorkspace("processed-logs.txt", processedLogs);
    log.info("Saved: workspace/processed-logs.txt");
    
    // Check initial token count
    const initialBudget = checkBudget(processedLogs);
    log.info(`Initial: ${initialBudget.tokens}/${initialBudget.maxTokens} tokens`);
    console.log("");
    
    // Step 5: Compress with AI if needed
    let compressedLogs = processedLogs;
    
    if (!initialBudget.withinBudget) {
      log.start("Compressing with AI...");
      compressedLogs = await compressLogs(processedLogs);
      log.success("Compression complete");
      
      const compressedBudget = checkBudget(compressedLogs);
      log.info(`Compressed: ${compressedBudget.tokens}/${compressedBudget.maxTokens} tokens`);
      
      await saveToWorkspace("compressed-v1.txt", compressedLogs);
      console.log("");
    }
    
    // Step 6: Verify with hub
    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
      log.step(attempt, MAX_ATTEMPTS, "Verifying with hub...");
      
      const budget = checkBudget(compressedLogs);
      
      if (!budget.withinBudget) {
        log.error("Still over budget", `${budget.tokens}/${budget.maxTokens} tokens`);
        log.warning("Need manual compression - check workspace/compressed-v1.txt");
        break;
      }
      
      try {
        const result = await verifyLogs(apiKey, compressedLogs);
        
        // Check for flag in result.flag or in result.message
        const flagMatch = result.flag || (result.message && result.message.match(/\{FLG:([^}]+)\}/));
        const flag = result.flag || (flagMatch ? flagMatch[0] : null);
        
        if (flag) {
          log.flag(flag);
          console.log("\n✓ Challenge solved!");
          
          await saveToWorkspace("final-solution.txt", compressedLogs);
          await saveToWorkspace("solution-metadata.json", JSON.stringify({
            attempts: attempt,
            finalTokens: budget.tokens,
            flag: result.flag
          }, null, 2));
          
          break;
        }
        
        // Show feedback
        const feedback = result.message || JSON.stringify(result);
        log.warning("Verification failed");
        console.log(`Feedback: ${feedback}\n`);
        
        // If hub says token budget exceeded, try compressing more
        if (feedback.includes("token") || feedback.includes("context window")) {
          log.start("Re-compressing based on feedback...");
          compressedLogs = await compressLogs(processedLogs, feedback);
          log.success("Re-compressed");
          
          const newBudget = checkBudget(compressedLogs);
          log.info(`New: ${newBudget.tokens}/${newBudget.maxTokens} tokens`);
          
          await saveToWorkspace(`compressed-v${attempt + 1}.txt`, compressedLogs);
          console.log("");
        }
        
        attempt++;
        
        if (attempt > MAX_ATTEMPTS) {
          log.error("Max attempts reached");
          break;
        }
        
      } catch (error) {
        log.error("Verification error", error.message);
        throw error;
      }
    }
    
    console.log("\n📁 Results in: workspace/");
    
  } catch (error) {
    log.error("Error", error.message);
    console.error(error);
    process.exit(1);
  }
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});
