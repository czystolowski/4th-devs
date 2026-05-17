/**
 * Hub API helpers for drone task
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
 * Get drone map URL with API key
 */
export const getMapUrl = () => {
  const apiKey = getApiKey();
  return `${hub.baseUrl}/data/${apiKey}/drone.png`;
};

/**
 * Get drone API documentation URL
 */
export const getDocUrl = () => {
  return `${hub.baseUrl}/dane/drone.html`;
};

/**
 * Fetch drone API documentation
 */
export const fetchDocumentation = async () => {
  const url = getDocUrl();
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch documentation: ${response.status}`);
  }
  
  return response.text();
};

/**
 * Submit drone instructions to hub
 */
export const submitInstructions = async (instructions) => {
  const apiKey = getApiKey();
  
  const response = await fetch(`${hub.baseUrl}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: hub.task,
      answer: {
        instructions
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hub API error: ${response.status} - ${errorText}`);
  }

  return response.json();
};

