/**
 * Coordinator Agent
 * Main orchestrator that manages mission flow and coordinates sub-agents
 */

import { callWithTools, formatToolResult } from "../core/ai.js";
import { toolRegistry } from "../core/tools.js";
import { agents } from "../config.js";
import log from "../helpers/logger.js";
import { createRequest, createSuccessResponse, messageLogger } from "../core/messages.js";

/**
 * Coordinator Agent Class
 * Orchestrates the entire drone mission by coordinating specialized agents
 */
class CoordinatorAgent {
  constructor() {
    this.name = "coordinator";
    this.config = agents.coordinator;
    this.conversationHistory = [];
    this.missionState = {
      initialized: false,
      mapAnalyzed: false,
      docFetched: false,
      instructionsBuilt: false,
      validated: false,
      complete: false,
      attempts: 0,
      maxAttempts: 10
    };
  }

  /**
   * Execute coordinator agent with a task
   * @param {Object} input - Input parameters
   * @param {string} input.task - Task description
   * @param {Object} [input.context] - Additional context
   * @returns {Promise<Object>} Execution result
   */
  async execute(input) {
    const { task, context = {} } = input;
    
    log.agent(this.name, "Starting mission coordination");
    log.info(`Task: ${task}`);
    
    // Initialize mission
    this.missionState.initialized = true;
    this.missionState.attempts++;
    
    // Build system prompt
    const systemPrompt = this._buildSystemPrompt();
    
    // Build user prompt
    const userPrompt = this._buildUserPrompt(task, context);
    
    // Get tools for coordinator
    const tools = toolRegistry.getToolsForAgent(this.name);
    
    log.info(`Coordinator has ${tools.length} tools available`);
    
    // Start agent loop
    let iteration = 0;
    const maxIterations = this.config.maxIterations || 50;
    let finalResult = null;
    
    while (iteration < maxIterations && !this.missionState.complete) {
      iteration++;
      log.info(`\n=== Coordinator Iteration ${iteration} ===`);
      
      try {
        // Call AI with tools
        const response = await callWithTools({
          model: this.config.model,
          systemPrompt,
          userPrompt: iteration === 1 ? userPrompt : "Continue with the mission based on the current state and previous results.",
          tools,
          conversationHistory: this.conversationHistory,
          maxOutputTokens: 4000
        });
        
        // Log reasoning if available
        if (response.reasoning) {
          log.info(`Reasoning: ${response.reasoning.substring(0, 200)}...`);
        }
        
        // Check for text response
        if (response.text) {
          log.info(`Response: ${response.text.substring(0, 200)}...`);
        }
        
        // Process tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          log.info(`Processing ${response.toolCalls.length} tool calls`);
          
          // Add assistant message to history
          this.conversationHistory.push({
            role: "assistant",
            content: response.text || "Processing tools..."
          });
          
          // Execute tools and collect results
          for (const toolCall of response.toolCalls) {
            log.tool(toolCall.name, "executing");
            
            try {
              const result = await toolRegistry.executeTool(
                toolCall.name,
                toolCall.arguments,
                { agent: this.name, iteration }
              );
              
              // Check if mission is complete
              if (toolCall.name === "complete_mission" || 
                  (result && result.hasFlag)) {
                this.missionState.complete = true;
                finalResult = result;
                log.success("Mission completed!");
              }
              
              // Add tool result to conversation history
              const toolResultMessage = formatToolResult(
                toolCall.id,
                toolCall.name,
                result
              );
              this.conversationHistory.push(toolResultMessage);
              
              log.tool(toolCall.name, "success");
            } catch (error) {
              log.error(`Tool execution failed: ${toolCall.name}`, error.message);
              
              // Add error to conversation history
              const errorMessage = formatToolResult(
                toolCall.id,
                toolCall.name,
                { error: error.message, success: false }
              );
              this.conversationHistory.push(errorMessage);
            }
          }
        } else {
          // No tool calls, just text response
          if (response.text) {
            this.conversationHistory.push({
              role: "assistant",
              content: response.text
            });
          }
          
          // Check if agent thinks mission is complete
          if (response.text && 
              (response.text.toLowerCase().includes("mission complete") ||
               response.text.toLowerCase().includes("flag obtained"))) {
            log.warning("Agent indicates completion but no complete_mission tool called");
            break;
          }
        }
        
        // Safety check: if no progress, break
        if (iteration > 5 && !this.missionState.mapAnalyzed) {
          log.warning("No progress after 5 iterations, stopping");
          break;
        }
        
      } catch (error) {
        log.error("Coordinator iteration failed", error.message);
        
        // Add error to history and continue
        this.conversationHistory.push({
          role: "user",
          content: `Error occurred: ${error.message}. Please continue with the mission.`
        });
      }
    }
    
    if (iteration >= maxIterations) {
      log.warning(`Reached maximum iterations (${maxIterations})`);
    }
    
    return {
      success: this.missionState.complete,
      result: finalResult,
      missionState: this.missionState,
      iterations: iteration,
      conversationLength: this.conversationHistory.length
    };
  }

  /**
   * Build system prompt for coordinator
   * @private
   */
  _buildSystemPrompt() {
    return `You are the Coordinator Agent for an autonomous drone control mission.

ROLE: ${this.config.role}

YOUR RESPONSIBILITIES:
1. Orchestrate all sub-agents to complete the drone mission
2. Maintain mission state and track progress
3. Decide which agents to activate and when
4. Store observations in long-term memory
5. Coordinate information flow between agents
6. Determine when mission is complete

AVAILABLE SUB-AGENTS:
- Vision Agent: Analyzes drone map, counts grid, locates dam
- Documentation Agent: Fetches and parses API documentation
- Builder Agent: Constructs instruction sequences
- Validator Agent: Submits instructions and interprets feedback

MISSION FLOW:
1. Activate Vision Agent to analyze map and locate dam
2. Activate Documentation Agent to understand API functions
3. Activate Builder Agent to construct instruction sequence
4. Activate Validator Agent to test instructions
5. If errors, analyze feedback and activate appropriate agent for fixes
6. Repeat until FLAG is obtained
7. Use complete_mission tool when successful

MEMORY MANAGEMENT:
- Store all important observations using store_observation
- Recall previous observations to avoid repeating work
- Update mission state as you progress
- Track validation attempts and feedback

DECISION MAKING:
- Always check current state before deciding next action
- Use memory to avoid redundant work
- Prioritize fixing errors based on validator feedback
- Be systematic and methodical

IMPORTANT:
- You must use tools to activate agents and manage state
- Do not try to solve the problem yourself - coordinate agents
- Store observations after each agent completes work
- When validator returns FLAG, use complete_mission tool immediately

Current mission state: ${JSON.stringify(this.missionState, null, 2)}`;
  }

  /**
   * Build user prompt for coordinator
   * @private
   */
  _buildUserPrompt(task, context) {
    return `MISSION: ${task}

OBJECTIVE: Autonomously solve the drone control challenge by coordinating specialized agents.

STEPS TO FOLLOW:
1. First, check if we have any previous observations in memory
2. Activate Vision Agent to analyze the drone map and locate the dam
3. Activate Documentation Agent to fetch and parse API documentation
4. Activate Builder Agent to construct the instruction sequence
5. Activate Validator Agent to submit instructions to the hub
6. If validation fails, analyze the error and activate the appropriate agent to fix it
7. Repeat validation until FLAG is obtained
8. Use complete_mission tool when successful

${context.previousAttempts ? `Previous attempts: ${context.previousAttempts}` : ''}

Begin by recalling any previous observations, then start coordinating the agents to complete the mission.`;
  }

  /**
   * Reset agent state
   */
  reset() {
    this.conversationHistory = [];
    this.missionState = {
      initialized: false,
      mapAnalyzed: false,
      docFetched: false,
      instructionsBuilt: false,
      validated: false,
      complete: false,
      attempts: 0,
      maxAttempts: 10
    };
    log.info("Coordinator agent reset");
  }

  /**
   * Get current state
   */
  getState() {
    return {
      missionState: this.missionState,
      conversationLength: this.conversationHistory.length
    };
  }
}

// Export singleton instance
export const coordinatorAgent = new CoordinatorAgent();

export default CoordinatorAgent;

// Made with Bob