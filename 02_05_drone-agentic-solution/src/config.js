/**
 * Configuration for agentic drone control system
 */

export const hub = {
  baseUrl: "https://hub.ag3nts.org",
  task: "drone",
  targetCode: "PWR6132PL"
};

export const api = {
  // Vision model for map analysis
  visionModel: "gpt-5.4",
  // Coordinator uses more capable model
  coordinatorModel: "gpt-4o",
  // Specialized agents use efficient model
  agentModel: "gpt-4o-mini",
  maxOutputTokens: 4000
};

export const agents = {
  coordinator: {
    name: "Coordinator",
    role: "Mission orchestrator and decision maker",
    model: "gpt-4o"
  },
  vision: {
    name: "Vision Analyst",
    role: "Map analysis and feature location specialist",
    model: "gpt-5.4"
  },
  documentation: {
    name: "Documentation Specialist",
    role: "API documentation parser and function catalog builder",
    model: "gpt-4o-mini"
  },
  builder: {
    name: "Instruction Builder",
    role: "Drone command sequence constructor",
    model: "gpt-4o-mini"
  },
  validator: {
    name: "Validator",
    role: "Testing and refinement specialist",
    model: "gpt-4o-mini"
  }
};

export const memory = {
  maxObservations: 50,
  compressionThreshold: 30,
  persistPath: "workspace/memory"
};

// Made with Bob
