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
 * Execute action sequence based on API documentation
 */
async function executeActionSequence(apikey, documentation) {
  console.log("\n🚂 Executing action sequence...");
  
  // The API documentation will tell us what to do
  // We need to follow it exactly
  
  // Common pattern: the documentation might specify:
  // 1. Actions available
  // 2. Required parameters
  // 3. Sequence/order of operations
  
  // For now, let's try to understand the structure
  // The actual implementation will depend on what the help action returns
  
  if (documentation.actions) {
    console.log("\n📝 Available actions:");
    for (const [actionName, actionInfo] of Object.entries(documentation.actions)) {
      console.log(`   - ${actionName}: ${actionInfo.description || 'No description'}`);
      if (actionInfo.parameters) {
        console.log(`     Parameters:`, actionInfo.parameters);
      }
    }
  }
  
  // Check if there's a sequence specified
  if (documentation.sequence) {
    console.log("\n🔢 Action sequence:");
    console.log(documentation.sequence);
  }
  
  // Check if there's information about route X-01
  if (documentation.route || documentation.routes) {
    console.log("\n🛤️  Route information:");
    console.log(documentation.route || documentation.routes);
  }
  
  // Return the documentation for manual inspection
  // The actual sequence will need to be implemented based on what we learn
  return documentation;
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


