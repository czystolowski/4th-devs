import { writeFile } from "node:fs/promises";
import { submitDeclaration, HUB_URL } from "./src/api.js";
import { runAgent } from "./src/agent.js";

async function main() {
  console.log("🤖 Sendit Solution - Autonomous Agent Version");
  console.log("=".repeat(50));
  
  try {
    // Task requirements from the problem statement
    const taskRequirements = {
      senderId: "450202122",
      origin: "Gdańsk",
      destination: "Żarnowiec",
      weight: 2800,
      budget: 0, // Must be free or System-funded
      content: "kasety z paliwem do reaktora",
      specialNotes: "brak" // No special notes to avoid manual verification
    };
    
    console.log("\n📋 Task Requirements:");
    console.log(`   Sender ID: ${taskRequirements.senderId}`);
    console.log(`   Route: ${taskRequirements.origin} → ${taskRequirements.destination}`);
    console.log(`   Weight: ${taskRequirements.weight} kg`);
    console.log(`   Budget: ${taskRequirements.budget} PP`);
    console.log(`   Content: ${taskRequirements.content}`);
    console.log(`   Special notes: ${taskRequirements.specialNotes}`);
    
    // Step 1: Run autonomous agent to analyze documentation and build declaration
    console.log("\n🤖 Step 1: Running autonomous agent...");
    console.log("   The agent will:");
    console.log("   - Fetch and analyze index.md");
    console.log("   - Discover referenced documents");
    console.log("   - Analyze images with vision");
    console.log("   - Determine correct values");
    console.log("   - Build the declaration");
    
    const result = await runAgent(taskRequirements);
    
    console.log("\n📊 Agent Analysis Complete:");
    console.log(`   Documents analyzed: ${result.documentsAnalyzed}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Route: ${result.route}`);
    console.log(`   Additional Wagons (WDP): ${result.wdp}`);
    console.log(`   Total Cost: ${result.cost} PP`);
    
    // Step 2: Display declaration
    console.log("\n📝 Step 2: Generated Declaration:");
    console.log("\n" + result.declaration);
    
    // Step 3: Save locally
    console.log("\n💾 Step 3: Saving results...");
    await writeFile("declaration.txt", result.declaration, "utf-8");
    await writeFile("agent-analysis.json", JSON.stringify(result, null, 2), "utf-8");
    console.log("   ✓ Saved to declaration.txt");
    console.log("   ✓ Saved analysis to agent-analysis.json");
    
    // Step 4: Submit to verification endpoint
    console.log("\n📤 Step 4: Submitting to verification endpoint...");
    const verificationResult = await submitDeclaration(result.declaration);
    console.log("   ✓ Submission successful!");
    
    console.log("\n📥 Response:");
    console.log(JSON.stringify(verificationResult, null, 2));
    
    // Check for flag
    const responseStr = JSON.stringify(verificationResult);
    const flagMatch = responseStr.match(/\{FLG:[A-Z0-9_]+\}/);
    if (flagMatch) {
      console.log("\n🎉 FLAG FOUND:", flagMatch[0]);
    }
    
    console.log("\n✅ Done!");
    console.log("\n📊 Summary:");
    console.log(`   - Agent iterations: ${result.iterations}`);
    console.log(`   - Documents analyzed: ${result.documentsAnalyzed}`);
    console.log(`   - Declaration submitted successfully`);
    console.log(`   - Flag: ${flagMatch ? flagMatch[0] : "Not found"}`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();


