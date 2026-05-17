/**
 * Memory Tools for Coordinator Agent
 * Tools for managing long-term memory and mission state
 */

import { createToolDefinition, toolRegistry } from "../core/tools.js";
import Memory from "../core/memory.js";
import log from "../helpers/logger.js";

// Create singleton memory instance
const memory = new Memory();

/**
 * Store observation in memory
 */
async function storeObservation(args, context) {
  const { 
    type = "episodic", 
    agent, 
    observation, 
    data,
    confidence = "medium",
    verified = false
  } = args;
  
  if (!observation) {
    throw new Error("Observation is required");
  }
  
  log.info(`Storing ${type} observation from ${agent || 'unknown'}`);
  
  let id;
  
  if (type === "episodic") {
    // Store as episode
    id = memory.storeEpisode({
      episode: memory.episodic.length + 1,
      agent: agent || "unknown",
      action: observation,
      result: data?.result || "unknown",
      data,
      learning: data?.learning
    });
  } else if (type === "semantic" || type === "fact") {
    // Store as fact
    id = memory.storeFact({
      fact: observation,
      value: data,
      confidence,
      source: agent || "unknown",
      verified
    });
  } else if (type === "procedural" || type === "procedure") {
    // Store as procedure
    id = memory.storeProcedure({
      procedure: observation,
      steps: data?.steps || [],
      context: data?.context,
      successRate: data?.successRate || 0
    });
  } else {
    throw new Error(`Unknown memory type: ${type}`);
  }
  
  return {
    success: true,
    id,
    type,
    observation,
    stored: true
  };
}

/**
 * Recall observations from memory
 */
async function recallObservations(args, context) {
  const { 
    type = "all",
    agent,
    query,
    limit,
    verified
  } = args;
  
  log.info(`Recalling ${type} observations${agent ? ` from ${agent}` : ''}`);
  
  const results = {
    success: true,
    type,
    observations: []
  };
  
  if (type === "episodic" || type === "all") {
    const episodes = memory.recallEpisodes({
      agent,
      limit: type === "episodic" ? limit : undefined
    });
    results.observations.push(...episodes.map(ep => ({
      type: "episodic",
      ...ep
    })));
  }
  
  if (type === "semantic" || type === "fact" || type === "all") {
    const facts = memory.recallFacts({
      fact: query,
      source: agent,
      verified
    });
    results.observations.push(...facts.map(fact => ({
      type: "semantic",
      ...fact
    })));
  }
  
  if (type === "procedural" || type === "procedure" || type === "all") {
    const procedures = memory.recallProcedures({
      procedure: query
    });
    results.observations.push(...procedures.map(proc => ({
      type: "procedural",
      ...proc
    })));
  }
  
  // Apply limit if specified and type is "all"
  if (limit && type === "all") {
    results.observations = results.observations.slice(-limit);
  }
  
  // Sort by timestamp (most recent first)
  results.observations.sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  log.info(`Recalled ${results.observations.length} observations`);
  
  return results;
}

/**
 * Update mission state
 */
async function updateState(args, context) {
  const { stateKey, value, merge = true } = args;
  
  if (!stateKey) {
    throw new Error("State key is required");
  }
  
  log.info(`Updating state: ${stateKey}`);
  
  // Store state as a special semantic fact
  const existingState = memory.recallFacts({
    fact: `state:${stateKey}`
  });
  
  let id;
  
  if (existingState.length > 0 && merge) {
    // Update existing state
    const currentValue = existingState[0].value;
    const newValue = typeof currentValue === "object" && typeof value === "object"
      ? { ...currentValue, ...value }
      : value;
    
    id = existingState[0].id;
    memory.update(id, {
      value: newValue,
      verified: true
    });
  } else {
    // Create new state entry
    id = memory.storeFact({
      fact: `state:${stateKey}`,
      value,
      confidence: "high",
      source: "coordinator",
      verified: true
    });
  }
  
  return {
    success: true,
    stateKey,
    value,
    id,
    updated: true
  };
}

/**
 * Get current mission state
 */
async function getState(args, context) {
  const { stateKey, includeAll = false } = args;
  
  log.info(`Getting state${stateKey ? `: ${stateKey}` : ' (all)'}`);
  
  if (stateKey) {
    // Get specific state
    const stateFacts = memory.recallFacts({
      fact: `state:${stateKey}`,
      verified: true
    });
    
    if (stateFacts.length === 0) {
      return {
        success: true,
        stateKey,
        value: null,
        exists: false
      };
    }
    
    return {
      success: true,
      stateKey,
      value: stateFacts[0].value,
      exists: true,
      timestamp: stateFacts[0].timestamp
    };
  } else {
    // Get all state
    const allStateFacts = memory.recallFacts({
      verified: true
    }).filter(fact => fact.fact.startsWith("state:"));
    
    const state = {};
    for (const fact of allStateFacts) {
      const key = fact.fact.replace("state:", "");
      state[key] = includeAll 
        ? { value: fact.value, timestamp: fact.timestamp }
        : fact.value;
    }
    
    return {
      success: true,
      state,
      count: Object.keys(state).length
    };
  }
}

/**
 * Get memory statistics
 */
async function getMemoryStats(args, context) {
  log.info("Getting memory statistics");
  
  const stats = memory.getStats();
  const insights = memory.reflect();
  
  return {
    success: true,
    stats,
    insights,
    summary: {
      totalMemories: stats.episodic + stats.semantic + stats.procedural,
      verifiedFacts: stats.verifiedFacts,
      recentErrors: insights.recentErrors
    }
  };
}

/**
 * Clear memory (use with caution)
 */
async function clearMemory(args, context) {
  const { confirm = false } = args;
  
  if (!confirm) {
    throw new Error("Must set confirm=true to clear memory");
  }
  
  log.warning("Clearing all memory");
  
  memory.clear();
  
  return {
    success: true,
    cleared: true,
    message: "All memory has been cleared"
  };
}

/**
 * Compress old memories
 */
async function compressMemory(args, context) {
  const { keepRecent = 10 } = args;
  
  log.info(`Compressing memory (keeping ${keepRecent} recent entries)`);
  
  const result = memory.compress(keepRecent);
  
  return {
    success: true,
    compressed: true,
    ...result
  };
}

// Tool definitions
const tools = [
  {
    definition: createToolDefinition(
      "store_observation",
      "Store an observation in long-term memory. Can store episodic (what happened), semantic (facts), or procedural (how-to) memories.",
      {
        properties: {
          type: {
            type: "string",
            description: "Memory type: 'episodic', 'semantic'/'fact', or 'procedural'/'procedure'",
            enum: ["episodic", "semantic", "fact", "procedural", "procedure"]
          },
          agent: {
            type: "string",
            description: "Agent that made the observation"
          },
          observation: {
            type: "string",
            description: "The observation or fact to store"
          },
          data: {
            type: "object",
            description: "Additional data associated with the observation"
          },
          confidence: {
            type: "string",
            description: "Confidence level: 'low', 'medium', or 'high' (default: 'medium')",
            enum: ["low", "medium", "high"]
          },
          verified: {
            type: "boolean",
            description: "Whether the observation has been verified (default: false)"
          }
        },
        required: ["observation"]
      }
    ),
    executor: storeObservation
  },
  {
    definition: createToolDefinition(
      "recall_observations",
      "Retrieve observations from long-term memory. Can filter by type, agent, query, and limit results.",
      {
        properties: {
          type: {
            type: "string",
            description: "Memory type to recall: 'episodic', 'semantic'/'fact', 'procedural'/'procedure', or 'all' (default: 'all')",
            enum: ["episodic", "semantic", "fact", "procedural", "procedure", "all"]
          },
          agent: {
            type: "string",
            description: "Filter by agent name"
          },
          query: {
            type: "string",
            description: "Search query for semantic/procedural memories"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return"
          },
          verified: {
            type: "boolean",
            description: "Filter by verification status (semantic memories only)"
          }
        },
        required: []
      }
    ),
    executor: recallObservations
  },
  {
    definition: createToolDefinition(
      "update_state",
      "Update mission state. State is stored as verified semantic facts with 'state:' prefix.",
      {
        properties: {
          stateKey: {
            type: "string",
            description: "State key to update (e.g., 'map_analyzed', 'dam_location')"
          },
          value: {
            type: ["string", "number", "boolean", "object", "array"],
            description: "New state value"
          },
          merge: {
            type: "boolean",
            description: "If true and value is object, merge with existing state (default: true)"
          }
        },
        required: ["stateKey", "value"]
      }
    ),
    executor: updateState
  },
  {
    definition: createToolDefinition(
      "get_state",
      "Read current mission state. Can get specific state key or all state.",
      {
        properties: {
          stateKey: {
            type: "string",
            description: "Specific state key to retrieve (optional, returns all if not provided)"
          },
          includeAll: {
            type: "boolean",
            description: "If true, include timestamps and metadata (default: false)"
          }
        },
        required: []
      }
    ),
    executor: getState
  }
];

// Additional utility tools (not part of main 4, but useful)
const utilityTools = [
  {
    definition: createToolDefinition(
      "get_memory_stats",
      "Get memory statistics and insights. Returns counts, verification status, and recent activity.",
      {
        properties: {},
        required: []
      }
    ),
    executor: getMemoryStats
  },
  {
    definition: createToolDefinition(
      "clear_memory",
      "Clear all memory (use with caution). Requires explicit confirmation.",
      {
        properties: {
          confirm: {
            type: "boolean",
            description: "Must be true to confirm memory clearing"
          }
        },
        required: ["confirm"]
      }
    ),
    executor: clearMemory
  },
  {
    definition: createToolDefinition(
      "compress_memory",
      "Compress old memories to save space. Keeps recent entries uncompressed.",
      {
        properties: {
          keepRecent: {
            type: "number",
            description: "Number of recent entries to keep uncompressed (default: 10)"
          }
        },
        required: []
      }
    ),
    executor: compressMemory
  }
];

// Register all tools for coordinator agent
toolRegistry.registerTools("coordinator", [...tools, ...utilityTools]);

log.info("Memory tools registered for coordinator agent");

export { 
  storeObservation, 
  recallObservations, 
  updateState, 
  getState,
  getMemoryStats,
  clearMemory,
  compressMemory,
  memory
};

// Made with Bob