/**
 * Agent logic for solving the electricity puzzle
 */

import { analyzeGridImage, createAnalysisPrompt, parseGridAnalysis } from "./helpers/vision.js";
import { rotateCell, fetchGridImage, imageToDataUrl } from "./helpers/hub.js";
import { saveSessionImage, addSessionStep } from "./helpers/session.js";
import log from "./helpers/logger.js";

/**
 * Target grid will be loaded from the solution image
 */
let TARGET_GRID = null;

/**
 * Calculate how many 90-degree clockwise rotations are needed
 * to transform current connections to target connections
 */
const calculateRotations = (current, target) => {
  // Normalize connection arrays (sort them for comparison)
  const normalize = (dirs) => dirs.sort().join(",");
  
  const currentNorm = normalize(current);
  const targetNorm = normalize(target);
  
  // If already matching, no rotation needed
  if (currentNorm === targetNorm) {
    return 0;
  }
  
  // Try 1, 2, and 3 rotations to see which matches
  let testConnections = [...current];
  
  for (let rotations = 1; rotations <= 3; rotations++) {
    testConnections = rotateConnections(testConnections);
    if (normalize(testConnections) === targetNorm) {
      return rotations;
    }
  }
  
  // If no match found, something is wrong
  return 0;
};

/**
 * Rotate connection directions 90 degrees clockwise
 */
const rotateConnections = (connections) => {
  const rotationMap = {
    "top": "right",
    "right": "bottom",
    "bottom": "left",
    "left": "top"
  };
  
  return connections.map(dir => rotationMap[dir]);
};

/**
 * Load target grid from solution image
 */
export const loadTargetGrid = async (imageDataUrl) => {
  log.start("Analyzing target solution image...");
  
  const prompt = createAnalysisPrompt();
  const analysis = await analyzeGridImage(imageDataUrl, prompt);
  
  console.log("\nTarget Solution Analysis:");
  console.log(analysis);
  console.log("");
  
  const targetGrid = parseGridAnalysis(analysis);
  
  // Convert to simple format
  const target = {};
  for (const [pos, data] of Object.entries(targetGrid)) {
    target[pos] = data.connections;
  }
  
  TARGET_GRID = target;
  
  // Display target grid
  const targetDisplay = {};
  for (const [pos, connections] of Object.entries(target)) {
    targetDisplay[pos] = connections.join(",");
  }
  log.grid("Target Grid Configuration", targetDisplay);
  
  return target;
};

/**
 * Analyze current grid state and calculate needed rotations
 */
export const analyzeAndPlan = async (imageDataUrl) => {
  if (!TARGET_GRID) {
    throw new Error("Target grid not loaded. Call loadTargetGrid first.");
  }
  
  log.start("Analyzing current grid with vision model...");
  
  const prompt = createAnalysisPrompt();
  const analysis = await analyzeGridImage(imageDataUrl, prompt);
  
  console.log("\nCurrent Grid Analysis:");
  console.log(analysis);
  console.log("");
  
  const currentGrid = parseGridAnalysis(analysis);
  
  // Display current grid
  const currentDisplay = {};
  for (const [pos, data] of Object.entries(currentGrid)) {
    currentDisplay[pos] = data.connections.join(",");
  }
  log.grid("Current Grid State", currentDisplay);
  
  // Calculate rotations needed for each cell
  const rotationPlan = {};
  
  for (const position of Object.keys(TARGET_GRID)) {
    const current = currentGrid[position]?.connections || [];
    const target = TARGET_GRID[position];
    const rotations = calculateRotations(current, target);
    
    if (rotations > 0) {
      rotationPlan[position] = rotations;
    }
  }
  
  return { currentGrid, rotationPlan };
};

/**
 * Execute rotation plan by sending commands to hub
 */
export const executeRotations = async (apiKey, rotationPlan, session) => {
  const positions = Object.keys(rotationPlan);
  
  if (positions.length === 0) {
    log.success("Grid already matches target - no rotations needed!");
    return { success: true };
  }
  
  log.info(`Need to rotate ${positions.length} cells`);
  console.log("");
  
  for (const position of positions) {
    const rotations = rotationPlan[position];
    
    // Execute each rotation one at a time
    for (let i = 0; i < rotations; i++) {
      log.rotation(position, `${i + 1}/${rotations}`);
      
      const response = await rotateCell(apiKey, position);
      
      // Save grid state after rotation if session tracking is enabled
      if (session) {
        const gridImage = await fetchGridImage(apiKey);
        const { filename } = await saveSessionImage(
          session,
          gridImage,
          `rotate-${position}-${i + 1}`
        );
        
        addSessionStep(session, {
          action: "rotate",
          position,
          rotation: i + 1,
          totalRotations: rotations,
          image: filename
        });
        
        log.info(`Saved: ${filename}`);
      }
      
      // Check if we got the flag
      if (response.message?.includes("FLG:") || response.flag) {
        const flag = response.flag || response.message;
        return { success: true, flag };
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return { success: true };
};

/**
 * Display the target grid for reference
 */
export const showTargetGrid = () => {
  if (!TARGET_GRID) {
    log.warning("Target grid not yet loaded");
    return;
  }
  
  const targetDisplay = {};
  for (const [pos, connections] of Object.entries(TARGET_GRID)) {
    targetDisplay[pos] = connections.join(",");
  }
  log.grid("Target Grid Configuration", targetDisplay);
};

