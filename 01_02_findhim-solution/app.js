import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
config({ path: join(rootDir, ".env") });

const AGENT_TOKEN = process.env.AGENT_TOKEN;

if (!AGENT_TOKEN) {
  console.error("Error: AGENT_TOKEN not found in .env file");
  process.exit(1);
}

import {
  fetchPowerPlants,
  fetchPersonLocations,
  fetchAccessLevel,
  findClosestPowerPlant,
  processSuspectsInBatches
} from "./helpers.js";
import { submitAnswer } from "./submit.js";

const SUSPECTS_FILE = "../01_01_people-solution/output.json";

async function loadSuspects() {
  if (!existsSync(SUSPECTS_FILE)) {
    throw new Error(`Suspects file not found: ${SUSPECTS_FILE}\nPlease run the S01E01 task first to generate the suspects list.`);
  }
  
  const data = await readFile(SUSPECTS_FILE, "utf-8");
  return JSON.parse(data);
}

/**
 * Process a single suspect to find their closest power plant
 */
async function processSuspect(suspect, powerPlants) {
  try {
    console.log(`   Checking ${suspect.name} ${suspect.surname}...`);

    const locations = await fetchPersonLocations(
      AGENT_TOKEN,
      suspect.name,
      suspect.surname
    );
    
    if (!locations || locations.length === 0) {
      console.log(`     No locations found`);
      return null;
    }
    
    console.log(`     Found ${locations.length} location(s)`);

    const { closestPlant, minDistance } = findClosestPowerPlant(locations, powerPlants);
    
    if (!closestPlant) {
      console.log(`     No power plant found nearby`);
      return null;
    }
    
    console.log(`     Closest to ${closestPlant.name} (${minDistance.toFixed(2)} km)`);
    
    return {
      ...suspect,
      closestPlant,
      distance: minDistance
    };
  } catch (error) {
    console.error(`     Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("🔍 Find Him - Power Plant Proximity Analysis");
  console.log("=".repeat(50));
  
  try {
    // Step 1: Load suspects from previous task
    console.log("\n📋 Step 1: Loading suspects from S01E01...");
    const suspects = await loadSuspects();
    console.log(`   ✓ Loaded ${suspects.length} suspects`);
    
    if (suspects.length === 0) {
      console.log("\n⚠️  No suspects to process");
      return;
    }
    
    // Step 2: Fetch power plant locations
    console.log("\n🏭 Step 2: Fetching power plant locations...");
    const powerPlantsData = await fetchPowerPlants(AGENT_TOKEN);
    
    // Extract the actual power plants data (might be nested under a key)
    const plantsObject = powerPlantsData.power_plants || powerPlantsData;
    
    // Convert nested object to array with city names
    const powerPlants = Object.entries(plantsObject).map(([city, data]) => ({
      name: city,
      ...data
    }));
    
    console.log(`   ✓ Loaded ${powerPlants.length} power plants`);
    console.log(`   Cities:`, powerPlants.map(p => p.name).join(', '));
    
    // Step 3: Process each suspect to find their locations
    console.log("\n📍 Step 3: Checking suspect locations...");
    const suspectsWithLocations = await processSuspectsInBatches(
      suspects,
      (suspect) => processSuspect(suspect, powerPlants),
      5
    );
    
    // Filter out suspects with no locations
    const validSuspects = suspectsWithLocations.filter(s => s !== null);
    console.log(`   ✓ Found ${validSuspects.length} suspects with location data`);
    
    if (validSuspects.length === 0) {
      console.log("\n⚠️  No suspects found near power plants");
      return;
    }
    
    // Step 4: Find the suspect closest to any power plant
    console.log("\n🎯 Step 4: Finding closest suspect to power plants...");
    const closestSuspect = validSuspects.reduce((closest, current) => {
      return current.distance < closest.distance ? current : closest;
    });
    
    console.log(`   ✓ Closest suspect: ${closestSuspect.name} ${closestSuspect.surname}`);
    console.log(`     Power plant: ${closestSuspect.closestPlant.name}`);
    console.log(`     Distance: ${closestSuspect.distance.toFixed(2)} km`);
    
    // Step 5: Get access level for the suspect
    console.log("\n🔐 Step 5: Fetching access level...");
    const accessLevel = await fetchAccessLevel(
      AGENT_TOKEN,
      closestSuspect.name,
      closestSuspect.surname,
      closestSuspect.born
    );
    console.log(`   ✓ Access level: ${accessLevel}`);
    
    // Step 6: Prepare final answer
    console.log("\n📝 Step 6: Preparing answer...");
    const answer = {
      name: closestSuspect.name,
      surname: closestSuspect.surname,
      accessLevel: accessLevel,
      powerPlant: closestSuspect.closestPlant.code
    };
    
    // Save result locally
    const outputPath = "result.json";
    await writeFile(outputPath, JSON.stringify(answer, null, 2), "utf-8");
    console.log(`   ✓ Saved to ${outputPath}`);
    
    // Step 7: Submit answer
    console.log("\n📤 Step 7: Submitting answer...");
    try {
      const submissionResult = await submitAnswer(answer, AGENT_TOKEN);
      console.log("   ✓ Submission successful!");
      console.log("\n📥 Response:");
      console.log(JSON.stringify(submissionResult, null, 2));
      
      // Check for flag in response
      if (submissionResult.message) {
        const flagMatch = submissionResult.message.match(/\{FLG:[A-Z0-9_]+\}/);
        if (flagMatch) {
          console.log("\n🎉 FLAG FOUND:", flagMatch[0]);
          console.log("   Submit it at: https://hub.ag3nts.org/");
        }
      }
    } catch (submitError) {
      console.error(`   ✗ Submission failed: ${submitError.message}`);
      console.log("   Answer saved locally in result.json");
    }
    
    console.log("\n✅ Done!");
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();


