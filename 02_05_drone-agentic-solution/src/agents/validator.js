/**
 * Validator Agent
 * Submits instructions to hub and interprets feedback for refinement
 */

import { callWithTools, formatToolResult } from "../core/ai.js";
import { toolRegistry } from "../core/tools.js";
import { agents } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Validator Agent Class
 * Specializes in testing instructions and analyzing errors
 */
class ValidatorAgent {
  constructor() {
    this.name = "validator";
    this.config = agents.validator;
    this.conversationHistory = [];
  }

  /**
   * Execute validator agent
   * @param {Object} input - Input parameters
   * @param {Array} input.instructions - Instruction sequence to validate
   * @param {number} [input.attemptNumber] - Attempt number
   * @returns {Promise<Object>} Validation result with feedback
   */
  async execute(input) {
    const { instructions, attemptNumber = 1 } = input;
    
    log.agent(this.name, `Starting validation (attempt ${attemptNumber})`);
    
    if (!instructions || !Array.isArray(instructions)) {
      throw new Error("Instructions array is required");
    }
    
    log.info(`Validating ${instructions.length} instructions`);
    
    // Build system prompt
    const systemPrompt = this._buildSystemPrompt();
    
    // Build user prompt
    const userPrompt = this._buildUserPrompt(instructions, attemptNumber);
    
    // Get tools for validator agent
    const tools = toolRegistry.getToolsForAgent(this.name);
    
    log.info(`Validator agent has ${tools.length} tools available`);
    
    // Agent loop
    let iteration = 0;
    const maxIterations = 5;
    let validationResult = null;
    
    while (iteration < maxIterations && !validationResult) {
      iteration++;
      log.info(`Validator agent iteration ${iteration}`);
      
      try {
        // Call AI with tools
        const response = await callWithTools({
          model: this.config.model,
          systemPrompt,
          userPrompt: iteration === 1 ? userPrompt : "Continue with validation analysis. Provide the final assessment.",
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
            content: response.text || "Validating..."
          });
          
          // Execute tools
          let submissionResult = null;
          let errorAnalysis = null;
          let issueIdentification = null;
          let fixSuggestions = null;
          
          for (const toolCall of response.toolCalls) {
            try {
              const result = await toolRegistry.executeTool(
                toolCall.name,
                toolCall.arguments,
                { agent: this.name, iteration }
              );
              
              // Track results by tool type
              if (toolCall.name === "submit_instructions") {
                submissionResult = result;
                
                // Check for FLAG
                if (result.hasFlag) {
                  log.success("FLAG OBTAINED!");
                  validationResult = {
                    success: true,
                    hasFlag: true,
                    result: result,
                    message: result.message,
                    instructions
                  };
                }
              } else if (toolCall.name === "parse_error") {
                errorAnalysis = result;
              } else if (toolCall.name === "identify_issue") {
                issueIdentification = result;
              } else if (toolCall.name === "suggest_fix") {
                fixSuggestions = result;
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
          
          // If we have submission result but no flag, compile error analysis
          if (submissionResult && !submissionResult.hasFlag && !validationResult) {
            validationResult = {
              success: false,
              hasFlag: false,
              submissionResult,
              errorAnalysis,
              issueIdentification,
              fixSuggestions,
              instructions,
              message: submissionResult.message
            };
          }
          
        } else if (response.text) {
          // No tool calls
          this.conversationHistory.push({
            role: "assistant",
            content: response.text
          });
          
          if (iteration >= 3) {
            log.warning("No tool calls after 3 iterations");
            validationResult = {
              success: false,
              hasFlag: false,
              text: response.text,
              note: "Validation incomplete - no submission made"
            };
            break;
          }
        }
        
      } catch (error) {
        log.error("Validator agent iteration failed", error.message);
        
        this.conversationHistory.push({
          role: "user",
          content: `Error: ${error.message}. Please use submit_instructions tool to validate the sequence.`
        });
      }
    }
    
    // Compile final result
    const finalResult = {
      success: validationResult !== null,
      agent: this.name,
      data: validationResult,
      iterations: iteration,
      observations: this._extractObservations(validationResult)
    };
    
    log.agent(this.name, `Validation complete: ${validationResult?.hasFlag ? 'FLAG OBTAINED' : 'ERRORS FOUND'}`);
    
    return finalResult;
  }

  /**
   * Build system prompt for validator agent
   * @private
   */
  _buildSystemPrompt() {
    return `You are the Validator Agent, a specialist in testing drone instructions and analyzing errors.

ROLE: ${this.config.role}

YOUR CAPABILITIES:
- Submit instruction sequences to the hub for validation
- Parse error messages to extract actionable details
- Identify which component needs fixing
- Suggest specific fixes based on error analysis

AVAILABLE TOOLS:
- submit_instructions: POST instructions to hub /verify endpoint
- parse_error: Extract error details from response
- identify_issue: Categorize problem and determine affected agent
- suggest_fix: Generate specific fix recommendations

VALIDATION WORKFLOW:
1. Submit instructions using submit_instructions
2. Check if response contains FLAG (success indicator)
3. If no FLAG, parse the error message
4. Identify which agent needs to fix the issue
5. Suggest specific fixes

ERROR INTERPRETATION:
- "wrong coordinates" → Vision agent needs to re-analyze
- "unknown instruction" → Documentation agent needs to verify functions
- "dangerous" or "tree" → Builder needs to add height
- "lose" or "forever" → Builder needs to add return instruction
- "engine" or "power" → Builder needs engine control instructions

SUCCESS DETECTION:
- Response contains "{{FLG:" → Mission successful!
- Response contains "FLAG" → Mission successful!

IMPORTANT:
- Always submit instructions first
- If FLAG is found, report success immediately
- If error, provide detailed analysis and fix suggestions
- Be specific about which agent should handle the fix

Use the tools systematically to validate and analyze the instruction sequence.`;
  }

  /**
   * Build user prompt for validator agent
   * @private
   */
  _buildUserPrompt(instructions, attemptNumber) {
    let prompt = `TASK: Validate the drone instruction sequence by submitting it to the hub.

INSTRUCTION SEQUENCE (Attempt ${attemptNumber}):
${JSON.stringify(instructions, null, 2)}

VALIDATION STEPS:
1. Use submit_instructions to send these instructions to the hub
2. Check the response for FLAG (success indicator)
3. If FLAG found, report success
4. If error found, use parse_error to analyze it
5. Use identify_issue to determine which agent should fix it
6. Use suggest_fix to provide specific recommendations

`;

    if (attemptNumber > 1) {
      prompt += `This is attempt ${attemptNumber}. Previous attempts had errors that should have been fixed.

`;
    }

    prompt += `Start by submitting the instructions using the submit_instructions tool.`;

    return prompt;
  }

  /**
   * Extract observations from validation result
   * @private
   */
  _extractObservations(result) {
    const observations = [];
    
    if (!result) return observations;
    
    if (result.hasFlag) {
      observations.push("FLAG OBTAINED - Mission successful!");
      if (result.message) {
        observations.push(`Message: ${result.message}`);
      }
    } else if (result.message) {
      observations.push(`Validation failed: ${result.message}`);
      
      if (result.errorAnalysis) {
        observations.push(`Error type: ${result.errorAnalysis.errorType}`);
        if (result.errorAnalysis.details) {
          observations.push(...result.errorAnalysis.details);
        }
      }
      
      if (result.issueIdentification) {
        observations.push(`Affected agent: ${result.issueIdentification.affectedAgent}`);
        observations.push(`Action required: ${result.issueIdentification.actionRequired}`);
      }
      
      if (result.fixSuggestions && result.fixSuggestions.fixes) {
        observations.push(`Fix suggestions: ${result.fixSuggestions.fixes.length} recommendations`);
      }
    }
    
    return observations;
  }

  /**
   * Reset agent state
   */
  reset() {
    this.conversationHistory = [];
    log.info("Validator agent reset");
  }
}

// Export singleton instance
export const validatorAgent = new ValidatorAgent();

export default ValidatorAgent;

