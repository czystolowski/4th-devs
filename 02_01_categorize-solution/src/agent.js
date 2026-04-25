/**
 * Prompt Engineer Agent
 *
 * Uses an LLM to iteratively design and improve classification prompts
 * based on feedback from the hub.
 */

import { chat, extractText, extractReasoning } from "./helpers/api.js";
import { verifyPrompt, countTokens, calculateCost } from "./helpers/hub.js";
import { budget, constraints } from "./config.js";
import log from "./helpers/logger.js";

/**
 * Generate a simple rule-based prompt (no LLM needed).
 * This is fast and cheap, good for initial attempt.
 */
const generateSimplePrompt = () => {
  return "DNG=weapons/explosives/toxic/flammable. NEU=food/tools/electronics/reactor/nuclear. Reply DNG or NEU. {code}: {description}";
};

const ENGINEER_INSTRUCTIONS = `You are a prompt engineer. Create a classification prompt for cargo inspection.

## RULES
1. Token limit: 100 tokens INCLUDING item data
2. Must include {code} and {description} placeholders
3. Static rules FIRST, variable data LAST (for caching)
4. Classify as DNG (dangerous) or NEU (neutral)
5. Reactor/nuclear items ALWAYS NEU

## CRITICAL
Return ONLY the raw prompt text. NO explanations, NO markdown, NO extra text.
Just the prompt that will be sent to the classifier.

## EXAMPLE
DNG=weapons/explosives/toxic. NEU=food/tools/reactor/nuclear. Reply DNG or NEU. {code}: {description}`;

/**
 * Generate initial prompt.
 * Try simple rule-based first, only use LLM if needed.
 */
export const generatePrompt = async (useSimple = true) => {
  if (useSimple) {
    log.api("Using simple rule-based prompt...");
    return generateSimplePrompt();
  }
  
  log.api("Generating prompt with LLM...");
  
  const response = await chat({
    input: [{ role: "user", content: "Create the classification prompt." }],
    instructions: ENGINEER_INSTRUCTIONS
  });
  
  const prompt = extractText(response);
  log.reasoning(extractReasoning(response));
  
  return prompt.trim();
};

/**
 * Improve prompt based on feedback.
 */
export const improvePrompt = async (currentPrompt, feedback) => {
  log.api("Improving prompt based on feedback...");
  
  const message = `Current prompt:\n${currentPrompt}\n\nFeedback from testing:\n${feedback}\n\nImprove the prompt to fix these issues while staying under 100 tokens and maintaining cache efficiency.`;
  
  const response = await chat({
    input: [{ role: "user", content: message }],
    instructions: ENGINEER_INSTRUCTIONS
  });
  
  const improvedPrompt = extractText(response);
  log.reasoning(extractReasoning(response));
  
  return improvedPrompt.trim();
};

/**
 * Test a prompt against all items and track budget.
 */
export const testPrompt = async (apiKey, promptTemplate, items) => {
  let totalCost = 0;
  const results = [];
  
  for (const item of items) {
    // Replace placeholders with actual data
    const prompt = promptTemplate
      .replace("{code}", item.code)
      .replace("{description}", item.description);
    
    const tokens = countTokens(prompt);
    log.prompt(prompt, tokens);
    
    if (tokens > constraints.maxPromptTokens) {
      return {
        success: false,
        error: `Prompt too long: ${tokens} tokens (max ${constraints.maxPromptTokens})`,
        results,
        totalCost
      };
    }
    
    try {
      const response = await verifyPrompt(apiKey, prompt);
      
      // Extract cost information from response debug data
      const debugInfo = response.debug || {};
      const inputTokens = debugInfo.tokens || tokens;
      const cachedTokens = debugInfo.cached_tokens || 0;
      const outputTokens = 10; // Small output (DNG or NEU)
      
      const cost = calculateCost(inputTokens - cachedTokens, cachedTokens, outputTokens, budget);
      totalCost += cost;
      
      const result = {
        code: item.code,
        description: item.description,
        classification: debugInfo.output || response.message,
        correct: debugInfo.result === "correct classification",
        cost
      };
      
      results.push(result);
      log.classification(item.code, item.description, result.classification, result.correct);

      if (debugInfo.flag || response.message?.includes("ACCEPTED")) {
        return {
          success: true,
          flag: debugInfo.flag || response.message,
          results,
          totalCost
        };
      }
      
      // Check budget
      if (totalCost > budget.total) {
        return {
          success: false,
          error: `Budget exceeded: ${totalCost.toFixed(3)} PP > ${budget.total} PP`,
          results,
          totalCost
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results,
        totalCost
      };
    }
  }
  
  // All items classified but no flag received
  const failedItems = results.filter(r => !r.correct);
  if (failedItems.length > 0) {
    return {
      success: false,
      error: `${failedItems.length} items misclassified`,
      results,
      totalCost,
      failedItems
    };
  }
  
  return {
    success: true,
    results,
    totalCost
  };
};

/**
 * Generate feedback for prompt improvement.
 */
export const generateFeedback = (testResult) => {
  const parts = [];
  
  if (testResult.error) {
    parts.push(`Error: ${testResult.error}`);
  }
  
  if (testResult.failedItems?.length > 0) {
    parts.push(`\nMisclassified items:`);
    for (const item of testResult.failedItems) {
      parts.push(`- ${item.code}: "${item.description}" classified as ${item.classification}`);
    }
  }
  
  if (testResult.totalCost) {
    parts.push(`\nBudget used: ${testResult.totalCost.toFixed(3)} / ${budget.total} PP`);
  }
  
  return parts.join("\n");
};
