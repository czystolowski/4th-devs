/**
 * Test script for the proxy assistant
 * Tests basic conversation and tool calling
 */

const BASE_URL = "http://localhost:3000";
const TEST_SESSION = "test-session-" + Date.now();

async function testEndpoint(msg) {
  console.log(`\n📨 Sending: ${msg}`);
  
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionID: TEST_SESSION,
      msg
    })
  });
  
  const result = await response.json();
  console.log(`✅ Response: ${result.msg}`);
  
  return result;
}

async function runTests() {
  console.log("🧪 Testing Proxy Assistant");
  console.log("=".repeat(50));
  console.log(`Session ID: ${TEST_SESSION}`);
  
  try {
    // Test 1: Health check
    console.log("\n1️⃣ Health Check");
    const health = await fetch(BASE_URL);
    const healthData = await health.json();
    console.log("✓ Server is running:", healthData);
    
    // Test 2: Simple greeting
    console.log("\n2️⃣ Simple Greeting");
    await testEndpoint("Cześć! Jak się masz?");
    
    // Test 3: Check package (you'll need a real package ID from the API)
    console.log("\n3️⃣ Check Package");
    await testEndpoint("Sprawdź status paczki PKG00000001");
    
    // Test 4: Context retention
    console.log("\n4️⃣ Context Retention");
    await testEndpoint("A co z tą paczką którą przed chwilą sprawdzałeś?");
    
    console.log("\n✅ All tests completed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Check if server is running
console.log("Checking if server is running...");
fetch(BASE_URL)
  .then(() => {
    console.log("✓ Server is accessible\n");
    runTests();
  })
  .catch(() => {
    console.error("❌ Server is not running!");
    console.error("Please start the server first with: npm start");
    process.exit(1);
  });
