# Firmware Debugging Solution - S03E02

## Task Overview

Debug and run the ECCS (Emergency Core Cooling System) firmware on a virtual machine to obtain a confirmation code.

## Objectives

1. Execute `/opt/firmware/cooler/cooler.bin`
2. Find the password required to run the binary
3. Configure `settings.ini` properly
4. Extract the ECCS code (format: `ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
5. Submit the code to the hub

## Security Constraints

- Cannot access `/etc`, `/root`, or `/proc` directories
- Must respect `.gitignore` files
- Violations result in temporary API ban and VM reset

## Implementation

The solution uses an agentic approach with Claude Sonnet 4:

- **Agent**: Autonomous reasoning and decision-making
- **Tools**: 
  - `execute_shell`: Run commands on the VM
  - `submit_code`: Submit the ECCS code
- **Strategy**: Iterative exploration and problem-solving

## Usage

```bash
npm start
```

## Architecture

- `app.js` - Entry point
- `src/agent.js` - Main agent loop with function calling
- `src/helpers/api.js` - LLM API wrapper
- `src/helpers/shell.js` - Shell API client with error handling

## Key Features

- Automatic error handling for rate limits and bans
- Iterative problem-solving approach
- Security-aware (respects blacklisted directories)
- Uses Claude Sonnet 4 for superior reasoning