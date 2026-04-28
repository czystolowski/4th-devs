/**
 * Session management for organizing grid images by solving attempt
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Create a new session directory with timestamp
 */
export const createSession = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionDir = join(process.cwd(), "workspace", `session-${timestamp}`);
  
  await mkdir(sessionDir, { recursive: true });
  
  return {
    dir: sessionDir,
    timestamp,
    stepCounter: 0
  };
};

/**
 * Save an image to the session directory with sequential numbering
 */
export const saveSessionImage = async (session, imageBuffer, label) => {
  const step = String(session.stepCounter).padStart(2, "0");
  const filename = `${step}-${label}.png`;
  const filepath = join(session.dir, filename);
  
  await writeFile(filepath, imageBuffer);
  session.stepCounter++;
  
  return { filepath, step, filename };
};

/**
 * Create a session manifest file documenting the solving process
 */
export const createSessionManifest = async (session, data) => {
  const manifestPath = join(session.dir, "manifest.json");
  const manifest = {
    timestamp: session.timestamp,
    steps: data.steps || [],
    rotations: data.rotations || [],
    success: data.success || false,
    flag: data.flag || null
  };
  
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
};

/**
 * Add a step to the session tracking
 */
export const addSessionStep = (session, stepData) => {
  if (!session.steps) {
    session.steps = [];
  }
  
  session.steps.push({
    step: session.stepCounter - 1,
    ...stepData
  });
};

