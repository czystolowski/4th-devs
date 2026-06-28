/**
 * Instruction Builder Agent Tools
 * Tools for constructing and validating drone instruction sequences
 */

import { createToolDefinition, toolRegistry } from "../core/tools.js";
import { hub } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Build instruction sequence from requirements
 */
async function buildSequence(args, context) {
  const { 
    requirements, 
    damLocation, 
    apiCatalog, 
    previousAttempts = [],
    feedback = null 
  } = args;
  
  log.info("Building instruction sequence");
  
  // Validate inputs
  if (!damLocation || !damLocation.column || !damLocation.row) {
    throw new Error("Dam location with column and row is required");
  }
  
  const sequence = {
    instructions: [],
    reasoning: [],
    metadata: {
      damLocation,
      timestamp: new Date().toISOString(),
      attemptNumber: previousAttempts.length + 1
    }
  };
  
  // Build sequence based on requirements and feedback
  const steps = [];
  
  // Step 1: Engine control
  if (!feedback || !feedback.includes("engine")) {
    steps.push({
      instruction: "set(engineON)",
      reasoning: "Turn on drone engines"
    });
    steps.push({
      instruction: "set(100%)",
      reasoning: "Set engine power to 100%"
    });
  }
  
  // Step 2: Destination object (if API catalog includes it)
  if (apiCatalog && apiCatalog.includes("setDestinationObject")) {
    steps.push({
      instruction: `setDestinationObject(${requirements?.targetCode || hub.targetCode})`,
      reasoning: "Set destination object ID"
    });
  }
  
  // Step 3: Coordinates
  steps.push({
    instruction: `set(${damLocation.column},${damLocation.row})`,
    reasoning: `Set coordinates to dam location (column ${damLocation.column}, row ${damLocation.row})`
  });
  
  // Step 4: Height (if feedback mentions trees or obstacles)
  if (feedback && (feedback.toLowerCase().includes("tree") || 
                   feedback.toLowerCase().includes("dangerous") ||
                   feedback.toLowerCase().includes("obstacle"))) {
    steps.push({
      instruction: "set(50m)",
      reasoning: "Set height to 50m to clear obstacles (based on feedback)"
    });
  } else if (previousAttempts.length > 0) {
    // Add height on second attempt as precaution
    steps.push({
      instruction: "set(50m)",
      reasoning: "Set height to 50m to clear potential obstacles"
    });
  }
  
  // Step 5: Mission goal
  if (requirements?.mission === "destroy" || !requirements?.mission) {
    steps.push({
      instruction: "set(destroy)",
      reasoning: "Set mission goal to destroy target"
    });
  }
  
  // Step 6: Return instruction (if feedback mentions losing drone)
  if (feedback && (feedback.toLowerCase().includes("lose") || 
                   feedback.toLowerCase().includes("return") ||
                   feedback.toLowerCase().includes("forever"))) {
    steps.push({
      instruction: "set(return)",
      reasoning: "Add return instruction to prevent losing drone (based on feedback)"
    });
  } else if (previousAttempts.length > 0) {
    // Add return on second attempt as precaution
    steps.push({
      instruction: "set(return)",
      reasoning: "Add return instruction to ensure drone comes back"
    });
  }
  
  // Step 7: Execute
  steps.push({
    instruction: "flyToLocation",
    reasoning: "Execute the flight plan"
  });
  
  // Compile sequence
  sequence.instructions = steps.map(s => s.instruction);
  sequence.reasoning = steps.map(s => s.reasoning);
  
  log.info(`Built sequence with ${sequence.instructions.length} instructions`);
  
  return {
    success: true,
    ...sequence
  };
}

/**
 * Add instruction to existing sequence
 */
async function addInstruction(args, context) {
  const { sequence, instruction, position = "end", reasoning } = args;
  
  if (!sequence || !Array.isArray(sequence)) {
    throw new Error("Valid instruction sequence array is required");
  }
  
  if (!instruction) {
    throw new Error("Instruction is required");
  }
  
  log.info(`Adding instruction '${instruction}' at position '${position}'`);
  
  const newSequence = [...sequence];
  
  if (position === "start") {
    newSequence.unshift(instruction);
  } else if (position === "end") {
    newSequence.push(instruction);
  } else if (typeof position === "number") {
    newSequence.splice(position, 0, instruction);
  } else {
    throw new Error("Position must be 'start', 'end', or a number");
  }
  
  return {
    success: true,
    sequence: newSequence,
    added: instruction,
    position,
    reasoning: reasoning || `Added ${instruction} at ${position}`,
    count: newSequence.length
  };
}

/**
 * Validate instruction format
 */
async function validateFormat(args, context) {
  const { instructions } = args;
  
  if (!instructions || !Array.isArray(instructions)) {
    throw new Error("Instructions array is required");
  }
  
  log.info(`Validating format of ${instructions.length} instructions`);
  
  const validation = {
    success: true,
    valid: true,
    errors: [],
    warnings: [],
    instructions: []
  };
  
  // Known valid patterns
  const patterns = {
    set: /^set\((?:engineON|engineOFF|\d+%|destroy|return|\d+,\d+|\d+m)\)$/,
    setDestinationObject: /^setDestinationObject\([A-Z]{3}\d+[A-Z]{2}\)$/,
    flyToLocation: /^flyToLocation$/
  };
  
  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i];
    const result = {
      instruction,
      index: i,
      valid: false,
      type: null,
      issues: []
    };
    
    // Check against patterns
    if (patterns.set.test(instruction)) {
      result.valid = true;
      result.type = "set";
    } else if (patterns.setDestinationObject.test(instruction)) {
      result.valid = true;
      result.type = "setDestinationObject";
    } else if (patterns.flyToLocation.test(instruction)) {
      result.valid = true;
      result.type = "flyToLocation";
    } else {
      result.valid = false;
      result.issues.push("Does not match any known instruction pattern");
      validation.errors.push(`Instruction ${i}: '${instruction}' - Invalid format`);
      validation.valid = false;
    }
    
    validation.instructions.push(result);
  }
  
  // Check sequence logic
  const hasEngine = instructions.some(i => i.includes("engineON"));
  const hasFly = instructions.some(i => i === "flyToLocation");
  const hasCoordinates = instructions.some(i => /set\(\d+,\d+\)/.test(i));
  
  if (!hasEngine) {
    validation.warnings.push("No engine ON instruction found");
  }
  
  if (!hasFly) {
    validation.warnings.push("No flyToLocation instruction found");
  }
  
  if (!hasCoordinates) {
    validation.warnings.push("No coordinate instruction found");
  }
  
  // Check if flyToLocation is last
  if (hasFly && instructions[instructions.length - 1] !== "flyToLocation") {
    validation.warnings.push("flyToLocation should typically be the last instruction");
  }
  
  log.info(`Validation complete: ${validation.valid ? 'VALID' : 'INVALID'} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`);
  
  return validation;
}

/**
 * Reorder instructions to fix sequencing issues
 */
async function reorderInstructions(args, context) {
  const { instructions, strategy = "standard" } = args;
  
  if (!instructions || !Array.isArray(instructions)) {
    throw new Error("Instructions array is required");
  }
  
  log.info(`Reordering ${instructions.length} instructions using '${strategy}' strategy`);
  
  const reordered = [];
  const remaining = [...instructions];
  
  // Helper to extract and remove instruction
  const extract = (pattern) => {
    const index = remaining.findIndex(i => pattern.test(i));
    if (index !== -1) {
      return remaining.splice(index, 1)[0];
    }
    return null;
  };
  
  if (strategy === "standard") {
    // Standard order: engine -> power -> destination -> coordinates -> height -> mission -> return -> fly
    
    // 1. Engine ON
    const engineOn = extract(/set\(engineON\)/);
    if (engineOn) reordered.push(engineOn);
    
    // 2. Power
    const power = extract(/set\(\d+%\)/);
    if (power) reordered.push(power);
    
    // 3. Destination object
    const destination = extract(/setDestinationObject/);
    if (destination) reordered.push(destination);
    
    // 4. Coordinates
    const coords = extract(/set\(\d+,\d+\)/);
    if (coords) reordered.push(coords);
    
    // 5. Height
    const height = extract(/set\(\d+m\)/);
    if (height) reordered.push(height);
    
    // 6. Mission goal
    const mission = extract(/set\((destroy|repair|scan)\)/);
    if (mission) reordered.push(mission);
    
    // 7. Return
    const returnCmd = extract(/set\(return\)/);
    if (returnCmd) reordered.push(returnCmd);
    
    // 8. Any remaining set commands
    const otherSets = remaining.filter(i => i.startsWith("set("));
    reordered.push(...otherSets);
    remaining.splice(0, remaining.length, ...remaining.filter(i => !i.startsWith("set(")));
    
    // 9. Fly command (should be last)
    const fly = extract(/flyToLocation/);
    if (fly) reordered.push(fly);
    
    // 10. Any remaining instructions
    reordered.push(...remaining);
  } else if (strategy === "preserve") {
    // Preserve order but ensure flyToLocation is last
    const fly = extract(/flyToLocation/);
    reordered.push(...remaining);
    if (fly) reordered.push(fly);
  } else {
    throw new Error(`Unknown strategy: ${strategy}`);
  }
  
  const changes = [];
  for (let i = 0; i < Math.max(instructions.length, reordered.length); i++) {
    if (instructions[i] !== reordered[i]) {
      changes.push({
        position: i,
        from: instructions[i] || null,
        to: reordered[i] || null
      });
    }
  }
  
  log.info(`Reordering complete: ${changes.length} changes made`);
  
  return {
    success: true,
    original: instructions,
    reordered,
    changes,
    changeCount: changes.length,
    strategy
  };
}

// Tool definitions
const tools = [
  {
    definition: createToolDefinition(
      "build_sequence",
      "Construct a complete instruction sequence from requirements, dam location, and API catalog. Incorporates feedback from previous attempts.",
      {
        properties: {
          requirements: {
            type: "object",
            description: "Mission requirements (targetCode, mission type, etc.)"
          },
          damLocation: {
            type: "object",
            description: "Dam location with column and row properties",
            properties: {
              column: { type: "number" },
              row: { type: "number" }
            }
          },
          apiCatalog: {
            type: "array",
            description: "List of available API functions",
            items: { type: "string" }
          },
          previousAttempts: {
            type: "array",
            description: "Previous instruction sequences that were attempted",
            items: { type: "array" }
          },
          feedback: {
            type: "string",
            description: "Feedback from validator about what needs to be fixed"
          }
        },
        required: ["damLocation"]
      }
    ),
    executor: buildSequence
  },
  {
    definition: createToolDefinition(
      "add_instruction",
      "Add a single instruction to an existing sequence at a specific position.",
      {
        properties: {
          sequence: {
            type: "array",
            description: "Existing instruction sequence",
            items: { type: "string" }
          },
          instruction: {
            type: "string",
            description: "Instruction to add"
          },
          position: {
            type: ["string", "number"],
            description: "Where to add: 'start', 'end', or numeric index (default: 'end')"
          },
          reasoning: {
            type: "string",
            description: "Reason for adding this instruction"
          }
        },
        required: ["sequence", "instruction"]
      }
    ),
    executor: addInstruction
  },
  {
    definition: createToolDefinition(
      "validate_format",
      "Check instruction syntax and sequence logic. Returns validation errors and warnings.",
      {
        properties: {
          instructions: {
            type: "array",
            description: "Instruction sequence to validate",
            items: { type: "string" }
          }
        },
        required: ["instructions"]
      }
    ),
    executor: validateFormat
  },
  {
    definition: createToolDefinition(
      "reorder_instructions",
      "Fix instruction sequencing issues by reordering according to best practices.",
      {
        properties: {
          instructions: {
            type: "array",
            description: "Instruction sequence to reorder",
            items: { type: "string" }
          },
          strategy: {
            type: "string",
            description: "Reordering strategy: 'standard' (recommended order) or 'preserve' (keep order, fix critical issues)",
            enum: ["standard", "preserve"]
          }
        },
        required: ["instructions"]
      }
    ),
    executor: reorderInstructions
  }
];

// Register all tools for builder agent
toolRegistry.registerTools("builder", tools);

log.info("Builder agent tools registered");

export { buildSequence, addInstruction, validateFormat, reorderInstructions };

