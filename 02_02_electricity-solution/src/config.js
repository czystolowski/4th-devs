/**
 * Configuration for electricity puzzle task
 */

export const hub = {
  baseUrl: "https://hub.ag3nts.org",
  task: "electricity"
};

export const api = {
  // Use GPT-4o for vision - it's good at analyzing images
  visionModel: "gpt-4o",
  maxOutputTokens: 2000
};

export const grid = {
  rows: 3,
  cols: 3,
  // Grid positions in AxB format (row x col)
  positions: [
    "1x1", "1x2", "1x3",
    "2x1", "2x2", "2x3",
    "3x1", "3x2", "3x3"
  ]
};

