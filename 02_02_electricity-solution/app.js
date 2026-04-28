/**
 * Electricity Puzzle Solution
 *
 * Solves the 3x3 electrical grid puzzle by:
 * 1. Fetching the current grid image from hub
 * 2. Using vision AI to analyze cable configurations
 * 3. Calculating rotations needed to match target state
 * 4. Executing rotations via hub API (with interactive confirmation)
 * 5. Tracking all states in workspace/session-{timestamp}/
 */

import { fetchGridImage, fetchSolutionImage, imageToDataUrl, rotateCell } from "./src/helpers/hub.js";
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
  log.box("Electricity Puzzle Solution\nAI-Powered Grid Solver\nInteractive Mode");
  
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
    
    // Step 3: Execute rotations (interactive mode)
    log.start("Executing rotations...");
    let result = await executeRotations(apiKey, rotationPlan, session, true);
    
    // Iterative solving loop - keep trying until grid matches or max attempts reached
    const MAX_ITERATIONS = 10;
    let iteration = 0;
    let allRotations = [];
    
    while (iteration < MAX_ITERATIONS) {
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
          rotations: allRotations,
          iterations: iteration + 1,
          success: true,
          flag: result.flag
        });
        log.info(`Manifest: ${manifestPath}`);
        break;
      }
      
      log.success("Rotations completed");
      log.info("Verifying grid state...");
      
      // Fetch and analyze again to verify
      const updatedImage = await fetchGridImage(apiKey);
      const { filename: verifyFile } = await saveSessionImage(session, updatedImage, `verify-iteration-${iteration + 1}`);
      log.info(`Saved: ${verifyFile}`);
      
      const updatedDataUrl = imageToDataUrl(updatedImage);
      const { rotationPlan: remainingRotations } = await analyzeAndPlan(updatedDataUrl);
      
      if (Object.keys(remainingRotations).length === 0) {
        log.success("Grid matches target configuration!");
        log.info("Requesting flag from hub...");
        
        // Try to get the flag by sending a verification request
        try {
          const verifyResponse = await rotateCell(apiKey, "1x1");
          
          if (verifyResponse.flag || verifyResponse.message?.includes("FLG:")) {
            const flag = verifyResponse.flag || verifyResponse.message;
            log.flag(flag);
            
            // Save final state with flag
            const finalImage = await fetchGridImage(apiKey);
            const { filename: finalFile } = await saveSessionImage(session, finalImage, "final-with-flag");
            log.info(`Saved: ${finalFile}`);
            
            await createSessionManifest(session, {
              steps: session.steps,
              rotations: allRotations,
              iterations: iteration + 1,
              success: true,
              flag: flag
            });
            break;
          } else {
            log.warning("No flag received from hub - puzzle may not be correctly solved");
            await createSessionManifest(session, {
              steps: session.steps,
              rotations: allRotations,
              iterations: iteration + 1,
              success: false,
              flag: null,
              note: "Grid matches target but hub did not return flag"
            });
            break;
          }
        } catch (error) {
          log.error("Flag verification failed", error.message);
          await createSessionManifest(session, {
            steps: session.steps,
            rotations: allRotations,
            iterations: iteration + 1,
            success: false,
            flag: null,
            error: error.message
          });
          break;
        }
      }
      
      // More rotations needed
      iteration++;
      log.warning(`Iteration ${iteration}: Grid needs ${Object.keys(remainingRotations).length} more rotation(s)`);
      console.log("\nRemaining rotations:");
      for (const [position, rotations] of Object.entries(remainingRotations)) {
        console.log(`  ${position}: ${rotations} rotation(s)`);
        allRotations.push({ position, count: rotations });
      }
      console.log("");
      
      if (iteration >= MAX_ITERATIONS) {
        log.error("Max iterations reached", "Could not solve puzzle");
        await createSessionManifest(session, {
          steps: session.steps,
          rotations: allRotations,
          iterations: iteration,
          success: false,
          remainingRotations: remainingRotations
        });
        break;
      }
      
      // Execute remaining rotations
      log.start(`Iteration ${iteration}: Executing remaining rotations...`);
      result = await executeRotations(apiKey, remainingRotations, session, true);
      
      // Handle special cases
      if (result.reanalyze) {
        log.info("Re-analyzing grid...");
        const currentImage = await fetchGridImage(apiKey);
        const currentDataUrl = imageToDataUrl(currentImage);
        const { rotationPlan: newPlan } = await analyzeAndPlan(currentDataUrl);
        
        if (Object.keys(newPlan).length > 0) {
          log.info("New rotation plan generated");
          result = await executeRotations(apiKey, newPlan, session, true);
        } else {
          log.success("Re-analysis shows grid matches target");
          break;
        }
      }
      
      if (result.skipped || result.stopped) {
        log.warning("Rotation execution interrupted by user");
        await createSessionManifest(session, {
          steps: session.steps,
          rotations: allRotations,
          iterations: iteration + 1,
          success: false,
          note: result.skipped ? "User skipped rotations" : "User stopped execution"
        });
        break;
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

// Made with Bob
