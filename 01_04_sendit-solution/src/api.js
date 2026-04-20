import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");
config({ path: join(rootDir, ".env") });

const AGENT_TOKEN = process.env.AGENT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!AGENT_TOKEN) {
  throw new Error("AGENT_TOKEN not found in .env file");
}

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not found in .env file");
}

if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY not found in .env file");
}

const HUB_URL = "https://hub.ag3nts.org";
const OPENAI_API_URL = "https://api.openai.com/v1";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

/**
 * Fetch documentation file from hub
 */
export async function fetchDocumentation(path) {
  const url = `${HUB_URL}/dane/doc/${path}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  
  return response;
}

/**
 * Call OpenAI API with text prompt
 */
export async function callOpenAI(messages, model = "gpt-4o") {
  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Analyze image with Gemini Flash via OpenRouter
 */
export async function analyzeImageWithGemini(imageUrl, prompt) {
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/4th-devs",
      "X-Title": "4th-devs SPK Solution"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter/Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Submit declaration to verification endpoint
 */
export async function submitDeclaration(declaration) {
  const response = await fetch(`${HUB_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: AGENT_TOKEN,
      task: "sendit",
      answer: {
        declaration: declaration
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Verification failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export { AGENT_TOKEN, OPENAI_API_KEY, OPENROUTER_API_KEY, HUB_URL };


