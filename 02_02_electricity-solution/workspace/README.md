# Workspace Directory

This directory stores session data from puzzle-solving attempts. Each session is organized in its own timestamped directory.

## Session Structure

Each session directory follows this naming pattern:
```
session-YYYY-MM-DDTHH-MM-SS-mmmZ/
```

## Files in Each Session

### Images (Sequential Order)
- `00-target-solution.png` - The official solution image from the hub
- `01-initial-state.png` - Starting grid configuration
- `02-rotate-{position}-1.png` - Grid after first rotation of a cell
- `03-rotate-{position}-2.png` - Grid after second rotation (if needed)
- ... (continues for each rotation)
- `XX-final-solved.png` - Final state when puzzle is solved
- `XX-verify-state.png` - Verification state (if needed)

### Manifest
- `manifest.json` - Complete record of the solving process

## Manifest Format

```json
{
  "timestamp": "2024-01-15T10-30-45-123Z",
  "steps": [
    {
      "step": 0,
      "action": "load_target",
      "image": "00-target-solution.png"
    },
    {
      "step": 1,
      "action": "initial_state",
      "image": "01-initial-state.png"
    },
    {
      "step": 2,
      "action": "rotate",
      "position": "2x3",
      "rotation": 1,
      "totalRotations": 2,
      "image": "02-rotate-2x3-1.png"
    }
  ],
  "rotations": [
    { "position": "2x3", "count": 2 },
    { "position": "1x2", "count": 1 }
  ],
  "success": true,
  "flag": "FLG:..."
}
```

## Usage

Sessions are automatically created when running the solver. To review a session:

1. Navigate to the session directory
2. View images in sequential order (00, 01, 02, ...)
3. Check `manifest.json` for detailed step information

## Cleanup

Old sessions can be safely deleted. The `.gitignore` prevents them from being committed to version control.