/**
 * ZMail API client for mailbox operations
 */

import { AGENT_TOKEN } from "../../../config.js";
import { hub } from "../config.js";

const getApiKey = () => {
  if (!AGENT_TOKEN) {
    throw new Error("AGENT_TOKEN not found in environment");
  }
  return AGENT_TOKEN;
};

/**
 * Call ZMail API with given action and parameters
 */
export const callZMailAPI = async (action, params = {}) => {
  const apiKey = getApiKey();
  
  const response = await fetch(`${hub.baseUrl}/api/zmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      action,
      ...params
    })
  });

  if (!response.ok) {
    throw new Error(`ZMail API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`ZMail API error: ${data.error}`);
  }

  return data;
};

/**
 * Get help information about available actions
 */
export const getHelp = async () => {
  return callZMailAPI("help");
};

/**
 * Get inbox messages (paginated)
 */
export const getInbox = async (page = 1) => {
  return callZMailAPI("getInbox", { page });
};

/**
 * Search emails with query - gets all pages
 */
export const searchEmails = async (query, maxPages = 5) => {
  const allItems = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const result = await callZMailAPI("search", { query, page });
    
    // API returns 'items' not 'messages'
    if (result.items && result.items.length > 0) {
      allItems.push(...result.items);
    }
    
    // If we got fewer items than perPage, we've reached the end
    if (!result.items || result.items.length < (result.perPage || 5)) {
      break;
    }
  }
  
  return { items: allItems };
};

/**
 * Search emails with query - single page
 */
export const searchEmailsPage = async (query, page = 1) => {
  return callZMailAPI("search", { query, page });
};

/**
 * Get full email content by IDs (can pass multiple)
 */
export const getMessages = async (ids) => {
  const result = await callZMailAPI("getMessages", { ids: Array.isArray(ids) ? ids : [ids] });
  // API returns items array with message content in 'message' field
  return result.items || [];
};

/**
 * Get single email content by ID
 */
export const getEmail = async (id) => {
  const messages = await getMessages([id]);
  return messages[0] || null;
};

/**
 * Verify answer with hub
 */
export const verifyAnswer = async (answer) => {
  const apiKey = getApiKey();
  
  const response = await fetch(`${hub.baseUrl}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: hub.task,
      answer
    })
  });

  if (!response.ok) {
    throw new Error(`Verify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

