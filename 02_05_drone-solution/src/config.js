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
  // 2000 tokens is sufficient for vision model to return grid analysis JSON (~200 tokens)
  maxOutputTokens: 2000
};

export const drone = {
  // Power plant code from task requirements
  targetCode: "PWR6132PL",
  // Flight configuration
  enginePower: "100%", // Full power needed for mission
  flightHeight: "50m", // Height to clear trees and obstacles
  // Map will be analyzed to find dam coordinates
  mapUrl: null // Will be set dynamically with API key
};

export const mission = {
  // Maximum submission attempts before giving up
  // 5 attempts allows for iterative refinement based on API feedback
  maxAttempts: 5
};

