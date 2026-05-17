# Drone Control Solution - FLAG: {FLG:LETSFLY}

Solution for the "drone" task - bombing the dam to provide water for power plant cooling.

## Task Overview

Control a drone to bomb a dam (not the power plant) to restore water flow for cooling systems. The challenge involves:
1. Analyzing a map with vision AI to locate the dam
2. Understanding complex drone API documentation
3. Building correct instruction sequence through iterative feedback

## Solution Strategy

### Phase 1: Vision Analysis
- Used **gpt-5.4** (better for precise grid counting than gpt-4o)
- Analyzed map to identify:
  - Grid size: 3 columns × 4 rows
  - Dam location: Column 2, Row 4
  - Dam marked with intensified blue/cyan color

### Phase 2: API Understanding
- Fetched HTML documentation from hub
- Identified required instructions through trial and error
- API uses overloaded `set()` function with different parameters

### Phase 3: Iterative Refinement
Built instruction sequence through feedback:

1. **Attempt 1**: Wrong instruction names → Read documentation
2. **Attempt 2**: Wrong coordinates (3,3) → Re-analyzed with better prompt
3. **Attempt 3**: Wrong coordinates (2,3) → Used gpt-5.4 for better counting
4. **Attempt 4**: Missing height → Added `set(50m)`
5. **Attempt 5**: Engines off → Added `set(engineON)` and `set(100%)`
6. **Attempt 6**: No return instruction → Added `set(return)`
7. **SUCCESS**: Got FLAG!

## Final Instruction Sequence

```javascript
[
  "set(engineON)",                    // Turn on engines
  "set(100%)",                        // Set engine power to 100%
  "setDestinationObject(PWR6132PL)",  // Official target: power plant
  "set(2,4)",                         // Actual target: dam at column 2, row 4
  "set(50m)",                         // Flight height: 50m to clear trees
  "set(destroy)",                     // Mission: destroy target
  "set(return)",                      // Return to base after mission
  "flyToLocation"                     // Execute mission
]
```

## Key Learnings

### 1. Vision Model Selection Matters
- **gpt-4o**: Counted grid as 5×3, then 4×3 (incorrect)
- **gpt-5.4**: Correctly counted 3×4 grid
- Lesson: Use latest/best models for precision tasks

### 2. Persistence Optimization
- Cached dam location to avoid repeated vision API calls
- Only re-analyze if feedback indicates wrong coordinates
- Saved ~$0.50 in API costs through caching

### 3. Iterative Refinement Works
- Don't try to be perfect on first attempt
- API error messages guide the solution
- Each error reveals one missing piece

### 4. Documentation Can Be Misleading
- Multiple functions with same name (`set()`)
- System disambiguates based on parameters
- Focus on what's needed, ignore noise

### 5. Order Matters
- Engines must be on before setting power
- Configuration before execution
- Mission goals can be in any order (AI handles sequencing)

## Project Structure

```
02_05_drone-solution/
├── app.js                      # Main orchestration
├── package.json                # Node.js config
├── LESSONS_LEARNED.md          # Compressed knowledge from previous tasks
├── src/
│   ├── config.js               # Task configuration
│   ├── helpers/
│   │   ├── vision.js           # Vision API for map analysis
│   │   ├── hub.js              # Hub API client
│   │   ├── persistence.js      # Dam location caching
│   │   └── logger.js           # Logging utilities
└── workspace/
    ├── dam-location.json       # Cached dam coordinates
    └── drone-api-doc.html      # Saved API documentation
```

## Running the Solution

```bash
cd 02_05_drone-solution
node app.js
```

## Environment Variables

Required in `.env`:
- `AGENT_TOKEN` - Hub API key
- `OPENAI_API_KEY` or `OPENROUTER_API_KEY` - For vision and text models

## Cost Analysis

- Vision API calls: ~$0.30 (2 attempts with gpt-5.4)
- Text API calls: ~$0.05 (minimal, used gpt-4o-mini)
- Total: ~$0.35

Caching saved additional vision calls after finding correct coordinates.

## Success Metrics

✅ Dam located correctly (Column 2, Row 4)
✅ All required instructions identified
✅ Proper sequencing and configuration
✅ FLAG obtained: {FLG:LETSFLY}
✅ Mission accomplished in 6 iterations