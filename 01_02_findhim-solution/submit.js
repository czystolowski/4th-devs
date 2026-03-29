const SUBMIT_URL = "https://hub.ag3nts.org/verify";

// AGENT_TOKEN will be passed as parameter

/**
 * Submit answer to the verification endpoint
 * @param {Object} answer - Answer object with name, surname, accessLevel, powerPlant
 * @returns {Promise<Object>} - Submission result
 */
export async function submitAnswer(answer, apiKey) {
  const payload = {
    apikey: apiKey,
    task: "findhim",
    answer: answer
  };
  
  console.log("\n📤 Submitting answer:");
  console.log(JSON.stringify(payload, null, 2));
  
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


