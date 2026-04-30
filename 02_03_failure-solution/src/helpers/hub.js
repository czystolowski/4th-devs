/**
 * Hub API communication helpers for failure log task
 */

import { hub, compression } from "../config.js";

/**
 * Fetch the failure log file from hub
 */
export const fetchLogFile = async (apiKey) => {
  const url = `${hub.baseUrl}/data/${apiKey}/failure.log`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch log file: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  return text;
};

/**
 * Verify compressed logs with hub
 */
export const verifyLogs = async (apiKey, logsString) => {
  const url = `${hub.baseUrl}/verify`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: hub.task,
      answer: {
        logs: logsString
      }
    })
  });
  
  const data = await response.json();
  
  // Only throw on actual HTTP errors, not verification failures
  if (!response.ok && response.status >= 500) {
    throw new Error(data.message || `Hub error: ${response.status}`);
  }
  
  return data;
};

/**
 * Conservative token estimation
 * Uses chars / 3.5 as a safe approximation
 */
export const countTokens = (text) => {
  return Math.ceil(text.length / compression.charsPerToken);
};

/**
 * Check if text is within token budget
 */
export const isWithinBudget = (text) => {
  const tokens = countTokens(text);
  return {
    tokens,
    withinBudget: tokens <= compression.maxTokens,
    maxTokens: compression.maxTokens,
    remaining: compression.maxTokens - tokens
  };
};

/**
 * Format budget status for logging
 */
export const formatBudgetStatus = (text) => {
  const status = isWithinBudget(text);
  const emoji = status.withinBudget ? "✅" : "❌";
  return `${emoji} ${status.tokens}/${status.maxTokens} tokens (${status.remaining > 0 ? status.remaining : Math.abs(status.remaining)} ${status.remaining > 0 ? "remaining" : "over"})`;
};

