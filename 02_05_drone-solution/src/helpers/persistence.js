/**
 * Persistence helper for caching dam location
 */

import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const WORKSPACE_DIR = join(process.cwd(), "workspace");
const DAM_LOCATION_FILE = join(WORKSPACE_DIR, "dam-location.json");

/**
 * Ensure workspace directory exists
 */
export const ensureWorkspace = async () => {
  if (!existsSync(WORKSPACE_DIR)) {
    await mkdir(WORKSPACE_DIR, { recursive: true });
  }
};

/**
 * Save dam location to file
 */
export const saveDamLocation = async (location) => {
  await ensureWorkspace();
  await writeFile(
    DAM_LOCATION_FILE,
    JSON.stringify(location, null, 2),
    "utf-8"
  );
};

/**
 * Load dam location from file
 */
export const loadDamLocation = async () => {
  try {
    if (!existsSync(DAM_LOCATION_FILE)) {
      return null;
    }
    
    const content = await readFile(DAM_LOCATION_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

/**
 * Check if we should re-analyze based on feedback
 */
export const shouldReanalyze = (feedback) => {
  if (!feedback) return false;
  
  const reanalyzeKeywords = [
    "wrong coordinates",
    "incorrect location",
    "invalid sector",
    "out of bounds",
    "wrong sector",
    "incorrect sector",
    "wrong position"
  ];
  
  const feedbackLower = feedback.toLowerCase();
  return reanalyzeKeywords.some(keyword => feedbackLower.includes(keyword));
};

