/**
 * Configuration for drone task
 */

export const hub = {
  baseUrl: "https://hub.ag3nts.org",
  task: "drone"
};

export const api = {
  // Use gpt-5.4 for better grid counting (as per hints), then cheaper model for instructions
  visionModel: "gpt-5.4",
  textModel: "gpt-4o-mini",
  maxOutputTokens: 2000
};

export const drone = {
  // Power plant code
  targetCode: "PWR6132PL",
  // Map will be analyzed to find dam coordinates
  mapUrl: null // Will be set dynamically with API key
};

// Made with Bob
