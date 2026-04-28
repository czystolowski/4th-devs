/**
 * Hub API communication helpers
 */

import { hub } from "../config.js";
import { writeFile } from "fs/promises";
import { join } from "path";

/**
 * Fetch the current grid image from hub
 */
export const fetchGridImage = async (apiKey, reset = false) => {
  const url = `${hub.baseUrl}/data/${apiKey}/${hub.task}.png${reset ? "?reset=1" : ""}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
};

/**
 * Save image to local file for inspection
 */
export const saveImage = async (imageBuffer, filename = "current-grid.png") => {
  const filepath = join(process.cwd(), filename);
  await writeFile(filepath, imageBuffer);
  return filepath;
};

/**
 * Convert image buffer to base64 data URL for vision API
 */
export const imageToDataUrl = (imageBuffer) => {
  const base64 = imageBuffer.toString("base64");
  return `data:image/png;base64,${base64}`;
};

/**
 * Send rotation command to hub
 */
export const rotateCell = async (apiKey, position) => {
  const url = `${hub.baseUrl}/verify`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: hub.task,
      answer: {
        rotate: position
      }
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `Hub error: ${response.status}`);
  }
  
  return data;
};

/**
 * Reset the grid to initial state
 */
export const resetGrid = async (apiKey) => {
  return fetchGridImage(apiKey, true);
};

/**
 * Fetch the solution/target image
 */
export const fetchSolutionImage = async () => {
  const url = "https://hub.ag3nts.org/i/solved_electricity.png";
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch solution image: ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
};

