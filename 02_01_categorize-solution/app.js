/**
 * Categorize Solution - Agentic Prompt Optimization
 * 
 * This agent iteratively designs and tests classification prompts
 * to solve the cargo categorization challenge within strict constraints:
 * - 100 token prompt limit
 * - 1.5 PP budget for 10 classifications
 * - Must use prompt caching for efficiency
 * - Reactor items must always be classified as neutral
 */

import { fetchCsvData, resetHub } from "./src/helpers/hub.js";
import { generatePrompt, improvePrompt, testPrompt, generateFeedback } from "./src/agent.js";
import log from "./src/helpers/logger.js";

const MAX_ATTEMPTS = 10;

const getApiKey = () => {
  const key = process.env.AIDEVS_API_KEY;
  if (!key) {
    throw new Error("AIDEVS_API_KEY not found in environment");
  }
  return key;
};

const main = async () => {
  log.box("Categorize Solution\nAgentic Prompt Optimization");
  
  const apiKey = getApiKey();
  
  try {
    // Fetch fresh CSV data
    log.start("Fetching CSV data from hub...");
    const items = await fetchCsvData(apiKey);
    log.success(`Loaded ${items.length} items to classify`);
    
    // Display items
    console.log("\nItems to classify:");
    for (const item of items) {
      console.log(`  ${item.id}: ${item.description}`);
    }
    console.log("");
    
    // Generate initial prompt
    let currentPrompt = await generatePrompt();
    
    // Iterative improvement loop
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      log.attempt(attempt);
      
      // Reset hub counter for fresh attempt
      if (attempt > 1) {
        log.reset();
        await resetHub(apiKey);
      }
      
      console.log(`\nTesting prompt:\n"${currentPrompt}"\n`);
      
      // Test the prompt
      const result = await testPrompt(apiKey, currentPrompt, items);
      
      log.budget(result.totalCost, 1.5);
      
      // Check if we succeeded
      if (result.success && result.flag) {
        log.flag(result.flag);
        console.log("\n✓ Task completed successfully!");
        console.log(`  Attempts: ${attempt}`);
        console.log(`  Final cost: ${result.totalCost.toFixed(3)} PP`);
        console.log(`  Final prompt: "${currentPrompt}"`);
        return;
      }
      
      // Generate feedback and improve
      if (!result.success) {
        const feedback = generateFeedback(result);
        console.log(`\nFeedback:\n${feedback}\n`);
        
        if (attempt < MAX_ATTEMPTS) {
          log.start("Improving prompt...");
          currentPrompt = await improvePrompt(currentPrompt, feedback);
        } else {
          log.error("Max attempts reached", "Could not find optimal prompt");
          break;
        }
      }
    }
    
    log.error("Failed", "Could not solve the task within attempt limit");
    
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
