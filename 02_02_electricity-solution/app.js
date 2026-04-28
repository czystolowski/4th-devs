/**
 * Electricity Puzzle Solution
 *
 * Solves the 3x3 electrical grid puzzle by:
 * 1. Fetching the current grid image from hub
 * 2. Using vision AI to analyze cable configurations
 * 3. Calculating rotations needed to match target state
 * 4. Executing rotations via hub API
 * 5. Tracking all states in workspace/session-{timestamp}/
 */

import { fetchGridImage, fetchSolutionImage, imageToDataUrl } from "./src/helpers/hub.js";
import { loadTargetGrid, analyzeAndPlan, executeRotations } from "./src/agent.js";
import { createSession, saveSessionImage, createSessionManifest, addSessionStep } from "./src/helpers/session.js";
import log from "./src/helpers/logger.js";

const getApiKey = () => {
  const key = process.env.AGENT_TOKEN;
  if (!key) {
    throw new Error("AGENT_TOKEN not found in environment");
  }
  return key;
};

const main = async () => {
  log.box("Electricity Puzzle Solution\nAI-Powered Grid Solver");
  
  const apiKey = getApiKey();
  
  try {
    // Create session for tracking
    const session = await createSession();
    log.info(`Session created: ${session.dir}`);
    console.log("");
    
    // Step 0: Fetch and analyze the solution image to know the target
    log.start("Fetching solution image to understand target configuration...");
    const solutionBuffer = await fetchSolutionImage();
    log.success("Solution image downloaded");
    
    const { filename: solutionFile } = await saveSessionImage(session, solutionBuffer, "target-solution");
    log.info(`Saved: ${solutionFile}`);
    
    const solutionDataUrl = imageToDataUrl(solutionBuffer);
    await loadTargetGrid(solutionDataUrl);
    
    addSessionStep(session, {
      action: "load_target",
      image: solutionFile
    });
    
    // Step 1: Fetch current grid image
    log.start("Fetching current grid state from hub...");
    const imageBuffer = await fetchGridImage(apiKey);
    log.success("Grid image downloaded");
    
    const { filename: initialFile } = await saveSessionImage(session, imageBuffer, "initial-state");
    log.info(`Saved: ${initialFile}`);
    
    addSessionStep(session, {
      action: "initial_state",
      image: initialFile
    });
    
    // Convert to data URL for vision API
    const imageDataUrl = imageToDataUrl(imageBuffer);
    
    // Step 2: Analyze grid and plan rotations
    const { currentGrid, rotationPlan } = await analyzeAndPlan(imageDataUrl);
    
    // Display rotation plan
    if (Object.keys(rotationPlan).length > 0) {
      console.log("\nRotation Plan:");
      for (const [position, rotations] of Object.entries(rotationPlan)) {
        console.log(`  ${position}: ${rotations} rotation(s)`);
      }
      console.log("");
    }
    
    // Step 3: Execute rotations
    log.start("Executing rotations...");
    const result = await executeRotations(apiKey, rotationPlan, session);
    
    if (result.flag) {
      log.flag(result.flag);
      console.log("\n✓ Puzzle solved successfully!");
      
      // Save final state
      const finalImage = await fetchGridImage(apiKey);
      const { filename: finalFile } = await saveSessionImage(session, finalImage, "final-solved");
      log.info(`Saved: ${finalFile}`);
      
      addSessionStep(session, {
        action: "solved",
        flag: result.flag,
        image: finalFile
      });
      
      // Create manifest
      const manifestPath = await createSessionManifest(session, {
        steps: session.steps,
        rotations: Object.entries(rotationPlan).map(([pos, count]) => ({ position: pos, count })),
        success: true,
        flag: result.flag
      });
      log.info(`Manifest: ${manifestPath}`);
      
    } else {
      log.success("All rotations completed");
      log.info("Fetching updated grid to verify...");
      
      // Fetch and analyze again to verify
      const updatedImage = await fetchGridImage(apiKey);
      const { filename: verifyFile } = await saveSessionImage(session, updatedImage, "verify-state");
      log.info(`Saved: ${verifyFile}`);
      
      const updatedDataUrl = imageToDataUrl(updatedImage);
      const { rotationPlan: remainingRotations } = await analyzeAndPlan(updatedDataUrl);
      
      if (Object.keys(remainingRotations).length === 0) {
        log.success("Grid matches target configuration!");
        
        // Create manifest
        await createSessionManifest(session, {
          steps: session.steps,
          rotations: Object.entries(rotationPlan).map(([pos, count]) => ({ position: pos, count })),
          success: true,
          flag: null
        });
      } else {
        log.warning("Grid still needs adjustments");
        console.log("\nRemaining rotations needed:");
        for (const [position, rotations] of Object.entries(remainingRotations)) {
          console.log(`  ${position}: ${rotations} rotation(s)`);
        }
        
        // Create manifest with partial success
        await createSessionManifest(session, {
          steps: session.steps,
          rotations: Object.entries(rotationPlan).map(([pos, count]) => ({ position: pos, count })),
          success: false,
          remainingRotations: remainingRotations
        });
      }
    }
    
    console.log(`\n📁 Session saved to: ${session.dir}`);
    
  } catch (error) {
    log.error("Error", error.message);
    console.error(error);
    process.exit(1);
  }
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});

