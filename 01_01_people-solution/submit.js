import { readFile } from "node:fs/promises";
import { AGENT_TOKEN } from "../config.js";

const SUBMIT_URL = "https://hub.ag3nts.org/verify";

/**
 * Submit answer to the verification endpoint
 * @param {Array} answer - Array of people objects to submit
 * @returns {Promise<Object>} - Submission result
 */
export async function submitAnswer(answer) {
  const payload = {
    apikey: AGENT_TOKEN,
    task: "people",
    answer: answer
  };
  
  const response = await fetch(SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error("   Response:", JSON.stringify(result, null, 2));
    throw new Error(`Submission failed: ${response.status} ${response.statusText} - ${result.message || JSON.stringify(result)}`);
  }

  return result;
}

/**
 * Submit answer from output.json file (for standalone use)
 */
async function submitFromFile() {
  console.log("📤 Submitting answer from output.json...");
  
  const answerText = await readFile("output.json", "utf-8");
  const answer = JSON.parse(answerText);
  
  console.log(`   Found ${answer.length} people to submit`);
  
  const result = await submitAnswer(answer);
  
  console.log("\n📥 Response:");
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  submitFromFile().catch(error => {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  });
}
