import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";
import { callRailwayAPI, getAPIDocumentation } from "./src/api-client.js";

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
config({ path: join(rootDir, ".env") });

const AGENT_TOKEN = process.env.AGENT_TOKEN;

if (!AGENT_TOKEN) {
  console.error("❌ Error: AGENT_TOKEN not found in .env file");
  process.exit(1);
}

/**
 * Extract flag from response
 */
function extractFlag(response) {
  const responseStr = JSON.stringify(response);
  const flagMatch = responseStr.match(/\{FLG:[A-Z0-9_]+\}/);
  return flagMatch ? flagMatch[0] : null;
}

/**
 * Parse API documentation and extract action sequence
 */
function parseDocumentation(doc) {
  console.log("\n📋 API Documentation:");
  console.log(JSON.stringify(doc, null, 2));
  
  // The documentation should tell us what actions are available
  // and in what order to call them
  return doc;
}

/**
 * Execute action sequence to activate route X-01
 *
 * Based on API documentation:
 * 1. reconfigure - Enable reconfigure mode
 * 2. setstatus - Set status to RTOPEN
 * 3. save - Exit reconfigure mode and save
 */
async function executeActionSequence(apikey, documentation) {
  console.log("\n🚂 Executing action sequence for route X-01...");
  
  const ROUTE = "X-01";
  let lastResponse = null;
  
  try {
    // Step 1: Enable reconfigure mode
    console.log("\n1️⃣ Enabling reconfigure mode...");
    const reconfigureResult = await callRailwayAPI(apikey, "reconfigure", { route: ROUTE });
    console.log("   Response:", JSON.stringify(reconfigureResult, null, 2));
    lastResponse = reconfigureResult;
    
    // Check for flag
    let flag = extractFlag(reconfigureResult);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND: ${flag}`);
      return reconfigureResult;
    }
    
    // Step 2: Check current status (optional, for logging)
    console.log("\n2️⃣ Checking current status...");
    const statusResult = await callRailwayAPI(apikey, "getstatus", { route: ROUTE });
    console.log("   Response:", JSON.stringify(statusResult, null, 2));
    lastResponse = statusResult;
    
    // Check for flag
    flag = extractFlag(statusResult);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND: ${flag}`);
      return statusResult;
    }
    
    // Step 3: Set status to RTOPEN (activate the route)
    console.log("\n3️⃣ Setting status to RTOPEN (activating route)...");
    const setstatusResult = await callRailwayAPI(apikey, "setstatus", {
      route: ROUTE,
      value: "RTOPEN"
    });
    console.log("   Response:", JSON.stringify(setstatusResult, null, 2));
    lastResponse = setstatusResult;
    
    // Check for flag
    flag = extractFlag(setstatusResult);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND: ${flag}`);
      return setstatusResult;
    }
    
    // Step 4: Save configuration (exit reconfigure mode)
    console.log("\n4️⃣ Saving configuration...");
    const saveResult = await callRailwayAPI(apikey, "save", { route: ROUTE });
    console.log("   Response:", JSON.stringify(saveResult, null, 2));
    lastResponse = saveResult;
    
    // Check for flag
    flag = extractFlag(saveResult);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND: ${flag}`);
      return saveResult;
    }
    
    // Step 5: Verify final status
    console.log("\n5️⃣ Verifying final status...");
    const finalStatusResult = await callRailwayAPI(apikey, "getstatus", { route: ROUTE });
    console.log("   Response:", JSON.stringify(finalStatusResult, null, 2));
    lastResponse = finalStatusResult;
    
    // Check for flag
    flag = extractFlag(finalStatusResult);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND: ${flag}`);
      return finalStatusResult;
    }
    
    return lastResponse;
    
  } catch (error) {
    console.error(`\n❌ Error during sequence execution: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log("🚂 Railway Route X-01 Activation");
  console.log("=".repeat(50));
  
  try {
    // Step 1: Get API documentation
    console.log("\n📖 Step 1: Fetching API documentation...");
    const documentation = await getAPIDocumentation(AGENT_TOKEN);
    
    // Save documentation for reference
    await writeFile(
      "api-documentation.json",
      JSON.stringify(documentation, null, 2),
      "utf-8"
    );
    console.log("   ✓ Documentation saved to api-documentation.json");
    
    // Step 2: Parse documentation
    console.log("\n📋 Step 2: Parsing documentation...");
    const parsedDoc = parseDocumentation(documentation);
    
    // Check for flag in help response
    let flag = extractFlag(documentation);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND in help response: ${flag}`);
      console.log("   Submit it at: https://hub.ag3nts.org/");
      return;
    }
    
    // Step 3: Execute action sequence
    console.log("\n🚀 Step 3: Executing actions...");
    const result = await executeActionSequence(AGENT_TOKEN, parsedDoc);
    
    // Check for flag in result
    flag = extractFlag(result);
    if (flag) {
      console.log(`\n🎉 FLAG FOUND: ${flag}`);
      console.log("   Submit it at: https://hub.ag3nts.org/");
    } else {
      console.log("\n⚠️  No flag found yet.");
      console.log("   Review api-documentation.json to understand the required sequence.");
      console.log("   You may need to implement additional actions based on the documentation.");
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


