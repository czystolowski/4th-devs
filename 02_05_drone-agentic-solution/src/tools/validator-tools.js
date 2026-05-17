/**
 * Validator Agent Tools
 * Tools for submitting instructions and interpreting feedback
 */

import { createToolDefinition, toolRegistry } from "../core/tools.js";
import { AGENT_TOKEN } from "../../../config.js";
import { hub } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Submit instructions to hub for verification
 */
async function submitInstructions(args, context) {
  const { instructions } = args;
  
  if (!instructions || !Array.isArray(instructions)) {
    throw new Error("Instructions array is required");
  }
  
  if (!AGENT_TOKEN) {
    throw new Error("AGENT_TOKEN not found in environment");
  }
  
  log.info(`Submitting ${instructions.length} instructions to hub`);
  
  const response = await fetch(`${hub.baseUrl}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      task: hub.task,
      answer: {
        instructions
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hub API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  // Check if we got the FLAG (success)
  const hasFlag = result.message && result.message.includes("{{FLG:");
  
  if (hasFlag) {
    log.success("FLAG OBTAINED! Mission successful!");
  } else {
    log.info("Submission result received (no flag yet)");
  }
  
  return {
    success: true,
    hasFlag,
    result,
    message: result.message || result.error || "No message",
    code: result.code,
    instructions
  };
}

/**
 * Parse error message to extract actionable details
 */
async function parseError(args, context) {
  const { errorMessage, fullResponse } = args;
  
  if (!errorMessage && !fullResponse) {
    throw new Error("Either errorMessage or fullResponse is required");
  }
  
  const message = errorMessage || fullResponse?.message || fullResponse?.error || "";
  
  log.info("Parsing error message");
  
  const parsed = {
    success: true,
    originalMessage: message,
    errorType: "unknown",
    details: [],
    keywords: []
  };
  
  const lowerMessage = message.toLowerCase();
  
  // Identify error type based on keywords
  if (lowerMessage.includes("unknown instruction") || lowerMessage.includes("invalid instruction")) {
    parsed.errorType = "invalid_instruction";
    parsed.details.push("One or more instructions are not recognized by the API");
    
    // Try to extract which instruction
    const instructionMatch = message.match(/instruction[:\s]+([^\s,;.]+)/i);
    if (instructionMatch) {
      parsed.invalidInstruction = instructionMatch[1];
      parsed.details.push(`Invalid instruction: ${instructionMatch[1]}`);
    }
  }
  
  if (lowerMessage.includes("wrong coordinates") || lowerMessage.includes("incorrect location")) {
    parsed.errorType = "wrong_coordinates";
    parsed.details.push("The coordinates provided do not match the target location");
    parsed.keywords.push("coordinates", "location");
  }
  
  if (lowerMessage.includes("dangerous") || lowerMessage.includes("tree") || lowerMessage.includes("obstacle")) {
    parsed.errorType = "obstacle_collision";
    parsed.details.push("Flight path would collide with obstacles (trees, etc.)");
    parsed.details.push("Need to add height parameter to clear obstacles");
    parsed.keywords.push("height", "altitude", "obstacle");
  }
  
  if (lowerMessage.includes("engine") || lowerMessage.includes("power")) {
    parsed.errorType = "engine_issue";
    parsed.details.push("Engine or power settings are missing or incorrect");
    parsed.keywords.push("engine", "power");
  }
  
  if (lowerMessage.includes("lose") || lowerMessage.includes("forever") || lowerMessage.includes("return")) {
    parsed.errorType = "missing_return";
    parsed.details.push("Drone will be lost without return instruction");
    parsed.details.push("Need to add set(return) instruction");
    parsed.keywords.push("return");
  }
  
  if (lowerMessage.includes("destination") || lowerMessage.includes("target")) {
    parsed.errorType = "destination_issue";
    parsed.details.push("Destination or target specification is missing or incorrect");
    parsed.keywords.push("destination", "target");
  }
  
  if (lowerMessage.includes("sequence") || lowerMessage.includes("order")) {
    parsed.errorType = "sequence_issue";
    parsed.details.push("Instructions are in wrong order");
    parsed.keywords.push("sequence", "order");
  }
  
  if (lowerMessage.includes("missing") || lowerMessage.includes("required")) {
    parsed.errorType = "missing_parameter";
    parsed.details.push("Required parameter or instruction is missing");
    
    // Try to extract what's missing
    const missingMatch = message.match(/missing[:\s]+([^\s,;.]+)/i);
    if (missingMatch) {
      parsed.missingItem = missingMatch[1];
      parsed.details.push(`Missing: ${missingMatch[1]}`);
    }
  }
  
  // Check for success indicators
  if (lowerMessage.includes("flg:") || lowerMessage.includes("flag")) {
    parsed.errorType = "success";
    parsed.details.push("FLAG obtained - mission successful!");
  }
  
  log.info(`Error type identified: ${parsed.errorType}`);
  
  return parsed;
}

/**
 * Identify the type of issue from error
 */
async function identifyIssue(args, context) {
  const { errorMessage, instructions } = args;
  
  if (!errorMessage) {
    throw new Error("Error message is required");
  }
  
  log.info("Identifying issue type and affected component");
  
  const issue = {
    success: true,
    category: "unknown",
    affectedAgent: null,
    priority: "medium",
    actionRequired: null,
    confidence: "medium"
  };
  
  const lowerMessage = errorMessage.toLowerCase();
  
  // Map error types to agents and actions
  if (lowerMessage.includes("wrong coordinates") || lowerMessage.includes("incorrect location")) {
    issue.category = "coordinates";
    issue.affectedAgent = "vision";
    issue.priority = "high";
    issue.actionRequired = "re_analyze_map";
    issue.confidence = "high";
    issue.description = "Vision agent needs to re-analyze map for correct coordinates";
  } else if (lowerMessage.includes("unknown instruction") || lowerMessage.includes("invalid instruction")) {
    issue.category = "api_function";
    issue.affectedAgent = "documentation";
    issue.priority = "high";
    issue.actionRequired = "re_check_documentation";
    issue.confidence = "high";
    issue.description = "Documentation agent needs to verify correct function names";
  } else if (lowerMessage.includes("dangerous") || lowerMessage.includes("tree") || lowerMessage.includes("obstacle")) {
    issue.category = "flight_safety";
    issue.affectedAgent = "builder";
    issue.priority = "high";
    issue.actionRequired = "add_height_parameter";
    issue.confidence = "high";
    issue.description = "Builder needs to add height instruction to clear obstacles";
  } else if (lowerMessage.includes("lose") || lowerMessage.includes("forever") || lowerMessage.includes("return")) {
    issue.category = "return_missing";
    issue.affectedAgent = "builder";
    issue.priority = "high";
    issue.actionRequired = "add_return_instruction";
    issue.confidence = "high";
    issue.description = "Builder needs to add return instruction";
  } else if (lowerMessage.includes("engine") || lowerMessage.includes("power")) {
    issue.category = "engine_control";
    issue.affectedAgent = "builder";
    issue.priority = "high";
    issue.actionRequired = "add_engine_instructions";
    issue.confidence = "high";
    issue.description = "Builder needs to add engine control instructions";
  } else if (lowerMessage.includes("sequence") || lowerMessage.includes("order")) {
    issue.category = "instruction_order";
    issue.affectedAgent = "builder";
    issue.priority = "medium";
    issue.actionRequired = "reorder_instructions";
    issue.confidence = "medium";
    issue.description = "Builder needs to reorder instructions";
  } else if (lowerMessage.includes("missing") || lowerMessage.includes("required")) {
    issue.category = "missing_parameter";
    issue.affectedAgent = "builder";
    issue.priority = "high";
    issue.actionRequired = "add_missing_parameter";
    issue.confidence = "medium";
    issue.description = "Builder needs to add missing parameter or instruction";
  }
  
  // Check if it's actually success
  if (lowerMessage.includes("flg:") || lowerMessage.includes("flag") || lowerMessage.includes("success")) {
    issue.category = "success";
    issue.affectedAgent = null;
    issue.priority = "none";
    issue.actionRequired = "complete_mission";
    issue.confidence = "high";
    issue.description = "Mission completed successfully";
  }
  
  log.info(`Issue identified: ${issue.category} (affects ${issue.affectedAgent || 'none'})`);
  
  return issue;
}

/**
 * Suggest fix based on error analysis
 */
async function suggestFix(args, context) {
  const { errorMessage, instructions, issueType } = args;
  
  if (!errorMessage && !issueType) {
    throw new Error("Either errorMessage or issueType is required");
  }
  
  log.info("Generating fix suggestions");
  
  const suggestion = {
    success: true,
    fixes: [],
    priority: "medium",
    estimatedImpact: "medium"
  };
  
  const message = errorMessage?.toLowerCase() || "";
  const issue = issueType?.toLowerCase() || "";
  
  // Generate specific fixes based on error type
  if (message.includes("wrong coordinates") || issue.includes("coordinates")) {
    suggestion.fixes.push({
      action: "activate_vision_agent",
      description: "Re-analyze map to get correct dam coordinates",
      parameters: { focus: "dam location verification" }
    });
    suggestion.priority = "high";
    suggestion.estimatedImpact = "high";
  }
  
  if (message.includes("unknown instruction") || issue.includes("api_function")) {
    suggestion.fixes.push({
      action: "activate_doc_agent",
      description: "Re-check API documentation for correct function names",
      parameters: { focus: "function signatures" }
    });
    suggestion.fixes.push({
      action: "rebuild_sequence",
      description: "Rebuild instruction sequence with correct function names",
      parameters: { useUpdatedCatalog: true }
    });
    suggestion.priority = "high";
    suggestion.estimatedImpact = "high";
  }
  
  if (message.includes("dangerous") || message.includes("tree") || issue.includes("obstacle")) {
    suggestion.fixes.push({
      action: "add_instruction",
      description: "Add height parameter to clear obstacles",
      parameters: { 
        instruction: "set(50m)",
        position: "before_mission_goal",
        reasoning: "Clear trees and obstacles"
      }
    });
    suggestion.priority = "high";
    suggestion.estimatedImpact = "high";
  }
  
  if (message.includes("lose") || message.includes("forever") || issue.includes("return")) {
    suggestion.fixes.push({
      action: "add_instruction",
      description: "Add return instruction to prevent losing drone",
      parameters: { 
        instruction: "set(return)",
        position: "before_fly",
        reasoning: "Ensure drone returns after mission"
      }
    });
    suggestion.priority = "high";
    suggestion.estimatedImpact = "high";
  }
  
  if (message.includes("engine") || message.includes("power") || issue.includes("engine")) {
    suggestion.fixes.push({
      action: "add_instruction",
      description: "Add engine control instructions",
      parameters: { 
        instructions: ["set(engineON)", "set(100%)"],
        position: "start",
        reasoning: "Initialize engine before flight"
      }
    });
    suggestion.priority = "high";
    suggestion.estimatedImpact = "high";
  }
  
  if (message.includes("sequence") || message.includes("order") || issue.includes("order")) {
    suggestion.fixes.push({
      action: "reorder_instructions",
      description: "Fix instruction sequence order",
      parameters: { 
        strategy: "standard"
      }
    });
    suggestion.priority = "medium";
    suggestion.estimatedImpact = "medium";
  }
  
  // If no specific fix identified, suggest general rebuild
  if (suggestion.fixes.length === 0) {
    suggestion.fixes.push({
      action: "rebuild_sequence",
      description: "Rebuild instruction sequence with feedback incorporated",
      parameters: { 
        feedback: errorMessage,
        previousAttempt: instructions
      }
    });
    suggestion.priority = "medium";
    suggestion.estimatedImpact = "medium";
  }
  
  log.info(`Generated ${suggestion.fixes.length} fix suggestions`);
  
  return suggestion;
}

// Tool definitions
const tools = [
  {
    definition: createToolDefinition(
      "submit_instructions",
      "Submit instruction sequence to hub /verify endpoint. Returns result with success flag and any error messages.",
      {
        properties: {
          instructions: {
            type: "array",
            description: "Array of instruction strings to submit",
            items: { type: "string" }
          }
        },
        required: ["instructions"]
      }
    ),
    executor: submitInstructions
  },
  {
    definition: createToolDefinition(
      "parse_error",
      "Extract detailed error information from hub response. Identifies error type and extracts actionable details.",
      {
        properties: {
          errorMessage: {
            type: "string",
            description: "Error message string to parse"
          },
          fullResponse: {
            type: "object",
            description: "Full response object from hub (alternative to errorMessage)"
          }
        },
        required: []
      }
    ),
    executor: parseError
  },
  {
    definition: createToolDefinition(
      "identify_issue",
      "Categorize the problem type and determine which agent needs to fix it. Returns issue category, affected agent, and required action.",
      {
        properties: {
          errorMessage: {
            type: "string",
            description: "Error message to analyze"
          },
          instructions: {
            type: "array",
            description: "Instructions that caused the error (optional)",
            items: { type: "string" }
          }
        },
        required: ["errorMessage"]
      }
    ),
    executor: identifyIssue
  },
  {
    definition: createToolDefinition(
      "suggest_fix",
      "Generate specific fix recommendations based on error analysis. Returns actionable steps to resolve the issue.",
      {
        properties: {
          errorMessage: {
            type: "string",
            description: "Error message to base suggestions on"
          },
          instructions: {
            type: "array",
            description: "Current instruction sequence (optional)",
            items: { type: "string" }
          },
          issueType: {
            type: "string",
            description: "Pre-identified issue type (optional)"
          }
        },
        required: []
      }
    ),
    executor: suggestFix
  }
];

// Register all tools for validator agent
toolRegistry.registerTools("validator", tools);

log.info("Validator agent tools registered");

export { submitInstructions, parseError, identifyIssue, suggestFix };

// Made with Bob