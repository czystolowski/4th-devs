import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";
import { extractResponseText, toMessage } from "./helpers.js";
import { personSchema, specializationSchema, ALLOWED_SPECIALIZATIONS } from "./schema.js";

const MODEL = resolveModelForProvider("openrouter/free");

/**
 * Process a single CSV row into structured person data
 * Uses structured outputs (concept from 01_01_structured)
 */
export async function processPerson(csvRow) {
  const prompt = `Extract and structure person information from this CSV row:
Name: ${csvRow.name}
Surname: ${csvRow.surname}
Gender: ${csvRow.gender}
Birth Date: ${csvRow.birthDate}
Birth Place: ${csvRow.birthPlace}
Birth Country: ${csvRow.birthCountry}

Instructions:
- Extract the birth year from the date
- Normalize the city name (remove special characters like ≈, ö, etc.)
- Gender should be "M" or "F"
- Leave tags empty for now (will be enriched later)`;

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
      text: { format: personSchema }
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("Missing text output in API response");
  }

  return JSON.parse(outputText);
}

/**
 * Enrich person data with specializations using multi-turn conversation
 * Uses interaction concept from 01_01_interaction
 */
export async function enrichWithSpecializations(person, additionalContext = "") {
  const contextPrompt = `Based on this person's profile, determine their likely specializations:
Name: ${person.name} ${person.surname}
Gender: ${person.gender}
Born: ${person.born}
City: ${person.city}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Allowed specializations: ${ALLOWED_SPECIALIZATIONS.join(', ')}

Analyze the person's background and infer which specializations might apply. Consider:
- Common professions in their birth city/region
- Age and likely career stage
- Any contextual clues from the data

Return 1-3 most likely specializations.`;

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: MODEL,
      input: contextPrompt,
      text: { format: specializationSchema }
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("Missing text output in API response");
  }

  const result = JSON.parse(outputText);
  
  // Update person with enriched tags
  return {
    ...person,
    tags: result.tags
  };
}

/**
 * Process multiple people in batch
 * Implements pipeline concept from 01_01_grounding
 */
export async function processPeopleBatch(csvRows, options = {}) {
  const { enrichSpecializations = false, batchSize = 5 } = options;
  
  const results = [];
  
  console.log(`Processing ${csvRows.length} people...`);
  
  for (let i = 0; i < csvRows.length; i += batchSize) {
    const batch = csvRows.slice(i, i + batchSize);
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(csvRows.length / batchSize)}`);
    
    const batchPromises = batch.map(async (row) => {
      try {
        let person = await processPerson(row);
        
        if (enrichSpecializations) {
          person = await enrichWithSpecializations(person);
        }
        
        return person;
      } catch (error) {
        console.error(`  Error processing ${row.name} ${row.surname}: ${error.message}`);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(p => p !== null));
  }
  
  console.log(`Processed ${results.length}/${csvRows.length} people successfully`);
  
  return results;
}


