import { readFile } from "node:fs/promises";
import { AGENT_TOKEN } from "../config.js";

const SUBMIT_URL = "https://hub.ag3nts.org/verify";

async function submitAnswer() {
  console.log("📤 Submitting answer from output.json...");
  
  const answerText = await readFile("output.json", "utf-8");
  const answer = JSON.parse(answerText);
  
  console.log(`   Found ${answer.length} people to submit`);
  
  const body = {
    apikey: AGENT_TOKEN,
    task: "people",
    answer: answer
  };
  
  const response = await fetch(SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });

  const result = await response.json();
  
  console.log("\n📥 Response:");
  console.log(JSON.stringify(result, null, 2));
  
  if (!response.ok) {
    throw new Error(`Submission failed: ${response.status} ${response.statusText}`);
  }

  return result;
}

submitAnswer().catch(error => {
  console.error(`\n❌ Error: ${error.message}`);
  process.exit(1);
});
