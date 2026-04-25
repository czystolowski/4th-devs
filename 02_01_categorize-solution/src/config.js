import { resolveModelForProvider } from "../../config.js";

export const api = {
  // Use a powerful model for the prompt engineer agent
  engineerModel: resolveModelForProvider("anthropic/claude-sonnet-4-6"),
  // The hub uses a small model for classification
  hubModel: "gpt-5.2-mini",
  maxOutputTokens: 4096,
  reasoning: { effort: "medium", summary: "auto" }
};

export const hub = {
  baseUrl: "https://hub.ag3nts.org",
  task: "categorize"
};

export const budget = {
  // Total budget: 1.5 PP for 10 items
  total: 1.5,
  // Cost per 10 tokens
  inputCost: 0.02,
  cachedCost: 0.01,
  outputCost: 0.02
};

export const constraints = {
  maxPromptTokens: 100,
  itemsToClassify: 10
};
