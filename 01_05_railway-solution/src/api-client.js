/**
 * Railway API Client with retry logic and rate limiting
 */

const API_URL = "https://hub.ag3nts.org/verify";
const MAX_RETRIES = 10;
const INITIAL_BACKOFF = 1000; // 1 second
const MAX_BACKOFF = 30000; // 30 seconds

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse rate limit headers from response
 */
function parseRateLimitHeaders(headers) {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  
  return {
    limit: limit ? parseInt(limit) : null,
    remaining: remaining ? parseInt(remaining) : null,
    reset: reset ? parseInt(reset) : null,
    resetDate: reset ? new Date(parseInt(reset) * 1000) : null
  };
}

/**
 * Calculate wait time until rate limit reset
 */
function getWaitTimeUntilReset(resetTimestamp) {
  if (!resetTimestamp) return 0;
  
  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = resetTimestamp - now;
  
  return Math.max(0, waitSeconds * 1000); // Convert to milliseconds
}

/**
 * Make API call with retry logic and rate limiting
 */
export async function callRailwayAPI(apikey, action, additionalParams = {}) {
  const payload = {
    apikey,
    task: "railway",
    answer: {
      action,
      ...additionalParams
    }
  };
  
  let lastError = null;
  let backoff = INITIAL_BACKOFF;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n🔄 Attempt ${attempt}/${MAX_RETRIES}: ${action}`);
      if (Object.keys(additionalParams).length > 0) {
        console.log(`   Parameters:`, JSON.stringify(additionalParams));
      }
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      // Parse rate limit headers
      const rateLimit = parseRateLimitHeaders(response.headers);
      if (rateLimit.remaining !== null) {
        console.log(`   Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
        if (rateLimit.resetDate) {
          console.log(`   Reset at: ${rateLimit.resetDate.toLocaleTimeString()}`);
        }
      }
      
      // Handle 503 Service Unavailable (simulated overload)
      if (response.status === 503) {
        console.log(`   ⚠️  503 Service Unavailable (attempt ${attempt}/${MAX_RETRIES})`);
        
        if (attempt < MAX_RETRIES) {
          console.log(`   ⏳ Waiting ${backoff}ms before retry...`);
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF); // Exponential backoff
          continue;
        }
        
        throw new Error(`API returned 503 after ${MAX_RETRIES} attempts`);
      }
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        const waitTime = getWaitTimeUntilReset(rateLimit.reset);
        console.log(`   ⏸️  Rate limit exceeded`);
        
        if (waitTime > 0) {
          console.log(`   ⏳ Waiting ${Math.ceil(waitTime / 1000)}s until reset...`);
          await sleep(waitTime + 1000); // Add 1s buffer
          continue;
        }
        
        // Fallback if no reset time
        console.log(`   ⏳ Waiting ${backoff}ms...`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
        continue;
      }
      
      // Parse response
      const data = await response.json();
      
      // Handle other HTTP errors
      if (!response.ok) {
        console.error(`   ❌ HTTP ${response.status}:`, data);
        throw new Error(`API error: ${response.status} - ${JSON.stringify(data)}`);
      }
      
      // Success
      console.log(`   ✅ Success`);
      
      // Check if we're approaching rate limit
      if (rateLimit.remaining !== null && rateLimit.remaining <= 2) {
        const waitTime = getWaitTimeUntilReset(rateLimit.reset);
        if (waitTime > 0) {
          console.log(`   ⚠️  Low rate limit (${rateLimit.remaining} remaining)`);
          console.log(`   ⏳ Waiting ${Math.ceil(waitTime / 1000)}s for reset...`);
          await sleep(waitTime + 1000);
        }
      }
      
      return data;
      
    } catch (error) {
      lastError = error;
      
      // Network errors or other exceptions
      if (error.message.includes('fetch')) {
        console.error(`   ❌ Network error: ${error.message}`);
        
        if (attempt < MAX_RETRIES) {
          console.log(`   ⏳ Waiting ${backoff}ms before retry...`);
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF);
          continue;
        }
      }
      
      // Re-throw if not retryable
      throw error;
    }
  }
  
  throw lastError || new Error(`Failed after ${MAX_RETRIES} attempts`);
}

/**
 * Get API documentation via help action
 */
export async function getAPIDocumentation(apikey) {
  console.log("\n📖 Fetching API documentation...");
  return await callRailwayAPI(apikey, "help");
}


