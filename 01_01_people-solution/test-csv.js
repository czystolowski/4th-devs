/**
 * Test CSV parsing functionality with sample data
 */

import { readFile } from "node:fs/promises";
import { parseCSV, extractBirthYear, normalizeCity } from "./helpers.js";

async function main() {
  console.log("🧪 Testing CSV Parsing");
  console.log("=".repeat(50));

  try {
    // Read sample CSV file
    console.log("\n📥 Reading sample-data.csv...");
    const csvText = await readFile("sample-data.csv", "utf-8");
    console.log(`   ✓ Read ${csvText.length} bytes`);

    // Parse CSV
    console.log("\n📋 Parsing CSV...");
    const data = parseCSV(csvText);
    console.log(`   ✓ Parsed ${data.length} rows`);

    // Show parsed data
    console.log("\n📄 Parsed data:");
    data.forEach((row, index) => {
      console.log(`\n   Row ${index + 1}:`);
      console.log(`   Name: ${row.name} ${row.surname}`);
      console.log(`   Gender: ${row.gender}`);
      console.log(`   Birth Date: ${row.birthDate}`);
      console.log(`   Birth Place: ${row.birthPlace}`);
      console.log(`   Birth Country: ${row.birthCountry}`);
      
      // Test helper functions
      const birthYear = extractBirthYear(row.birthDate);
      const normalizedCity = normalizeCity(row.birthPlace);
      console.log(`   → Extracted year: ${birthYear}`);
      console.log(`   → Normalized city: ${normalizedCity}`);
    });

    // Test with special characters
    console.log("\n🔤 Testing special character handling:");
    const testCities = ["≈örem", "Łódź", "Kraków", "Gdańsk"];
    testCities.forEach(city => {
      console.log(`   ${city} → ${normalizeCity(city)}`);
    });

    console.log("\n✅ CSV parsing test complete!");

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();


