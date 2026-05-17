/**
 * Vision Agent Tools
 * Tools for analyzing drone map images and locating features
 */

import { createToolDefinition, toolRegistry } from "../core/tools.js";
import { AI_API_KEY, CHAT_API_BASE_URL, EXTRA_API_HEADERS, resolveModelForProvider, AGENT_TOKEN } from "../../../config.js";
import { api, hub } from "../config.js";
import log from "../helpers/logger.js";

/**
 * Analyze drone map image with vision model
 */
async function analyzeMap(args, context) {
  const { prompt, focus } = args;
  
  // Get map URL
  const mapUrl = `${hub.baseUrl}/data/${AGENT_TOKEN}/drone.png`;
  
  const fullPrompt = prompt || `Analyze this drone map image with EXTREME PRECISION.
${focus ? `Focus on: ${focus}` : ''}

The map shows a grid of sectors. Provide detailed analysis of:
1. Grid dimensions (count vertical and horizontal lines carefully)
2. Notable features and their locations
3. Color intensities and patterns
4. Any distinctive markers or areas

Return your analysis in a structured format.`;

  const response = await fetch(`${CHAT_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: resolveModelForProvider(api.visionModel),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: fullPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: mapUrl
              }
            }
          ]
        }
      ],
      max_tokens: api.maxOutputTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const analysis = data.choices[0].message.content;
  
  log.info("Map analysis completed");
  
  return {
    success: true,
    analysis,
    mapUrl
  };
}

/**
 * Locate specific feature (like dam) by color intensity
 */
async function locateFeature(args, context) {
  const { feature = "dam", colorDescription = "intensified blue/cyan water" } = args;
  
  const mapUrl = `${hub.baseUrl}/data/${AGENT_TOKEN}/drone.png`;
  
  const prompt = `Analyze this drone map image with EXTREME PRECISION to locate the ${feature}.

CRITICAL INSTRUCTIONS:
1. First, count the VERTICAL LINES that divide the map into columns
   - Number of columns = number of vertical lines + 1
   - Count from LEFT to RIGHT
   
2. Then, count the HORIZONTAL LINES that divide the map into rows
   - Number of rows = number of horizontal lines + 1
   - Count from TOP to BOTTOM

3. Locate the ${feature.toUpperCase()} - it has ${colorDescription}
   - Look for the brightest/most saturated area matching this description
   - The feature is specifically marked with enhanced color intensity

4. Identify the EXACT sector containing the ${feature}:
   - Column number: count from LEFT starting at 1
   - Row number: count from TOP starting at 1
   - The top-left corner is sector (1,1)

VERIFICATION STEPS:
- Count grid lines multiple times to be absolutely sure
- Verify the ${feature} location by its distinctive color
- Double-check that your column and row numbers are within the grid bounds

Return ONLY a JSON object in this exact format:
{
  "grid_columns": <number>,
  "grid_rows": <number>,
  "${feature}_column": <number>,
  "${feature}_row": <number>,
  "confidence": "<high|medium|low>",
  "notes": "<describe the ${feature} location and what makes it distinctive>"
}`;

  const response = await fetch(`${CHAT_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: resolveModelForProvider(api.visionModel),
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
                url: mapUrl
              }
            }
          ]
        }
      ],
      max_tokens: api.maxOutputTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const result = data.choices[0].message.content;
  
  // Try to parse JSON from response
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      log.info(`Located ${feature} at column ${parsed[`${feature}_column`]}, row ${parsed[`${feature}_row`]}`);
      return {
        success: true,
        ...parsed
      };
    }
  } catch (e) {
    log.warning("Failed to parse vision response as JSON");
    return {
      success: false,
      raw: result,
      parseError: true
    };
  }
  
  return {
    success: false,
    raw: result,
    parseError: false
  };
}

/**
 * Count grid dimensions precisely
 */
async function countGrid(args, context) {
  const mapUrl = `${hub.baseUrl}/data/${AGENT_TOKEN}/drone.png`;
  
  const prompt = `Count the grid dimensions of this map with EXTREME PRECISION.

COUNTING METHOD:
1. Count VERTICAL LINES (the lines that go up and down):
   - These divide the map into columns
   - Number of columns = number of vertical lines + 1
   - Count from left to right
   - Count each line only once

2. Count HORIZONTAL LINES (the lines that go left to right):
   - These divide the map into rows
   - Number of rows = number of horizontal lines + 1
   - Count from top to bottom
   - Count each line only once

VERIFICATION:
- Count multiple times to ensure accuracy
- The grid should be rectangular
- All lines should be clearly visible

Return ONLY a JSON object:
{
  "vertical_lines": <number>,
  "horizontal_lines": <number>,
  "columns": <number>,
  "rows": <number>,
  "confidence": "<high|medium|low>",
  "verification_notes": "<explain your counting process>"
}`;

  const response = await fetch(`${CHAT_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: resolveModelForProvider(api.visionModel),
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
                url: mapUrl
              }
            }
          ]
        }
      ],
      max_tokens: api.maxOutputTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const result = data.choices[0].message.content;
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      log.info(`Grid counted: ${parsed.columns} columns x ${parsed.rows} rows`);
      return {
        success: true,
        ...parsed
      };
    }
  } catch (e) {
    log.warning("Failed to parse grid count response");
    return {
      success: false,
      raw: result,
      parseError: true
    };
  }
  
  return {
    success: false,
    raw: result
  };
}

/**
 * Verify location coordinates
 */
async function verifyLocation(args, context) {
  const { column, row, feature = "target" } = args;
  
  const mapUrl = `${hub.baseUrl}/data/${AGENT_TOKEN}/drone.png`;
  
  const prompt = `Verify the location of ${feature} at column ${column}, row ${row}.

VERIFICATION TASK:
1. Count the grid to determine total columns and rows
2. Locate the sector at column ${column}, row ${row}
   - Column ${column} means the ${column}th column from the LEFT
   - Row ${row} means the ${row}th row from the TOP
3. Describe what you see in that specific sector
4. Confirm if this matches the expected ${feature} characteristics

Return ONLY a JSON object:
{
  "verified": <true|false>,
  "grid_columns": <number>,
  "grid_rows": <number>,
  "sector_description": "<what you see at column ${column}, row ${row}>",
  "confidence": "<high|medium|low>",
  "notes": "<any discrepancies or confirmations>"
}`;

  const response = await fetch(`${CHAT_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: resolveModelForProvider(api.visionModel),
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
                url: mapUrl
              }
            }
          ]
        }
      ],
      max_tokens: api.maxOutputTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const result = data.choices[0].message.content;
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      log.info(`Location verification: ${parsed.verified ? 'CONFIRMED' : 'FAILED'}`);
      return {
        success: true,
        ...parsed
      };
    }
  } catch (e) {
    log.warning("Failed to parse verification response");
    return {
      success: false,
      raw: result,
      parseError: true
    };
  }
  
  return {
    success: false,
    raw: result
  };
}

// Tool definitions
const tools = [
  {
    definition: createToolDefinition(
      "analyze_map",
      "Analyze the drone map image using vision model. Returns detailed analysis of grid, features, and patterns.",
      {
        properties: {
          prompt: {
            type: "string",
            description: "Custom analysis prompt (optional, uses default if not provided)"
          },
          focus: {
            type: "string",
            description: "Specific aspect to focus on (e.g., 'grid dimensions', 'water features')"
          }
        },
        required: []
      }
    ),
    executor: analyzeMap
  },
  {
    definition: createToolDefinition(
      "locate_feature",
      "Locate a specific feature (like dam) on the map by color intensity. Returns precise grid coordinates.",
      {
        properties: {
          feature: {
            type: "string",
            description: "Feature to locate (default: 'dam')"
          },
          colorDescription: {
            type: "string",
            description: "Color characteristics to look for (default: 'intensified blue/cyan water')"
          }
        },
        required: []
      }
    ),
    executor: locateFeature
  },
  {
    definition: createToolDefinition(
      "count_grid",
      "Count grid dimensions precisely by counting vertical and horizontal lines. Returns columns and rows.",
      {
        properties: {},
        required: []
      }
    ),
    executor: countGrid
  },
  {
    definition: createToolDefinition(
      "verify_location",
      "Double-check coordinates by verifying what's at a specific grid location.",
      {
        properties: {
          column: {
            type: "number",
            description: "Column number to verify (1-based, from left)"
          },
          row: {
            type: "number",
            description: "Row number to verify (1-based, from top)"
          },
          feature: {
            type: "string",
            description: "Expected feature at this location (default: 'target')"
          }
        },
        required: ["column", "row"]
      }
    ),
    executor: verifyLocation
  }
];

// Register all tools for vision agent
toolRegistry.registerTools("vision", tools);

log.info("Vision agent tools registered");

export { analyzeMap, locateFeature, countGrid, verifyLocation };

// Made with Bob