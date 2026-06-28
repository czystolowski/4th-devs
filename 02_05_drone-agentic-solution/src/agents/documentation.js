/**
 * Documentation Agent
 * Fetches and parses API documentation to build function catalog
 */

import { callWithTools, formatToolResult } from "../core/ai.js";
import { toolRegistry } from "../core/tools.js";
import { agents } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Documentation Agent Class
 * Specializes in understanding API documentation
 */
class DocumentationAgent {
  constructor() {
    this.name = "documentation";
    this.config = agents.documentation;
    this.conversationHistory = [];
  }

  /**
   * Execute documentation agent
   * @param {Object} input - Input parameters
   * @param {string} [input.task] - Specific documentation task
   * @param {string} [input.focus] - What to focus on
   * @returns {Promise<Object>} Documentation analysis result
   */
  async execute(input) {
    const { task = "fetch_and_parse", focus = null } = input;
    
    log.agent(this.name, "Starting documentation analysis");
    
    // Build system prompt
    const systemPrompt = this._buildSystemPrompt();
    
    // Build user prompt
    const userPrompt = this._buildUserPrompt(task, focus);
    
    // Get tools for documentation agent
    const tools = toolRegistry.getToolsForAgent(this.name);
    
    log.info(`Documentation agent has ${tools.length} tools available`);
    
    // Agent loop
    let iteration = 0;
    const maxIterations = 5;
    let docResult = null;
    
    while (iteration < maxIterations && !docResult) {
      iteration++;
      log.info(`Documentation agent iteration ${iteration}`);
      
      try {
        // Call AI with tools
        const response = await callWithTools({
          model: this.config.model,
          systemPrompt,
          userPrompt: iteration === 1 ? userPrompt : "Continue extracting API functions and their parameters.",
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
            content: response.text || "Analyzing documentation..."
          });
          
          // Execute tools
          let htmlContent = null;
          let functions = null;
          
          for (const toolCall of response.toolCalls) {
            try {
              const result = await toolRegistry.executeTool(
                toolCall.name,
                toolCall.arguments,
                { agent: this.name, iteration }
              );
              
              // Store HTML for subsequent calls
              if (toolCall.name === "fetch_documentation" && result.success) {
                htmlContent = result.html;
              }
              
              // Store functions if extracted
              if (toolCall.name === "extract_functions" && result.success) {
                functions = result.functions;
              }
              
              // If we have functions, we're done
              if (functions && functions.length > 0) {
                docResult = {
                  success: true,
                  functions,
                  functionNames: functions.map(f => f.name),
                  count: functions.length
                };
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
            docResult = {
              success: false,
              text: response.text,
              note: "Documentation extraction incomplete"
            };
            break;
          }
        }
        
      } catch (error) {
        log.error("Documentation agent iteration failed", error.message);
        
        this.conversationHistory.push({
          role: "user",
          content: `Error: ${error.message}. Please try again using the available tools.`
        });
      }
    }
    
    // Compile final result
    const finalResult = {
      success: docResult !== null && docResult.success,
      agent: this.name,
      data: docResult,
      iterations: iteration,
      observations: this._extractObservations(docResult)
    };
    
    log.agent(this.name, `Documentation analysis complete: ${finalResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    return finalResult;
  }

  /**
   * Build system prompt for documentation agent
   * @private
   */
  _buildSystemPrompt() {
    return `You are the Documentation Agent, a specialist in parsing and understanding API documentation.

ROLE: ${this.config.role}

YOUR CAPABILITIES:
- Fetch HTML documentation from URLs
- Parse HTML to extract structured information
- Identify API functions and their signatures
- Understand parameter requirements and formats
- Build comprehensive function catalogs

AVAILABLE TOOLS:
- fetch_documentation: Get HTML documentation from hub
- parse_html: Extract structured data from HTML
- extract_functions: Find all API function signatures
- understand_parameters: Analyze parameter requirements

ANALYSIS APPROACH:
1. First, fetch the documentation using fetch_documentation
2. Then, extract functions using extract_functions (pass the HTML)
3. Optionally, use understand_parameters for detailed parameter info
4. Build a complete catalog of available functions

IMPORTANT:
- Function names must be exact (case-sensitive)
- Note any overloaded functions (same name, different parameters)
- Identify required vs optional parameters
- Extract parameter formats (e.g., regex patterns for IDs)

OUTPUT FORMAT:
Your analysis should provide:
- List of all available API functions
- Function signatures with parameters
- Parameter requirements and formats
- Any special notes about function usage

Use the tools systematically to extract complete API information.`;
  }

  /**
   * Build user prompt for documentation agent
   * @private
   */
  _buildUserPrompt(task, focus) {
    let prompt = `TASK: Fetch and parse the drone API documentation to build a complete function catalog.

OBJECTIVE: Use your tools to:
1. Fetch the HTML documentation from the hub
2. Extract all API function names and signatures
3. Understand parameter requirements
4. Build a comprehensive function catalog

`;

    if (focus) {
      prompt += `FOCUS: ${focus}\n\n`;
    }

    prompt += `Start by using fetch_documentation to get the HTML, then use extract_functions to find all available API functions.

The documentation is available at the default URL (you don't need to specify it).`;

    return prompt;
  }

  /**
   * Extract observations from documentation result
   * @private
   */
  _extractObservations(result) {
    const observations = [];
    
    if (!result) return observations;
    
    if (result.functions && result.functions.length > 0) {
      observations.push(`Found ${result.functions.length} API functions`);
      
      // List function names
      const functionNames = result.functions.map(f => f.name).join(", ");
      observations.push(`Functions: ${functionNames}`);
      
      // Note overloaded functions
      const nameCounts = {};
      result.functions.forEach(f => {
        nameCounts[f.name] = (nameCounts[f.name] || 0) + 1;
      });
      
      const overloaded = Object.entries(nameCounts)
        .filter(([name, count]) => count > 1)
        .map(([name]) => name);
      
      if (overloaded.length > 0) {
        observations.push(`Overloaded functions: ${overloaded.join(", ")}`);
      }
    }
    
    return observations;
  }

  /**
   * Reset agent state
   */
  reset() {
    this.conversationHistory = [];
    log.info("Documentation agent reset");
  }
}

// Export singleton instance
export const documentationAgent = new DocumentationAgent();

export default DocumentationAgent;

