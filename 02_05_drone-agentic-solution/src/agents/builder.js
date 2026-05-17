/**
 * Builder Agent
 * Constructs drone instruction sequences from requirements and feedback
 */

import { callWithTools, formatToolResult } from "../core/ai.js";
import { toolRegistry } from "../core/tools.js";
import { agents } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Builder Agent Class
 * Specializes in constructing valid instruction sequences
 */
class BuilderAgent {
  constructor() {
    this.name = "builder";
    this.config = agents.builder;
    this.conversationHistory = [];
  }

  /**
   * Execute builder agent
   * @param {Object} input - Input parameters
   * @param {Object} input.damLocation - Dam location {column, row}
   * @param {Array} [input.apiCatalog] - Available API functions
   * @param {Array} [input.previousAttempts] - Previous instruction sequences
   * @param {string} [input.feedback] - Feedback from validator
   * @param {Object} [input.requirements] - Mission requirements
   * @returns {Promise<Object>} Built instruction sequence
   */
  async execute(input) {
    const { 
      damLocation, 
      apiCatalog = [], 
      previousAttempts = [], 
      feedback = null,
      requirements = {}
    } = input;
    
    log.agent(this.name, "Starting instruction sequence construction");
    
    if (!damLocation || !damLocation.column || !damLocation.row) {
      throw new Error("Dam location with column and row is required");
    }
    
    // Build system prompt
    const systemPrompt = this._buildSystemPrompt();
    
    // Build user prompt
    const userPrompt = this._buildUserPrompt(
      damLocation, 
      apiCatalog, 
      previousAttempts, 
      feedback,
      requirements
    );
    
    // Get tools for builder agent
    const tools = toolRegistry.getToolsForAgent(this.name);
    
    log.info(`Builder agent has ${tools.length} tools available`);
    
    // Agent loop
    let iteration = 0;
    const maxIterations = 5;
    let instructionSequence = null;
    
    while (iteration < maxIterations && !instructionSequence) {
      iteration++;
      log.info(`Builder agent iteration ${iteration}`);
      
      try {
        // Call AI with tools
        const response = await callWithTools({
          model: this.config.model,
          systemPrompt,
          userPrompt: iteration === 1 ? userPrompt : "Continue building the instruction sequence. Provide the final validated sequence.",
          tools,
          conversationHistory: this.conversationHistory,
          maxOutputTokens: 4000
        });
        
        // Log reasoning
        if (response.reasoning) {
          log.info(`Reasoning: ${response.reasoning.substring(0, 150)}...`);
        }
        
        // Process tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          log.info(`Processing ${response.toolCalls.length} tool calls`);
          
          // Add assistant message
          this.conversationHistory.push({
            role: "assistant",
            content: response.text || "Building instructions..."
          });
          
          // Execute tools
          for (const toolCall of response.toolCalls) {
            try {
              const result = await toolRegistry.executeTool(
                toolCall.name,
                toolCall.arguments,
                { agent: this.name, iteration }
              );
              
              // Check if we got a complete sequence
              if (result && result.success) {
                if (toolCall.name === "build_sequence" && result.instructions) {
                  instructionSequence = result;
                } else if (toolCall.name === "validate_format" && result.valid) {
                  // If validation passed and we have instructions in history
                  const buildResult = this._findBuildResult();
                  if (buildResult) {
                    instructionSequence = buildResult;
                  }
                } else if (toolCall.name === "reorder_instructions" && result.reordered) {
                  instructionSequence = {
                    success: true,
                    instructions: result.reordered,
                    reasoning: result.changes.map(c => 
                      `Moved ${c.from} to position ${c.position}`
                    ),
                    metadata: {
                      reordered: true,
                      changeCount: result.changeCount
                    }
                  };
                }
              }
              
              // Add tool result to history
              const toolResultMessage = formatToolResult(
                toolCall.id,
                toolCall.name,
                result
              );
              this.conversationHistory.push(toolResultMessage);
              
            } catch (error) {
              log.error(`Tool execution failed: ${toolCall.name}`, error.message);
              
              const errorMessage = formatToolResult(
                toolCall.id,
                toolCall.name,
                { error: error.message, success: false }
              );
              this.conversationHistory.push(errorMessage);
            }
          }
        } else if (response.text) {
          // No tool calls
          this.conversationHistory.push({
            role: "assistant",
            content: response.text
          });
          
          if (iteration >= 3) {
            log.warning("No tool calls after 3 iterations");
            break;
          }
        }
        
      } catch (error) {
        log.error("Builder agent iteration failed", error.message);
        
        this.conversationHistory.push({
          role: "user",
          content: `Error: ${error.message}. Please use build_sequence tool to create the instruction sequence.`
        });
      }
    }
    
    // Compile final result
    const finalResult = {
      success: instructionSequence !== null,
      agent: this.name,
      data: instructionSequence,
      iterations: iteration,
      observations: this._extractObservations(instructionSequence)
    };
    
    log.agent(this.name, `Instruction building complete: ${finalResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (finalResult.success && instructionSequence.instructions) {
      log.info(`Built ${instructionSequence.instructions.length} instructions`);
    }
    
    return finalResult;
  }

  /**
   * Build system prompt for builder agent
   * @private
   */
  _buildSystemPrompt() {
    return `You are the Builder Agent, a specialist in constructing drone instruction sequences.

ROLE: ${this.config.role}

YOUR CAPABILITIES:
- Build complete instruction sequences from requirements
- Incorporate feedback from validation attempts
- Validate instruction format and syntax
- Reorder instructions for proper sequencing
- Add missing instructions based on feedback

AVAILABLE TOOLS:
- build_sequence: Construct complete instruction sequence
- add_instruction: Add single instruction to sequence
- validate_format: Check instruction syntax
- reorder_instructions: Fix instruction ordering

INSTRUCTION BUILDING RULES:
1. Standard sequence order:
   - Engine control (engineON, power %)
   - Destination object (if available in API)
   - Coordinates (column, row)
   - Height (to clear obstacles)
   - Mission goal (destroy, etc.)
   - Return instruction
   - Execute (flyToLocation)

2. Common instruction formats:
   - set(engineON) - Turn on engines
   - set(100%) - Set power to 100%
   - setDestinationObject(CODE) - Set target (format: [A-Z]{3}[0-9]+[A-Z]{2})
   - set(column,row) - Set coordinates
   - set(50m) - Set height
   - set(destroy) - Set mission goal
   - set(return) - Add return instruction
   - flyToLocation - Execute flight

3. Feedback interpretation:
   - "dangerous" or "tree" → Add height instruction
   - "lose" or "forever" → Add return instruction
   - "unknown instruction" → Check function names
   - "wrong coordinates" → Verify dam location
   - "engine" or "power" → Add engine instructions

IMPORTANT:
- Always use build_sequence tool first
- Validate the sequence before returning
- Incorporate all feedback from previous attempts
- Ensure proper instruction ordering

Use the tools to build a valid, complete instruction sequence.`;
  }

  /**
   * Build user prompt for builder agent
   * @private
   */
  _buildUserPrompt(damLocation, apiCatalog, previousAttempts, feedback, requirements) {
    let prompt = `TASK: Build a complete drone instruction sequence.

DAM LOCATION:
- Column: ${damLocation.column}
- Row: ${damLocation.row}

`;

    if (apiCatalog && apiCatalog.length > 0) {
      prompt += `AVAILABLE API FUNCTIONS:
${apiCatalog.join(", ")}

`;
    }

    if (requirements.targetCode) {
      prompt += `TARGET CODE: ${requirements.targetCode}

`;
    }

    if (previousAttempts && previousAttempts.length > 0) {
      prompt += `PREVIOUS ATTEMPTS: ${previousAttempts.length}
Last attempt: ${JSON.stringify(previousAttempts[previousAttempts.length - 1])}

`;
    }

    if (feedback) {
      prompt += `VALIDATOR FEEDBACK:
${feedback}

IMPORTANT: Incorporate this feedback into the new instruction sequence!

`;
    }

    prompt += `Use the build_sequence tool to construct the instruction sequence. The tool will automatically:
- Include engine control instructions
- Set the destination object (if available)
- Set coordinates to the dam location
- Add height if needed (based on feedback or previous attempts)
- Add return instruction (based on feedback or previous attempts)
- Add mission goal and execute command

After building, optionally use validate_format to check the sequence.`;

    return prompt;
  }

  /**
   * Find build result in conversation history
   * @private
   */
  _findBuildResult() {
    // Look for build_sequence result in history
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const msg = this.conversationHistory[i];
      if (msg.role === "tool" && msg.tool_name === "build_sequence") {
        try {
          const result = JSON.parse(msg.content);
          if (result.success && result.instructions) {
            return result;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    return null;
  }

  /**
   * Extract observations from build result
   * @private
   */
  _extractObservations(result) {
    const observations = [];
    
    if (!result) return observations;
    
    if (result.instructions && result.instructions.length > 0) {
      observations.push(`Built ${result.instructions.length} instructions`);
      observations.push(`Instructions: ${result.instructions.join(", ")}`);
    }
    
    if (result.reasoning && Array.isArray(result.reasoning)) {
      observations.push(...result.reasoning);
    }
    
    if (result.metadata) {
      if (result.metadata.reordered) {
        observations.push(`Reordered ${result.metadata.changeCount} instructions`);
      }
    }
    
    return observations;
  }

  /**
   * Reset agent state
   */
  reset() {
    this.conversationHistory = [];
    log.info("Builder agent reset");
  }
}

// Export singleton instance
export const builderAgent = new BuilderAgent();

export default BuilderAgent;

// Made with Bob