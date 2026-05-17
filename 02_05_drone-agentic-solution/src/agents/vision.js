/**
 * Vision Agent
 * Analyzes drone map images, counts grid dimensions, and locates features
 */

import { callWithTools, formatToolResult } from "../core/ai.js";
import { toolRegistry } from "../core/tools.js";
import { agents } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Vision Agent Class
 * Specializes in visual analysis of drone maps
 */
class VisionAgent {
  constructor() {
    this.name = "vision";
    this.config = agents.vision;
    this.conversationHistory = [];
  }

  /**
   * Execute vision agent with analysis task
   * @param {Object} input - Input parameters
   * @param {string} [input.task] - Specific analysis task
   * @param {string} [input.focus] - What to focus on
   * @param {Object} [input.previousResult] - Previous analysis result if re-analyzing
   * @returns {Promise<Object>} Analysis result
   */
  async execute(input) {
    const { task = "analyze_map", focus = null, previousResult = null } = input;
    
    log.agent(this.name, "Starting visual analysis");
    
    // Build system prompt
    const systemPrompt = this._buildSystemPrompt();
    
    // Build user prompt
    const userPrompt = this._buildUserPrompt(task, focus, previousResult);
    
    // Get tools for vision agent
    const tools = toolRegistry.getToolsForAgent(this.name);
    
    log.info(`Vision agent has ${tools.length} tools available`);
    
    // Agent loop
    let iteration = 0;
    const maxIterations = 5;
    let analysisResult = null;
    
    while (iteration < maxIterations && !analysisResult) {
      iteration++;
      log.info(`Vision agent iteration ${iteration}`);
      
      try {
        // Call AI with tools
        const response = await callWithTools({
          model: this.config.model,
          systemPrompt,
          userPrompt: iteration === 1 ? userPrompt : "Continue with the analysis. Provide the final result.",
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
            content: response.text || "Analyzing..."
          });
          
          // Execute tools
          for (const toolCall of response.toolCalls) {
            try {
              const result = await toolRegistry.executeTool(
                toolCall.name,
                toolCall.arguments,
                { agent: this.name, iteration }
              );
              
              // Store result if it contains dam location
              if (result && result.success && 
                  (result.dam_column || result.grid_columns)) {
                analysisResult = result;
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
          // No tool calls, just text
          this.conversationHistory.push({
            role: "assistant",
            content: response.text
          });
          
          // Try to extract result from text if tools weren't used
          if (iteration >= 3) {
            log.warning("No tool calls after 3 iterations, using text response");
            analysisResult = {
              success: false,
              text: response.text,
              note: "Analysis incomplete - no tool calls made"
            };
            break;
          }
        }
        
      } catch (error) {
        log.error("Vision agent iteration failed", error.message);
        
        this.conversationHistory.push({
          role: "user",
          content: `Error: ${error.message}. Please try again with the available tools.`
        });
      }
    }
    
    // Compile final result
    const finalResult = {
      success: analysisResult !== null,
      agent: this.name,
      data: analysisResult,
      iterations: iteration,
      observations: this._extractObservations(analysisResult)
    };
    
    log.agent(this.name, `Analysis complete: ${finalResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    return finalResult;
  }

  /**
   * Build system prompt for vision agent
   * @private
   */
  _buildSystemPrompt() {
    return `You are the Vision Agent, a specialist in analyzing drone map images.

ROLE: ${this.config.role}

YOUR CAPABILITIES:
- Analyze drone map images using vision models
- Count grid dimensions precisely (columns and rows)
- Locate specific features like dams by color intensity
- Verify coordinates and locations
- Provide confidence scores for your findings

AVAILABLE TOOLS:
- analyze_map: General map analysis
- locate_feature: Find specific features (like dam) by color
- count_grid: Precisely count grid dimensions
- verify_location: Double-check coordinates

ANALYSIS APPROACH:
1. Use locate_feature to find the dam (look for intensified blue/cyan water)
2. The tool will automatically count the grid and provide coordinates
3. If needed, use verify_location to double-check
4. Always provide confidence scores

CRITICAL INSTRUCTIONS:
- Grid coordinates are 1-based (start at 1, not 0)
- Column numbers count from LEFT to RIGHT
- Row numbers count from TOP to BOTTOM
- The dam has intensified blue/cyan color
- Be precise with counting - this is critical for mission success

OUTPUT FORMAT:
Your analysis should identify:
- Grid dimensions (columns x rows)
- Dam location (column, row)
- Confidence level (high/medium/low)
- Any notable observations

Use the tools to perform the analysis. Do not guess - use vision tools to see the actual map.`;
  }

  /**
   * Build user prompt for vision agent
   * @private
   */
  _buildUserPrompt(task, focus, previousResult) {
    let prompt = `TASK: Analyze the drone map image to locate the dam and determine grid dimensions.

OBJECTIVE: Use your vision tools to:
1. Locate the dam (it has intensified blue/cyan water color)
2. Determine the exact grid coordinates (column, row)
3. Count the grid dimensions (total columns and rows)
4. Provide high confidence results

`;

    if (focus) {
      prompt += `FOCUS: ${focus}\n\n`;
    }

    if (previousResult) {
      prompt += `PREVIOUS RESULT (may be incorrect):
${JSON.stringify(previousResult, null, 2)}

Please re-analyze carefully and provide corrected coordinates if needed.\n\n`;
    }

    prompt += `Use the locate_feature tool to find the dam and get grid information. This tool will analyze the image and return precise coordinates.`;

    return prompt;
  }

  /**
   * Extract observations from analysis result
   * @private
   */
  _extractObservations(result) {
    const observations = [];
    
    if (!result) return observations;
    
    if (result.grid_columns && result.grid_rows) {
      observations.push(`Grid is ${result.grid_columns} columns x ${result.grid_rows} rows`);
    }
    
    if (result.dam_column && result.dam_row) {
      observations.push(`Dam located at column ${result.dam_column}, row ${result.dam_row}`);
    }
    
    if (result.confidence) {
      observations.push(`Confidence: ${result.confidence}`);
    }
    
    if (result.notes) {
      observations.push(result.notes);
    }
    
    return observations;
  }

  /**
   * Reset agent state
   */
  reset() {
    this.conversationHistory = [];
    log.info("Vision agent reset");
  }
}

// Export singleton instance
export const visionAgent = new VisionAgent();

export default VisionAgent;

// Made with Bob