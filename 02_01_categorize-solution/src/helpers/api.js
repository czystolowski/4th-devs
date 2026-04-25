import { AI_API_KEY, RESPONSES_API_ENDPOINT, EXTRA_API_HEADERS } from "../../../config.js";
import { api } from "../config.js";

/**
 * Call the Responses API with reasoning support.
 */
export const chat = async ({ 
  model = api.engineerModel, 
  input, 
  instructions,
  maxOutputTokens = api.maxOutputTokens,
  reasoning = api.reasoning
}) => {
  const body = { model, input };

  if (instructions) body.instructions = instructions;
  if (maxOutputTokens) body.max_output_tokens = maxOutputTokens;
  if (reasoning) body.reasoning = reasoning;

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data;
};

/**
 * Extracts text content from response.
 */
export const extractText = (response) => {
  const message = response.output.find((item) => item.type === "message");
  return message?.content?.[0]?.text ?? null;
};

/**
 * Extracts reasoning summaries from response output.
 */
export const extractReasoning = (response) =>
  response.output
    .filter((item) => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .map((s) => s.text)
    .filter(Boolean);
