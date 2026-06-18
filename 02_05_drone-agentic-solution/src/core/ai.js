/**
 * AI API wrapper supporting Responses API with function calling
 * Handles both vision (with image URLs) and text models
 */

import {
  AI_API_KEY,
  RESPONSES_API_ENDPOINT,
  EXTRA_API_HEADERS,
  buildResponsesRequest,
  resolveModelForProvider
} from "../../../config.js";
import log from "../helpers/logger.js";

/**
 * Call AI with Responses API
 * @param {Object} params - Request parameters
 * @param {string} params.model - Model name (will be resolved for provider)
 * @param {Array} params.messages - Message array
 * @param {Array} [params.tools] - Tool definitions
 * @param {number} [params.maxOutputTokens] - Max output tokens
 * @param {boolean} [params.webSearch] - Enable web search
 * @returns {Promise<Object>} API response
 */
export async function chat({ model, messages, tools, maxOutputTokens, webSearch = false }) {
  if (!AI_API_KEY) {
    throw new Error("AI_API_KEY not configured");
  }

  const request = buildResponsesRequest({
    model,
    messages,
    tools,
    max_output_tokens: maxOutputTokens,
    webSearch
  });

  log.info(`Calling ${model} with ${messages.length} messages${tools ? ` and ${tools.length} tools` : ""}`);

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Extract text content from Responses API output
 * @param {Object} response - API response
 * @returns {string|null} Extracted text or null
 */
export function extractText(response) {
  if (!response?.output || !Array.isArray(response.output)) {
    return null;
  }

  const messageItem = response.output.find(item => item.type === "message");
  if (!messageItem?.content || !Array.isArray(messageItem.content)) {
    return null;
  }

  const textContent = messageItem.content.find(c => c.type === "text");
  return textContent?.text || null;
}

/**
 * Extract tool calls from Responses API output
 * @param {Object} response - API response
 * @returns {Array} Array of tool calls
 */
export function extractToolCalls(response) {
  if (!response?.output || !Array.isArray(response.output)) {
    return [];
  }

  return response.output
    .filter(item => item.type === "function_call")
    .map(item => ({
      id: item.id,
      name: item.name,
      arguments: item.arguments
    }));
}

/**
 * Extract reasoning from Responses API output
 * @param {Object} response - API response
 * @returns {string|null} Reasoning text or null
 */
export function extractReasoning(response) {
  if (!response?.output || !Array.isArray(response.output)) {
    return null;
  }

  const reasoningItem = response.output.find(item => item.type === "reasoning");
  if (!reasoningItem?.content || !Array.isArray(reasoningItem.content)) {
    return null;
  }

  const textContent = reasoningItem.content.find(c => c.type === "text");
  return textContent?.text || null;
}

/**
 * Call vision model with image URL
 * @param {Object} params - Request parameters
 * @param {string} params.model - Vision model name
 * @param {string} params.imageUrl - Image URL
 * @param {string} params.prompt - Analysis prompt
 * @param {number} [params.maxOutputTokens] - Max output tokens
 * @returns {Promise<Object>} API response with extracted text
 */
export async function analyzeImage({ model, imageUrl, prompt, maxOutputTokens }) {
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: imageUrl }
        },
        {
          type: "text",
          text: prompt
        }
      ]
    }
  ];

  const response = await chat({
    model,
    messages,
    maxOutputTokens
  });

  return {
    ...response,
    text: extractText(response)
  };
}

/**
 * Call text model with tools
 * @param {Object} params - Request parameters
 * @param {string} params.model - Model name
 * @param {string} params.systemPrompt - System prompt
 * @param {string} params.userPrompt - User prompt
 * @param {Array} [params.tools] - Tool definitions
 * @param {number} [params.maxOutputTokens] - Max output tokens
 * @param {Array} [params.conversationHistory] - Previous messages
 * @returns {Promise<Object>} API response with extracted data
 */
export async function callWithTools({
  model,
  systemPrompt,
  userPrompt,
  tools,
  maxOutputTokens,
  conversationHistory = []
}) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userPrompt }
  ];

  const response = await chat({
    model,
    messages,
    tools,
    maxOutputTokens
  });

  return {
    ...response,
    text: extractText(response),
    toolCalls: extractToolCalls(response),
    reasoning: extractReasoning(response)
  };
}

/**
 * Format tool result for conversation history
 * @param {string} toolCallId - Tool call ID
 * @param {string} toolName - Tool name
 * @param {*} result - Tool execution result
 * @returns {Object} Formatted tool result message
 */
export function formatToolResult(toolCallId, toolName, result) {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    tool_name: toolName,
    content: typeof result === "string" ? result : JSON.stringify(result)
  };
}

export default {
  chat,
  extractText,
  extractToolCalls,
  extractReasoning,
  analyzeImage,
  callWithTools,
  formatToolResult
};

