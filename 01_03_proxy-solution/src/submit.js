/**
 * Submit the solution to the verification endpoint
 */

const VERIFY_URL = "https://hub.ag3nts.org/verify";

export async function submitSolution(apikey, url, sessionID) {
  const payload = {
    apikey,
    task: "proxy",
    answer: {
      url,
      sessionID
    }
  };
  
  console.log("\n📤 Submitting solution:");
  console.log(`   URL: ${url}`);
  console.log(`   Session ID: ${sessionID}`);
  
  const response = await fetch(VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error("   Response:", JSON.stringify(result, null, 2));
    throw new Error(`Submission failed: ${response.status} ${response.statusText}`);
  }
  
  return result;
}


