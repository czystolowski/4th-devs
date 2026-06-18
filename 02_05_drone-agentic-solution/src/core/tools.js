/**
 * Dynamic tool registry for agent-specific tool disclosure
 * Manages tool registration, retrieval, and execution
 */

import log from "../helpers/logger.js";

/**
 * Tool registry for managing agent tools
 */
class ToolRegistry {
  constructor() {
    // Map of agent name -> array of tool definitions
    this.agentTools = new Map();
    
    // Map of tool name -> execution function
    this.toolExecutors = new Map();
    
    // Tool execution history for debugging
    this.executionHistory = [];
  }

  /**
   * Register a tool for a specific agent
   * @param {string} agentName - Agent name
   * @param {Object} toolDefinition - Tool definition for API
   * @param {Function} executor - Tool execution function
   */
  registerTool(agentName, toolDefinition, executor) {
    if (!toolDefinition.type || toolDefinition.type !== "function") {
      throw new Error("Tool definition must have type: 'function'");
    }

    if (!toolDefinition.function?.name) {
      throw new Error("Tool definition must have function.name");
    }

    const toolName = toolDefinition.function.name;

    // Store tool definition for agent
    if (!this.agentTools.has(agentName)) {
      this.agentTools.set(agentName, []);
    }

    const agentToolList = this.agentTools.get(agentName);
    
    // Check if tool already registered for this agent
    const existingIndex = agentToolList.findIndex(
      t => t.function.name === toolName
    );

    if (existingIndex !== -1) {
      // Update existing tool
      agentToolList[existingIndex] = toolDefinition;
      log.info(`Updated tool '${toolName}' for agent '${agentName}'`);
    } else {
      // Add new tool
      agentToolList.push(toolDefinition);
      log.info(`Registered tool '${toolName}' for agent '${agentName}'`);
    }

    // Store executor
    this.toolExecutors.set(toolName, executor);
  }

  /**
   * Register multiple tools for an agent
   * @param {string} agentName - Agent name
   * @param {Array<Object>} tools - Array of {definition, executor} objects
   */
  registerTools(agentName, tools) {
    for (const { definition, executor } of tools) {
      this.registerTool(agentName, definition, executor);
    }
  }

  /**
   * Get all tools for a specific agent
   * @param {string} agentName - Agent name
   * @returns {Array} Array of tool definitions
   */
  getToolsForAgent(agentName) {
    return this.agentTools.get(agentName) || [];
  }

  /**
   * Get tool definition by name
   * @param {string} toolName - Tool name
   * @returns {Object|null} Tool definition or null
   */
  getToolDefinition(toolName) {
    for (const tools of this.agentTools.values()) {
      const tool = tools.find(t => t.function.name === toolName);
      if (tool) return tool;
    }
    return null;
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Tool name
   * @param {Object} args - Tool arguments
   * @param {Object} [context] - Execution context
   * @returns {Promise<*>} Tool execution result
   */
  async executeTool(toolName, args, context = {}) {
    const executor = this.toolExecutors.get(toolName);
    
    if (!executor) {
      throw new Error(`Tool '${toolName}' not found in registry`);
    }

    log.tool(toolName, "executing");

    const startTime = Date.now();
    let result;
    let error = null;

    try {
      result = await executor(args, context);
      log.tool(toolName, "success");
    } catch (err) {
      error = err;
      log.tool(toolName, "error");
      throw err;
    } finally {
      // Record execution history
      this.executionHistory.push({
        toolName,
        args,
        context,
        result: error ? null : result,
        error: error ? error.message : null,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  }

  /**
   * Execute multiple tool calls
   * @param {Array} toolCalls - Array of {name, arguments} objects
   * @param {Object} [context] - Execution context
   * @returns {Promise<Array>} Array of results
   */
  async executeToolCalls(toolCalls, context = {}) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(
          toolCall.name,
          toolCall.arguments,
          context
        );
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Format tool result for API response
   * @param {string} toolCallId - Tool call ID
   * @param {string} toolName - Tool name
   * @param {*} result - Tool result
   * @returns {Object} Formatted tool result
   */
  formatToolResult(toolCallId, toolName, result) {
    return {
      role: "tool",
      tool_call_id: toolCallId,
      tool_name: toolName,
      content: typeof result === "string" ? result : JSON.stringify(result, null, 2)
    };
  }

  /**
   * Check if agent has a specific tool
   * @param {string} agentName - Agent name
   * @param {string} toolName - Tool name
   * @returns {boolean} True if agent has tool
   */
  hasToolForAgent(agentName, toolName) {
    const tools = this.getToolsForAgent(agentName);
    return tools.some(t => t.function.name === toolName);
  }

  /**
   * Remove a tool from an agent
   * @param {string} agentName - Agent name
   * @param {string} toolName - Tool name
   * @returns {boolean} True if tool was removed
   */
  removeTool(agentName, toolName) {
    const tools = this.agentTools.get(agentName);
    if (!tools) return false;

    const initialLength = tools.length;
    const filtered = tools.filter(t => t.function.name !== toolName);
    
    if (filtered.length < initialLength) {
      this.agentTools.set(agentName, filtered);
      log.info(`Removed tool '${toolName}' from agent '${agentName}'`);
      return true;
    }

    return false;
  }

  /**
   * Clear all tools for an agent
   * @param {string} agentName - Agent name
   */
  clearAgentTools(agentName) {
    this.agentTools.delete(agentName);
    log.info(`Cleared all tools for agent '${agentName}'`);
  }

  /**
   * Get execution history
   * @param {Object} [filter] - Filter options
   * @param {string} [filter.toolName] - Filter by tool name
   * @param {number} [filter.limit] - Limit results
   * @returns {Array} Execution history
   */
  getExecutionHistory(filter = {}) {
    let history = [...this.executionHistory];

    if (filter.toolName) {
      history = history.filter(h => h.toolName === filter.toolName);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry stats
   */
  getStats() {
    const stats = {
      totalAgents: this.agentTools.size,
      totalTools: this.toolExecutors.size,
      totalExecutions: this.executionHistory.length,
      agentToolCounts: {}
    };

    for (const [agentName, tools] of this.agentTools.entries()) {
      stats.agentToolCounts[agentName] = tools.length;
    }

    return stats;
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
    log.info("Cleared tool execution history");
  }

  /**
   * List all registered agents
   * @returns {Array<string>} Agent names
   */
  listAgents() {
    return Array.from(this.agentTools.keys());
  }

  /**
   * List all registered tool names
   * @returns {Array<string>} Tool names
   */
  listTools() {
    return Array.from(this.toolExecutors.keys());
  }
}

/**
 * Create a tool definition for Responses API
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @param {Object} parameters - JSON Schema for parameters
 * @returns {Object} Tool definition
 */
export function createToolDefinition(name, description, parameters) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties: parameters.properties || {},
        required: parameters.required || [],
        ...(parameters.additionalProperties !== undefined 
          ? { additionalProperties: parameters.additionalProperties }
          : {})
      }
    }
  };
}

/**
 * Create a simple tool with no parameters
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @returns {Object} Tool definition
 */
export function createSimpleTool(name, description) {
  return createToolDefinition(name, description, {
    properties: {},
    required: []
  });
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();

export default ToolRegistry;

