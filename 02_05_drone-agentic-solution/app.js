/**
 * Agentic Drone Control System
 * 
 * Main entry point that:
 * - Initializes memory system
 * - Starts coordinator agent with mission objective
 * - Handles mission completion (FLAG detection)
 * - Displays results and statistics
 */

import { coordinatorAgent } from "./src/agents/index.js";
import Memory from "./src/core/memory.js";
import log from "./src/helpers/logger.js";

// Import tools to trigger registration
import "./src/tools/vision-tools.js";
import "./src/tools/doc-tools.js";
import "./src/tools/builder-tools.js";
import "./src/tools/validator-tools.js";
import "./src/tools/memory-tools.js";

const getApiKey = () => {
  const key = process.env.AGENT_TOKEN;
  if (!key) {
    throw new Error("AGENT_TOKEN not found in environment");
  }
  return key;
};

const main = async () => {
  log.box("Agentic Drone Control System\nMulti-Agent Architecture\nAutonomous Mission Execution");
  
  try {
    // Verify API key
    const apiKey = getApiKey();
    log.success("API key loaded");
    console.log("");
    
    // Step 1: Initialize memory system
    log.start("Initializing memory system...");
    const memory = new Memory();
    const memStats = memory.getStats();
    log.success(`Memory initialized (${memStats.episodic} episodes, ${memStats.semantic} facts, ${memStats.procedural} procedures)`);
    console.log("");
    
    // Step 2: Define mission objective
    const objective = "Analyze the drone map, understand the API, build instructions to navigate from starting position to the dam, and obtain the FLAG";
    
    log.start("Mission objective:");
    log.info(objective);
    console.log("");
    
    // Step 3: Execute mission via coordinator
    log.start("Starting coordinator agent...");
    console.log("");
    
    const result = await coordinatorAgent.execute({
      task: objective,
      context: { apiKey }
    });
    
    console.log("");
    
    // Step 4: Check for mission completion
    if (result.success) {
      log.success("Mission completed successfully!");
      
      // Check for FLAG in result
      if (result.flag) {
        log.flag(result.flag);
      } else if (result.message && result.message.includes("{FLG:")) {
        const flagMatch = result.message.match(/\{FLG:[^}]+\}/);
        if (flagMatch) {
          log.flag(flagMatch[0]);
        }
      }
      
      // Display result details
      if (result.message) {
        console.log("");
        log.info("Result message:");
        console.log(result.message);
      }
      
      if (result.instructions) {
        console.log("");
        log.info("Final instructions:");
        result.instructions.forEach((inst, i) => {
          console.log(`  ${i + 1}. ${inst}`);
        });
      }
      
    } else {
      log.error("Mission failed", result.error || "Unknown error");
      if (result.message) {
        console.log("");
        log.info("Details:");
        console.log(result.message);
      }
    }
    
    // Step 5: Display statistics
    console.log("");
    log.start("Mission Statistics:");
    
    const finalStats = memory.getStats();
    log.data("Episodic memories", finalStats.episodic);
    log.data("Semantic facts", finalStats.semantic);
    log.data("Procedural knowledge", finalStats.procedural);
    log.data("Coordinator iterations", result.iterations || 0);
    log.data("Total attempts", result.attempts || 0);
    
    // Save final memory state
    memory._persist();
    log.info("Memory state saved to workspace/memory/");
    
    console.log("");
    log.success("System shutdown complete");
    
  } catch (error) {
    console.log("");
    log.error("System error", error.message);
    console.error(error);
    
    // Try to save memory state even on error
    try {
      memory._persist();
      log.info("Memory state saved despite error");
    } catch (saveError) {
      log.warning("Could not save memory state");
    }
    
    process.exit(1);
  }
};

// Start the system
main().catch((err) => {
  log.error("Startup error", err.message);
  console.error(err);
  process.exit(1);
});

// Made with Bob
