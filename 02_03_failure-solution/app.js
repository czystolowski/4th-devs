/**
 * Failure Log Compression Solution
 *
 * Solves the log compression challenge by:
 * 1. Downloading large log file from hub
 * 2. Filtering only critical events (WARN, ERRO, CRIT)
 * 3. Compressing logs using AI while preserving key information
 * 4. Iteratively improving based on hub feedback
 * 5. Submitting until flag is received
 */

import { fetchLogFile, verifyLogs, formatBudgetStatus, isWithinBudget } from "./src/helpers/hub.js";
import { 
  filterCriticalLogs, 
  identifyComponents, 
  compressLogs, 
  analyzeFeedback,
  improveCompression 
} from "./src/agent.js";
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

const main = async () => {
  log.box("Failure Log Compression\nAI-Powered Log Analysis\nIterative Solving");
  
  const apiKey = getApiKey();
  
  try {
    // Step 1: Download log file
    log.start("Downloading failure logs from hub...");
    const rawLogs = await fetchLogFile(apiKey);
    log.success(`Downloaded ${rawLogs.length} characters`);
    
    await saveToWorkspace("raw-logs.txt", rawLogs);
    log.info("Saved: workspace/raw-logs.txt");
    console.log("");
    
    // Step 2: Filter critical logs
    log.start("Filtering critical events (WARN, ERRO, CRIT)...");
    const criticalLogs = filterCriticalLogs(rawLogs);
    const criticalLines = criticalLogs.split("\n").filter(l => l.trim()).length;
    log.success(`Filtered to ${criticalLines} critical log entries`);
    
    await saveToWorkspace("critical-logs.txt", criticalLogs);
    log.info("Saved: workspace/critical-logs.txt");
    
    // Identify components
    const components = identifyComponents(criticalLogs);
    log.info(`Components found: ${components.join(", ")}`);
    console.log("");
    
    // Step 3: Initial compression
    log.start("Compressing logs with AI...");
    let compressedLogs = await compressLogs(criticalLogs);
    log.success("Initial compression complete");
    log.info(formatBudgetStatus(compressedLogs));
    
    await saveToWorkspace("compressed-v1.txt", compressedLogs);
    log.info("Saved: workspace/compressed-v1.txt");
    console.log("");
    
    // Step 4: Iterative verification and improvement
    const MAX_ATTEMPTS = 10;
    let attempt = 1;
    let missingComponents = [];
    
    while (attempt <= MAX_ATTEMPTS) {
      log.step(attempt, MAX_ATTEMPTS, "Verifying with hub...");
      
      // Check token budget before submitting
      const budgetCheck = isWithinBudget(compressedLogs);
      if (!budgetCheck.withinBudget) {
        log.error("Token budget exceeded", `${budgetCheck.tokens} tokens (limit: ${budgetCheck.maxTokens})`);
        log.warning("Need to compress further...");
        
        // Try to compress more aggressively
        compressedLogs = await compressLogs(compressedLogs, missingComponents);
        log.info(formatBudgetStatus(compressedLogs));
        continue;
      }
      
      try {
        const result = await verifyLogs(apiKey, compressedLogs);
        
        if (result.flag) {
          log.flag(result.flag);
          console.log("\n✓ Challenge solved successfully!");
          
          await saveToWorkspace("final-compressed.txt", compressedLogs);
          log.info("Saved: workspace/final-compressed.txt");
          
          await saveToWorkspace("solution-metadata.json", JSON.stringify({
            attempts: attempt,
            finalTokens: budgetCheck.tokens,
            maxTokens: budgetCheck.maxTokens,
            flag: result.flag,
            components: components
          }, null, 2));
          
          break;
        }
        
        // Analyze feedback
        const feedback = result.message || JSON.stringify(result);
        log.warning("Verification failed");
        console.log(`Feedback: ${feedback}\n`);
        
        // Look for missing components in feedback
        missingComponents = analyzeFeedback(feedback);
        if (missingComponents.length > 0) {
          log.info(`Missing components detected: ${missingComponents.join(", ")}`);
        }
        
        // Improve compression based on feedback
        log.start("Improving compression based on feedback...");
        compressedLogs = await improveCompression(criticalLogs, compressedLogs, feedback, missingComponents);
        log.success("Compression improved");
        log.info(formatBudgetStatus(compressedLogs));
        
        await saveToWorkspace(`compressed-v${attempt + 1}.txt`, compressedLogs);
        log.info(`Saved: workspace/compressed-v${attempt + 1}.txt`);
        console.log("");
        
        attempt++;
        
        if (attempt > MAX_ATTEMPTS) {
          log.error("Max attempts reached", "Could not solve challenge");
          break;
        }
        
      } catch (error) {
        log.error("Verification error", error.message);
        
        // If it's a token budget error from hub, compress more
        if (error.message.includes("token") || error.message.includes("too long")) {
          log.warning("Hub rejected due to length - compressing further...");
          compressedLogs = await compressLogs(compressedLogs, missingComponents);
          log.info(formatBudgetStatus(compressedLogs));
          continue;
        }
        
        throw error;
      }
    }
    
    console.log("\n📁 Results saved to: workspace/");
    
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

