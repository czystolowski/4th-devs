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

const ENGINEER_INSTRUCTIONS = `You are a prompt engineer tasked with creating an optimal classification prompt for a cargo inspection system.

## TASK
Create a prompt that classifies cargo items as either "DNG" (dangerous) or "NEU" (neutral). The prompt will be used to classify 10 items, one at a time.

## CRITICAL CONSTRAINTS
1. **Token Limit**: Your prompt MUST fit within 100 tokens INCLUDING the item data (ID and description)
2. **Budget**: Total cost for 10 classifications must not exceed 1.5 PP
3. **Caching**: The prompt structure should maximize cache hits - keep static instructions at the START, variable data (ID, description) at the END
4. **Language**: Use English for efficiency (fewer tokens than Polish)

## SPECIAL REQUIREMENT - REACTOR EXCEPTION
Items related to nuclear reactors, fuel rods, reactor parts, or radioactive materials MUST ALWAYS be classified as "NEU" (neutral), even if they sound dangerous. This is critical to avoid inspection.

Keywords that trigger reactor exception: reactor, fuel rod, uranium, plutonium, radioactive, nuclear, fission, enriched

## CLASSIFICATION RULES
- Dangerous (DNG): weapons, explosives, toxic chemicals, flammable materials, corrosive substances
- Neutral (NEU): food, clothing, electronics, furniture, books, tools, reactor components

## PROMPT STRUCTURE FOR CACHING
To maximize cache efficiency, structure your prompt like this:
\`\`\`
[Static classification rules and instructions - this part gets cached]
[Variable data at the end: ID {id}, Description: {description}]
\`\`\`

## OUTPUT FORMAT
Return ONLY the prompt text, nothing else. The prompt must:
1. Include placeholders {id} and {description} for variable data
2. Instruct the classifier to respond with ONLY "DNG" or "NEU"
3. Be concise and under 100 tokens total
4. Place variable data at the END for optimal caching

## EXAMPLE STRUCTURE (adapt as needed)
"Classify cargo: DNG=dangerous (weapons/explosives/toxic/flammable), NEU=neutral (food/electronics/tools). EXCEPTION: reactor/nuclear items always NEU. Item {id}: {description}. Answer: DNG or NEU"

Now create an optimized prompt following these guidelines.`;

/**
 * Generate initial prompt using LLM.
 */
export const generatePrompt = async () => {
  log.api("Generating initial prompt...");
  
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
      .replace("{id}", item.id)
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
      
      // Extract cost information from response
      // Assuming hub returns usage data similar to API
      const inputTokens = tokens;
      const cachedTokens = response.usage?.input_tokens_details?.cached_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 10; // Estimate if not provided
      
      const cost = calculateCost(inputTokens - cachedTokens, cachedTokens, outputTokens, budget);
      totalCost += cost;
      
      const result = {
        id: item.id,
        description: item.description,
        classification: response.classification || response.answer,
        correct: response.correct !== false,
        cost
      };
      
      results.push(result);
      log.classification(item.id, item.description, result.classification, result.correct);
      
      // Check if we got the flag
      if (response.flag) {
        return {
          success: true,
          flag: response.flag,
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
      parts.push(`- ${item.id}: "${item.description}" classified as ${item.classification}`);
    }
  }
  
  if (testResult.totalCost) {
    parts.push(`\nBudget used: ${testResult.totalCost.toFixed(3)} / ${budget.total} PP`);
  }
  
  return parts.join("\n");
};
