import { writeFile } from "node:fs/promises";
import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";
import { downloadCSV, parseCSV } from "./helpers.js";
import { processPeopleBatch } from "./processor.js";
import { PeopleDatabase } from "./database.js";

// Default CSV URL (can be overridden via command line)
const DEFAULT_CSV_URL = "https://example.com/people.csv";

// Parse command line arguments
const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const CSV_URL = urlIndex !== -1 && args[urlIndex + 1] 
  ? args[urlIndex + 1] 
  : DEFAULT_CSV_URL;

const enrichIndex = args.indexOf("--enrich");
const ENRICH_SPECIALIZATIONS = enrichIndex !== -1;

/**
 * Main application flow
 * Combines concepts from all three repositories:
 * - 01_01_interaction: Multi-turn conversations for enrichment
 * - 01_01_structured: Structured outputs with JSON schema
 * - 01_01_grounding: Pipeline processing with multiple steps
 */
async function main() {
  console.log("🚀 People CSV Processor");
  console.log("=".repeat(50));
  
  try {
    // Step 1: Download CSV
    console.log("\n📥 Step 1: Downloading CSV...");
    console.log(`   URL: ${CSV_URL}`);
    const csvText = await downloadCSV(CSV_URL);
    console.log(`   ✓ Downloaded (${csvText.length} bytes)`);

    // Step 2: Parse CSV
    console.log("\n📋 Step 2: Parsing CSV...");
    const csvData = parseCSV(csvText);
    console.log(`   ✓ Parsed ${csvData.length} rows`);
    
    if (csvData.length === 0) {
      console.log("\n⚠️  No data to process");
      return;
    }

    // Show sample row
    console.log("\n   Sample row:");
    console.log(`   ${JSON.stringify(csvData[0], null, 2)}`);

    // Step 3: Process people with AI
    console.log("\n🤖 Step 3: Processing with AI...");
    if (ENRICH_SPECIALIZATIONS) {
      console.log("   (with specialization enrichment)");
    }
    
    const people = await processPeopleBatch(csvData, {
      enrichSpecializations: ENRICH_SPECIALIZATIONS,
      batchSize: 3 // Process 3 at a time to avoid rate limits
    });

    // Step 4: Create database and show results
    console.log("\n💾 Step 4: Creating database...");
    const db = new PeopleDatabase(people);
    console.log(`   ✓ Database created with ${db.count()} people`);

    // Step 5: Show statistics
    console.log("\n📊 Step 5: Statistics");
    const stats = db.getStats();
    console.log(`   Total people: ${stats.total}`);
    console.log(`   Gender distribution: ${stats.byGender.M} male, ${stats.byGender.F} female`);
    console.log(`   Age range: ${stats.age.min}-${stats.age.max} (avg: ${stats.age.avg})`);
    console.log(`   Unique cities: ${stats.cities}`);
    console.log(`   Specializations: ${stats.specializations.join(', ') || 'none'}`);

    // Step 6: Save results
    console.log("\n💾 Step 6: Saving results...");
    const outputPath = "01_01_people-solution/output.json";
    await writeFile(outputPath, JSON.stringify(people, null, 2), "utf-8");
    console.log(`   ✓ Saved to ${outputPath}`);

    // Step 7: Show filtering examples
    console.log("\n🔍 Step 7: Filtering examples");
    
    // Example: Filter by gender
    const males = db.filterByGender('M');
    console.log(`   Males: ${males.count()}`);
    
    // Example: Filter by age range
    const adults = db.filterByAge(25, 40);
    console.log(`   Age 25-40: ${adults.count()}`);
    
    // Example: Filter by specialization (if enriched)
    if (ENRICH_SPECIALIZATIONS && stats.specializations.length > 0) {
      const firstSpec = stats.specializations[0];
      const specialized = db.filterBySpecialization(firstSpec);
      console.log(`   With "${firstSpec}": ${specialized.count()}`);
    }

    // Example: Chain filters
    const filtered = db
      .filterByGender('M')
      .filterByAge(30, 50);
    console.log(`   Males aged 30-50: ${filtered.count()}`);

    // Show sample output
    console.log("\n📄 Sample output (first 2 people):");
    console.log(JSON.stringify(people.slice(0, 2), null, 2));

    console.log("\n✅ Done!");
    console.log("\nUsage examples:");
    console.log("  node app.js --url https://your-csv-url.com/data.csv");
    console.log("  node app.js --url https://your-csv-url.com/data.csv --enrich");
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the application
main();


