import { resolveModelForProvider } from '../../../config.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || (OPENAI_API_KEY ? 'openai' : 'openrouter');

const API_URL = AI_PROVIDER === 'openai' 
  ? 'https://api.openai.com/v1/chat/completions'
  : 'https://openrouter.ai/api/v1/chat/completions';

const API_KEY = AI_PROVIDER === 'openai' ? OPENAI_API_KEY : OPENROUTER_API_KEY;

export async function chat(messages, model = 'gpt-4o', tools = null, tool_choice = null, maxTokens = 4096) {
  const resolvedModel = resolveModelForProvider(model);
  
  const body = {
    model: resolvedModel,
    messages,
    max_tokens: maxTokens,
  };

  if (tools) {
    body.tools = tools;
    if (tool_choice) {
      body.tool_choice = tool_choice;
    }
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  return response.json();
}

export function extractToolCalls(response) {
  const message = response.choices[0].message;
  return message.tool_calls || [];
}

export function extractContent(response) {
  return response.choices[0].message.content;
}


