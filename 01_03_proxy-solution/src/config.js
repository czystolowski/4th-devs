import { config } from "dotenv";
config();

export const AGENT_TOKEN = process.env.AGENT_TOKEN;
export const PORT = process.env.PORT || 3000;
export const PACKAGES_API_URL = "https://hub.ag3nts.org/api/packages";

// AI Configuration - using config.js from parent directory
import { 
  AI_API_KEY, 
  RESPONSES_API_ENDPOINT, 
  EXTRA_API_HEADERS,
  resolveModelForProvider 
} from "../../config.js";

export { AI_API_KEY, RESPONSES_API_ENDPOINT, EXTRA_API_HEADERS };
export const MODEL = resolveModelForProvider("openai/gpt-4o-mini");

// Validate required environment variables
if (!AGENT_TOKEN) {
  console.error("❌ Error: AGENT_TOKEN is required in .env file");
  process.exit(1);
}

if (!AI_API_KEY) {
  console.error("❌ Error: AI_API_KEY is required");
  process.exit(1);
}


