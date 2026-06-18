/**
 * Agent communication protocol
 * Defines message formats, validation, and response handling
 */

import log from "../helpers/logger.js";

/**
 * Message types
 */
export const MessageType = {
  REQUEST: "request",
  RESPONSE: "response",
  ERROR: "error",
  NOTIFICATION: "notification"
};

/**
 * Create a request message
 * @param {Object} params - Message parameters
 * @param {string} params.from - Sender agent name
 * @param {string} params.to - Recipient agent name
 * @param {string} params.action - Action to perform
 * @param {*} [params.data] - Message data
 * @param {Object} [params.context] - Additional context
 * @returns {Object} Request message
 */
export function createRequest({ from, to, action, data = null, context = {} }) {
  validateAgentName(from, "from");
  validateAgentName(to, "to");
  validateAction(action);

  return {
    id: generateMessageId(),
    type: MessageType.REQUEST,
    from,
    to,
    action,
    data,
    context,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a response message
 * @param {Object} params - Response parameters
 * @param {string} params.from - Sender agent name
 * @param {string} params.to - Recipient agent name
 * @param {string} params.requestId - Original request ID
 * @param {boolean} params.success - Success status
 * @param {*} [params.data] - Response data
 * @param {string} [params.error] - Error message if failed
 * @param {string} [params.confidence] - Confidence level (low/medium/high)
 * @param {Array<string>} [params.observations] - Observations made
 * @returns {Object} Response message
 */
export function createResponse({
  from,
  to,
  requestId,
  success,
  data = null,
  error = null,
  confidence = null,
  observations = []
}) {
  validateAgentName(from, "from");
  validateAgentName(to, "to");

  if (typeof success !== "boolean") {
    throw new Error("Response success must be a boolean");
  }

  if (!success && !error) {
    throw new Error("Failed response must include error message");
  }

  return {
    id: generateMessageId(),
    type: MessageType.RESPONSE,
    from,
    to,
    requestId,
    success,
    data,
    error,
    confidence,
    observations,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create an error message
 * @param {Object} params - Error parameters
 * @param {string} params.from - Sender agent name
 * @param {string} params.to - Recipient agent name
 * @param {string} params.error - Error message
 * @param {*} [params.details] - Error details
 * @param {string} [params.requestId] - Related request ID
 * @returns {Object} Error message
 */
export function createError({ from, to, error, details = null, requestId = null }) {
  validateAgentName(from, "from");
  validateAgentName(to, "to");

  if (typeof error !== "string" || !error.trim()) {
    throw new Error("Error message must be a non-empty string");
  }

  return {
    id: generateMessageId(),
    type: MessageType.ERROR,
    from,
    to,
    error,
    details,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a notification message
 * @param {Object} params - Notification parameters
 * @param {string} params.from - Sender agent name
 * @param {string} params.to - Recipient agent name (or "broadcast")
 * @param {string} params.event - Event name
 * @param {*} [params.data] - Event data
 * @returns {Object} Notification message
 */
export function createNotification({ from, to, event, data = null }) {
  validateAgentName(from, "from");
  
  if (to !== "broadcast") {
    validateAgentName(to, "to");
  }

  if (typeof event !== "string" || !event.trim()) {
    throw new Error("Event name must be a non-empty string");
  }

  return {
    id: generateMessageId(),
    type: MessageType.NOTIFICATION,
    from,
    to,
    event,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate message structure
 * @param {Object} message - Message to validate
 * @returns {boolean} True if valid
 * @throws {Error} If message is invalid
 */
export function validateMessage(message) {
  if (!message || typeof message !== "object") {
    throw new Error("Message must be an object");
  }

  if (!message.id || typeof message.id !== "string") {
    throw new Error("Message must have a valid id");
  }

  if (!Object.values(MessageType).includes(message.type)) {
    throw new Error(`Invalid message type: ${message.type}`);
  }

  validateAgentName(message.from, "from");
  
  if (message.to !== "broadcast") {
    validateAgentName(message.to, "to");
  }

  if (!message.timestamp) {
    throw new Error("Message must have a timestamp");
  }

  // Type-specific validation
  switch (message.type) {
    case MessageType.REQUEST:
      validateAction(message.action);
      break;

    case MessageType.RESPONSE:
      if (typeof message.success !== "boolean") {
        throw new Error("Response must have success boolean");
      }
      if (!message.requestId) {
        throw new Error("Response must have requestId");
      }
      break;

    case MessageType.ERROR:
      if (!message.error || typeof message.error !== "string") {
        throw new Error("Error message must have error string");
      }
      break;

    case MessageType.NOTIFICATION:
      if (!message.event || typeof message.event !== "string") {
        throw new Error("Notification must have event string");
      }
      break;
  }

  return true;
}

/**
 * Validate agent name
 * @param {string} name - Agent name
 * @param {string} field - Field name for error message
 * @throws {Error} If invalid
 */
function validateAgentName(name, field) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

/**
 * Validate action name
 * @param {string} action - Action name
 * @throws {Error} If invalid
 */
function validateAction(action) {
  if (typeof action !== "string" || !action.trim()) {
    throw new Error("Action must be a non-empty string");
  }
}

/**
 * Generate unique message ID
 * @returns {string} Message ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Message logger for debugging
 */
export class MessageLogger {
  constructor() {
    this.messages = [];
    this.maxMessages = 1000;
  }

  /**
   * Log a message
   * @param {Object} message - Message to log
   */
  log(message) {
    this.messages.push({
      ...message,
      loggedAt: new Date().toISOString()
    });

    // Keep only recent messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    // Console log for visibility
    const arrow = message.type === MessageType.RESPONSE ? "←" : "→";
    log.info(`${arrow} ${message.from} ${arrow} ${message.to}: ${message.type}`);
  }

  /**
   * Get messages by filter
   * @param {Object} [filter] - Filter options
   * @param {string} [filter.from] - Filter by sender
   * @param {string} [filter.to] - Filter by recipient
   * @param {string} [filter.type] - Filter by type
   * @param {number} [filter.limit] - Limit results
   * @returns {Array} Filtered messages
   */
  getMessages(filter = {}) {
    let results = [...this.messages];

    if (filter.from) {
      results = results.filter(m => m.from === filter.from);
    }

    if (filter.to) {
      results = results.filter(m => m.to === filter.to);
    }

    if (filter.type) {
      results = results.filter(m => m.type === filter.type);
    }

    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  /**
   * Get conversation between two agents
   * @param {string} agent1 - First agent name
   * @param {string} agent2 - Second agent name
   * @returns {Array} Messages between agents
   */
  getConversation(agent1, agent2) {
    return this.messages.filter(m =>
      (m.from === agent1 && m.to === agent2) ||
      (m.from === agent2 && m.to === agent1)
    );
  }

  /**
   * Clear message log
   */
  clear() {
    this.messages = [];
    log.info("Message log cleared");
  }

  /**
   * Get statistics
   * @returns {Object} Message statistics
   */
  getStats() {
    const stats = {
      total: this.messages.length,
      byType: {},
      byAgent: {}
    };

    for (const message of this.messages) {
      // Count by type
      stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;

      // Count by agent (sent)
      stats.byAgent[message.from] = (stats.byAgent[message.from] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Create success response helper
 * @param {Object} request - Original request
 * @param {*} data - Response data
 * @param {Object} [options] - Additional options
 * @returns {Object} Success response
 */
export function createSuccessResponse(request, data, options = {}) {
  return createResponse({
    from: request.to,
    to: request.from,
    requestId: request.id,
    success: true,
    data,
    ...options
  });
}

/**
 * Create error response helper
 * @param {Object} request - Original request
 * @param {string} error - Error message
 * @param {*} [details] - Error details
 * @returns {Object} Error response
 */
export function createErrorResponse(request, error, details = null) {
  return createResponse({
    from: request.to,
    to: request.from,
    requestId: request.id,
    success: false,
    error,
    data: details
  });
}

// Export singleton message logger
export const messageLogger = new MessageLogger();

export default {
  MessageType,
  createRequest,
  createResponse,
  createError,
  createNotification,
  validateMessage,
  createSuccessResponse,
  createErrorResponse,
  messageLogger
};

