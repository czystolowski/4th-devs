/**
 * Vision API helpers for analyzing grid images
 */

import { AI_API_KEY, CHAT_API_BASE_URL, EXTRA_API_HEADERS } from "../../../config.js";
import { api } from "../config.js";

/**
 * Analyze grid image using vision model
 * Returns description of each cell's cable configuration
 */
export const analyzeGridImage = async (imageDataUrl, prompt) => {
  const chatCompletionsEndpoint = `${CHAT_API_BASE_URL}/chat/completions`;
  
  const response = await fetch(chatCompletionsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: api.visionModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      max_tokens: api.maxOutputTokens
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.choices[0].message.content;
};

/**
 * Create a detailed prompt for analyzing the grid
 */
export const createAnalysisPrompt = () => {
  return `Analyze this 3x3 electrical grid puzzle image. Each cell contains cable segments that can connect in different directions (top, right, bottom, left).

Your task: Describe EACH of the 9 cells in the grid, identifying which directions the cables connect.

Grid positions are labeled:
1x1 | 1x2 | 1x3
----|-----|----
2x1 | 2x2 | 2x3
----|-----|----
3x1 | 3x2 | 3x3

For EACH cell, describe the cable pattern using this format:
- Position: [position like "1x1"]
- Connections: [list directions: top, right, bottom, left]
- Type: [straight, corner, T-junction, cross, or special like "power source" or "power plant"]

IMPORTANT:
- Be precise about which directions cables connect
- The bottom-left cell (3x1) is the POWER SOURCE
- Power plants are marked with "PWR" labels
- Describe ALL 9 cells systematically from top-left to bottom-right

Return your analysis in a clear, structured format for each cell.`;
};

/**
 * Parse the vision model's response into structured grid data
 */
export const parseGridAnalysis = (analysisText) => {
  const grid = {};
  
  // Extract cell descriptions using regex
  const cellPattern = /Position:\s*(\d+x\d+)[\s\S]*?Connections:\s*([^\n]+)[\s\S]*?Type:\s*([^\n]+)/gi;
  
  let match;
  while ((match = cellPattern.exec(analysisText)) !== null) {
    const position = match[1];
    const connections = match[2].toLowerCase();
    const type = match[3].toLowerCase();
    
    // Parse connections into array
    const dirs = [];
    if (connections.includes("top") || connections.includes("up")) dirs.push("top");
    if (connections.includes("right")) dirs.push("right");
    if (connections.includes("bottom") || connections.includes("down")) dirs.push("bottom");
    if (connections.includes("left")) dirs.push("left");
    
    grid[position] = {
      connections: dirs,
      type: type.trim()
    };
  }
  
  return grid;
};

