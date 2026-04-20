import { writeFile } from "node:fs/promises";
import { submitDeclaration } from "./src/api.js";
import { analyzeDocumentation, buildDeclarationWithAI } from "./src/analyzer.js";

/**
 * Build the declaration string from analyzed data
 */
function formatDeclaration(taskRequirements, analyzedData) {
  const today = new Date().toISOString().split('T')[0];
  
  const declaration = `SYSTEM PRZESYŁEK KONDUKTORSKICH - DEKLARACJA ZAWARTOŚCI
======================================================
DATA: ${today}
PUNKT NADAWCZY: ${taskRequirements.origin}
------------------------------------------------------
NADAWCA: ${taskRequirements.senderId}
PUNKT DOCELOWY: ${taskRequirements.destination}
TRASA: ${analyzedData.route}
------------------------------------------------------
KATEGORIA PRZESYŁKI: ${analyzedData.category}
------------------------------------------------------
OPIS ZAWARTOŚCI (max 200 znaków): ${taskRequirements.content}
------------------------------------------------------
DEKLAROWANA MASA (kg): ${taskRequirements.weight}
------------------------------------------------------
WDP: ${analyzedData.wdp}
------------------------------------------------------
UWAGI SPECJALNE: ${taskRequirements.specialNotes}
------------------------------------------------------
KWOTA DO ZAPŁATY: ${analyzedData.cost} PP
------------------------------------------------------
OŚWIADCZAM, ŻE PODANE INFORMACJE SĄ PRAWDZIWE.
BIORĘ NA SIEBIE KONSEKWENCJĘ ZA FAŁSZYWE OŚWIADCZENIE.
======================================================`;

  return declaration;
}

async function main() {
  console.log("🚚 Sendit Solution - AI-Powered SPK Declaration");
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
    
    // Step 1: Fetch and analyze documentation
    console.log("\n📚 Step 1: Fetching and analyzing documentation...");
    const documentation = await analyzeDocumentation(taskRequirements);
    console.log("   ✓ Documentation fetched and analyzed");
    
    // Step 2: Use AI to determine correct values
    console.log("\n🤖 Step 2: Using AI to analyze requirements...");
    const analyzedData = await buildDeclarationWithAI(taskRequirements, documentation);
    
    console.log("\n📊 AI Analysis Results:");
    console.log(`   Category: ${analyzedData.category}`);
    console.log(`   Route: ${analyzedData.route}`);
    console.log(`   Additional Wagons (WDP): ${analyzedData.wdp}`);
    console.log(`   Total Cost: ${analyzedData.cost} PP`);
    
    // Step 3: Build declaration
    console.log("\n📝 Step 3: Building declaration...");
    const declaration = formatDeclaration(taskRequirements, analyzedData);
    console.log("   ✓ Declaration built");
    console.log("\n" + declaration);
    
    // Step 4: Save locally
    console.log("\n💾 Step 4: Saving declaration locally...");
    await writeFile("declaration.txt", declaration, "utf-8");
    
    // Save analysis details
    const analysisReport = {
      taskRequirements,
      analyzedData,
      declaration
    };
    await writeFile("analysis-report.json", JSON.stringify(analysisReport, null, 2), "utf-8");
    console.log("   ✓ Saved to declaration.txt");
    console.log("   ✓ Saved analysis to analysis-report.json");
    
    // Step 5: Submit to verification endpoint
    console.log("\n📤 Step 5: Submitting to verification endpoint...");
    const result = await submitDeclaration(declaration);
    console.log("   ✓ Submission successful!");
    
    console.log("\n📥 Response:");
    console.log(JSON.stringify(result, null, 2));
    
    // Check for flag
    const responseStr = JSON.stringify(result);
    const flagMatch = responseStr.match(/\{FLG:[A-Z0-9_]+\}/);
    if (flagMatch) {
      console.log("\n🎉 FLAG FOUND:", flagMatch[0]);
    }
    
    console.log("\n✅ Done!");
    console.log("\n📊 Summary:");
    console.log(`   - Documentation files analyzed: 5`);
    console.log(`   - AI analyses performed: 4 (category, wagons, route, cost)`);
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


