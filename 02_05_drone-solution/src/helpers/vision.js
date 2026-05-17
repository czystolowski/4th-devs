/**
 * Vision API helper for analyzing drone map
 */

import { AI_API_KEY, CHAT_API_BASE_URL, EXTRA_API_HEADERS, resolveModelForProvider } from "../../../config.js";
import { api } from "../config.js";

/**
 * Analyze image with vision model
 */
export const analyzeImage = async (imageUrl, prompt) => {
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
                url: imageUrl
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
  return data.choices[0].message.content;
};

/**
 * Locate dam on drone map
 */
export const locateDam = async (mapUrl) => {
  const prompt = `Analyze this drone map image with EXTREME PRECISION. The map shows a grid of sectors.

CRITICAL INSTRUCTIONS:
1. First, count the VERTICAL LINES that divide the map into columns
   - Number of columns = number of vertical lines + 1
   - Count from LEFT to RIGHT
   
2. Then, count the HORIZONTAL LINES that divide the map into rows
   - Number of rows = number of horizontal lines + 1
   - Count from TOP to BOTTOM

3. Locate the DAM - it has INTENSIFIED BLUE/CYAN water color (brighter than other water)
   - The dam is specifically marked with enhanced color intensity
   - Look for the brightest/most saturated blue area

4. Identify the EXACT sector containing the dam:
   - Column number: count from LEFT starting at 1
   - Row number: count from TOP starting at 1
   - The top-left corner is sector (1,1)

VERIFICATION STEPS:
- Count grid lines multiple times to be absolutely sure
- Verify the dam location by its distinctive bright blue color
- Double-check that your column and row numbers are within the grid bounds

Return ONLY a JSON object in this exact format:
{
  "grid_columns": <number>,
  "grid_rows": <number>,
  "dam_column": <number>,
  "dam_row": <number>,
  "confidence": "<high|medium|low>",
  "notes": "<describe the dam location and what makes it distinctive>"
}`;

  const result = await analyzeImage(mapUrl, prompt);
  
  // Try to parse JSON from response
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse vision response:", e);
  }
  
  return { raw: result };
};

// Made with Bob
