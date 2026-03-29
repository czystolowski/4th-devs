import { writeFile } from "node:fs/promises";
import {
  AI_API_KEY,
  AGENT_TOKEN,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";
import { downloadCSV, parseCSV, extractResponseText, processPersonRow } from "./helpers.js";
import { PeopleDatabase } from "./database.js";
import { specializationSchema } from "./schema.js";
import { submitAnswer } from "./submit.js";

const PORTAL_URL = "https://hub.ag3nts.org";
const CSV_URL = `${PORTAL_URL}/data/${AGENT_TOKEN}/people.csv`;
const MODEL = resolveModelForProvider("openai/gpt-4o-mini");

/**
 * Deduce tags from job description using AI
 */
async function deduceTagsFromJob(person) {
  if (!person.job) {
    return person;
  }

  const prompt = `Jesteś ekspertem od kategoryzacji zawodów. Na podstawie opisu stanowiska pracy, przypisz odpowiednie specjalizacje z dozwolonej listy.

Osoba: ${person.name} ${person.surname}
Opis stanowiska: ${person.job}

Dozwolone specjalizacje (wybierz 1-3 najbardziej trafne):
- "IT" → technologia, programowanie, systemy informatyczne, inżynieria oprogramowania
- "transport" → logistyka, przewóz towarów/osób, spedycja, magazynowanie
- "edukacja" → nauczanie, szkolenia, wychowanie, dydaktyka
- "medycyna" → ochrona zdrowia, leczenie, diagnostyka, farmacja, nauki medyczne i biologiczne
- "praca z ludźmi" → obsługa klienta, HR, doradztwo, opieka, sprzedaż bezpośrednia
- "praca z pojazdami" → prowadzenie, naprawa lub obsługa pojazdów mechanicznych
- "praca fizyczna" → praca manualna, budowlana, produkcyjna, terenowa

Zwróć tylko specjalizacje, które jednoznacznie wynikają z opisu. W razie wątpliwości wybierz mniej kategorii.`;

  try {
    const response = await fetch(RESPONSES_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_API_KEY}`,
        ...EXTRA_API_HEADERS
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        text: { format: specializationSchema }
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(`   Error for ${person.name} ${person.surname}: ${data?.error?.code} - ${data?.error?.message || 'Unknown error'}`);
      return person;
    }

    const outputText = extractResponseText(data);
    if (!outputText) {
      console.warn(`   Improper response for ${person.name} ${person.surname} - ${person.job}`);
      return person;
    }

    const result = JSON.parse(outputText);

    return {
      ...person,
      tags: result.tags
    };
  } catch (error) {
    console.error(`   Error processing ${person.name} ${person.surname}: ${error.message}`);
    return person;
  }
}

/**
 * Process people in batches with AI tag deduction
 */
async function processPeopleWithTags(people, batchSize = 11) {
  const results = [];
  const total = people.length;
  
  console.log(`   Processing ${total} people in batches of ${batchSize}...`);
  
  for (let i = 0; i < total; i += batchSize) {
    const batch = people.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);
    
    console.log(`   Batch ${batchNum}/${totalBatches}`);
    
    const batchPromises = batch.map(person => deduceTagsFromJob(person));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Small delay to avoid rate limits
    if (i + batchSize < total) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

async function main() {
  console.log("🚀 People CSV Processor");
  console.log("=".repeat(50));
  
  try {
    console.log("\n📥 Step 1: Downloading CSV...");
    console.log(`URL: ${CSV_URL}`);
    const csvText = await downloadCSV(CSV_URL);
    console.log(`✓ Downloaded (${csvText.length} bytes)`);

    console.log("\n📋 Step 2: Parsing CSV...");
    const csvData = parseCSV(csvText);
    console.log(`✓ Parsed ${csvData.length} rows`);
    
    if (csvData.length === 0) {
      console.log("\n⚠️  No data to process");
      return;
    }

    console.log("\n🔄 Step 3: Processing data...");
    const allPeople = csvData.map(processPersonRow).filter(p => p.born !== null);
    console.log(`   ✓ Processed ${allPeople.length}/${csvData.length} people`);

    console.log("\n🔍 Step 4: Filtering...");
    const db = new PeopleDatabase(allPeople);
    
    const filtered = db
      .filterByGender('M')
      .filterByAge(20,40)
      .filterByCity('Grudziądz');
    
    console.log(`   Males: ${db.filterByGender('M').count()}`);
    console.log(`   In age 20-40: ${db.filterByGender('M').filterByAge(20,40).count()}`);
    console.log(`   And from Grudziądz: ${filtered.count()}`);

    const filteredPeople = filtered.getAll();
    
    if (filteredPeople.length === 0) {
      console.log("\n⚠️  No people match the criteria");
      return;
    }

    console.log("\n🤖 Step 5: Deducing tags from job descriptions...");
    const peopleWithTags = await processPeopleWithTags(filteredPeople);
    console.log(`   ✓ Processed ${peopleWithTags.length} people`);

    // Step 6: Filter by transport specialization
    console.log("\n🚚 Step 6: Filtering by transport specialization...");
    const transportPeople = peopleWithTags.filter(p => p.tags.includes('transport'));
    console.log(`   ✓ Found ${transportPeople.length} people in transport`);

    // Remove job field from final output
    const finalAnswer = transportPeople.map(({ job, ...person }) => person);

    // Step 7: Save results
    console.log("\n💾 Step 7: Saving results...");
    const outputPath = "output.json";
    await writeFile(outputPath, JSON.stringify(finalAnswer, null, 2), "utf-8");
    console.log(`   ✓ Saved to ${outputPath}`);

    // Step 8: Show sample output
    console.log("\n📄 Sample output (first 3 people):");
    console.log(JSON.stringify(finalAnswer.slice(0, 3), null, 2));

    // Step 9: Submit answer
    console.log("\n📤 Step 9: Submitting answer...");
    try {
      const submissionResult = await submitAnswer(finalAnswer);
      console.log("   ✓ Submission successful!");
      console.log("   Response:", JSON.stringify(submissionResult, null, 2));
    } catch (submitError) {
      console.error(`   ✗ Submission failed: ${submitError.message}`);
      console.log("   Answer saved locally in output.json");
    }

    console.log("\n✅ Done!");
    console.log(`\nFinal result: ${finalAnswer.length} people`);
    
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


