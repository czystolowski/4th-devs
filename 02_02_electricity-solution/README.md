# Electricity Puzzle Solution

AI-powered solver for the 3x3 electrical grid puzzle that uses vision models to analyze cable configurations and automatically calculate the rotations needed.

## How It Works

1. **Fetch Grid Image**: Downloads the current puzzle state as a PNG from the hub
2. **Vision Analysis**: Uses GPT-4o vision model to analyze each cell's cable configuration
3. **Calculate Rotations**: Compares current state with target configuration to determine needed rotations
4. **Execute Plan**: Sends rotation commands to the hub API sequentially
5. **Track Progress**: Saves all grid states to workspace with sequential numbering
6. **Verify**: Checks if the puzzle is solved and retrieves the flag

## Key Features

- **Vision-Based Analysis**: Uses AI vision to interpret cable patterns in each grid cell
- **Dynamic Target Learning**: Fetches and analyzes the official solution image (not hardcoded)
- **Smart Rotation Logic**: Calculates minimum rotations needed (0-3 per cell)
- **Session Tracking**: Organizes all images by timestamp with sequential numbering
- **Interactive Feedback**: Shows current state, target state, and rotation plan
- **Complete Audit Trail**: Manifest.json documents every step of the solving process

## Architecture

```
02_02_electricity-solution/
├── app.js                      # Main entry point
├── workspace/                  # Session data (gitignored)
│   ├── README.md              # Workspace documentation
│   └── session-{timestamp}/   # Individual solving attempts
│       ├── 00-target-solution.png
│       ├── 01-initial-state.png
│       ├── 02-rotate-{pos}-1.png
│       ├── ...
│       └── manifest.json
├── src/
│   ├── config.js              # Configuration (hub URL, models)
│   ├── agent.js               # Core logic (analysis, rotation planning)
│   └── helpers/
│       ├── hub.js             # Hub API communication
│       ├── vision.js          # Vision model integration
│       ├── session.js         # Session tracking
│       └── logger.js          # Formatted console output
```

## Target Grid Configuration

The solution aims to create this cable layout:

```
1x1: right,bottom    | 1x2: left,right      | 1x3: left,bottom
2x1: top,bottom      | 2x2: all directions  | 2x3: top,bottom
3x1: top,right (PWR) | 3x2: left,right      | 3x3: top,left (PLANT)
```

This creates a closed circuit connecting the power source (3x1) to all three power plants.

## Usage

```bash
source ~/.nvm/nvm.sh && nvm use 24
cd 02_02_electricity-solution
npm start
```

After running, check `workspace/session-{timestamp}/` for:
- Sequential images showing each step
- `manifest.json` with complete solving history

## Learning Points

### Vision Model Selection
- **Gemini Flash 1.5 8B** works well for this task
- Other models may struggle with precise cable direction identification
- Consider image preprocessing (cropping cells) for better accuracy

### Rotation Logic
- Each rotation is 90° clockwise
- To rotate "left" (counter-clockwise), do 3 right rotations
- Connection directions rotate: top → right → bottom → left → top

### API Efficiency
- One API call per rotation (can't batch)
- Vision analysis is separate from rotation execution
- Consider caching vision results if retrying

### Error Handling
- Vision models may misidentify cable patterns
- Verify results by re-fetching and re-analyzing
- Manual inspection of saved images helps debug issues

## Environment Variables

Requires `AGENT_TOKEN` in `.env` file at project root.

## Dependencies

- Node.js 24+ (for native `.env` support)
- No external npm packages required (uses native fetch, fs/promises)