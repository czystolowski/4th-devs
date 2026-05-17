/**
 * Drone Control Solution
 *
 * Strategy:
 * 1. Load cached dam location OR analyze map with vision model
 * 2. Fetch and parse drone API documentation
 * 3. Build instruction sequence to bomb the dam (not power plant)
 * 4. Submit and iterate based on feedback
 * 5. Re-analyze only if feedback indicates wrong coordinates
 */

import { locateDam } from "./src/helpers/vision.js";
import { getMapUrl, fetchDocumentation, submitInstructions } from "./src/helpers/hub.js";
import { loadDamLocation, saveDamLocation, shouldReanalyze, ensureWorkspace } from "./src/helpers/persistence.js";
import { drone, mission } from "./src/config.js";
import log from "./src/helpers/logger.js";
import { writeFile } from "fs/promises";
import { join } from "path";

const main = async () => {
  log.box("Drone Control Mission\nBomb the Dam\nSave the Power Plant");
  
  try {
    // Step 1: Load or analyze dam location
    let damLocation = await loadDamLocation();
    let needsAnalysis = !damLocation;
    
    if (damLocation) {
      log.success("Loaded cached dam location");
      log.data("Grid size", `${damLocation.grid_columns} columns × ${damLocation.grid_rows} rows`);
      log.data("Dam location", `Column ${damLocation.dam_column}, Row ${damLocation.dam_row}`);
      log.data("Confidence", damLocation.confidence);
      console.log("");
    } else {
      log.start("Analyzing drone map with vision model...");
      const mapUrl = getMapUrl();
      log.info(`Map URL: ${mapUrl}`);
      
      damLocation = await locateDam(mapUrl);
      log.success("Map analyzed");
      
      if (damLocation.raw) {
        log.warning("Vision model returned raw text instead of JSON");
        console.log(damLocation.raw);
        return;
      }
      
      log.data("Grid size", `${damLocation.grid_columns} columns × ${damLocation.grid_rows} rows`);
      log.data("Dam location", `Column ${damLocation.dam_column}, Row ${damLocation.dam_row}`);
      log.data("Confidence", damLocation.confidence);
      if (damLocation.notes) {
        log.info(`Notes: ${damLocation.notes}`);
      }
      
      // Save for future runs
      await saveDamLocation(damLocation);
      log.info("Dam location cached to workspace/dam-location.json");
      console.log("");
    }
    
    // Step 2: Fetch drone API documentation
    log.start("Fetching drone API documentation...");
    const documentation = await fetchDocumentation();
    log.success(`Documentation fetched (${documentation.length} characters)`);
    
    // Save documentation for reference
    await ensureWorkspace();
    await writeFile(
      join(process.cwd(), "workspace", "drone-api-doc.html"),
      documentation,
      "utf-8"
    );
    log.info("Documentation saved to workspace/drone-api-doc.html");
    console.log("");
    
    // Step 3: Build instruction sequence
    log.start("Building drone instruction sequence...");
    
    // Based on drone API documentation and feedback:
    // 1. Turn on engines
    // 2. Set engine power
    // 3. setDestinationObject(ID) - sets official target (power plant)
    // 4. set(x,y) - sets actual landing sector (dam coordinates)
    // 5. set(xm) - sets flight height (need high enough to clear trees)
    // 6. set(destroy) - sets mission goal to destroy
    // 7. set(return) - return to base after mission
    // 8. flyToLocation - starts the flight
    
    const instructions = [
      `set(engineON)`,  // Turn on engines
      `set(${drone.enginePower})`,  // Set engine power
      `setDestinationObject(${drone.targetCode})`,  // Official target: power plant
      `set(${damLocation.dam_column},${damLocation.dam_row})`,  // Actual target: dam
      `set(${drone.flightHeight})`,  // Flight height to clear trees
      `set(destroy)`,  // Mission: destroy target
      `set(return)`,  // Return to base after mission
      `flyToLocation`  // Execute mission
    ];
    
    log.success("Instructions prepared:");
    instructions.forEach((inst, i) => {
      log.info(`  ${i + 1}. ${inst}`);
    });
    console.log("");
    
    // Step 4: Submit to hub
    let attempt = 1;
    
    while (attempt <= mission.maxAttempts) {
      log.step(attempt, mission.maxAttempts, "Submitting instructions to hub...");
      
      try {
        const result = await submitInstructions(instructions);
        
        // Check for flag
        if (result.flag || (result.message && result.message.includes("{FLG:"))) {
          const flagMatch = result.message?.match(/\{FLG:[^}]+\}/);
          const flag = result.flag || (flagMatch ? flagMatch[0] : null);
          if (flag) {
            log.flag(flag);
          }
          console.log("✓ Mission accomplished! Dam destroyed, water flowing to cooling system!");
          return;
        }
        
        // Show feedback
        log.warning("Submission result:");
        console.log(JSON.stringify(result, null, 2));
        console.log("");
        
        if (result.message) {
          log.info(`Feedback: ${result.message}`);
          
          // Check if we need to re-analyze dam location
          if (shouldReanalyze(result.message)) {
            log.warning("Feedback indicates wrong coordinates - need to re-analyze map");
            log.info("Delete workspace/dam-location.json and run again with improved vision prompt");
            break;
          }
          
          // Adjust instructions based on feedback
          if (result.message.includes("unknown") || result.message.includes("invalid")) {
            log.warning("Need to adjust instructions based on API documentation");
            log.info("Check documentation for correct function names");
            break;
          }
        }
        
        attempt++;
        
      } catch (error) {
        log.error("Submission error", error.message);
        throw error;
      }
    }
    
    if (attempt > mission.maxAttempts) {
      log.error("Max attempts reached", "Review documentation and adjust instructions");
    }
    
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

