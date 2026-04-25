# 02_01_categorize-solution

Agentic solution for the cargo categorization challenge. Uses an LLM as a "prompt engineer" to iteratively design and optimize classification prompts within strict constraints.

## Challenge Overview

Classify 10 cargo items as either dangerous (DNG) or neutral (NEU) using a prompt-based system with:
- **100 token limit** per prompt (including item data)
- **1.5 PP budget** for all 10 classifications
- **Prompt caching** required for cost efficiency
- **Special requirement**: Reactor-related items must always be classified as neutral (to avoid inspection)

## How It Works

The solution uses an **agentic approach** where an LLM acts as a prompt engineer:

1. **Generate**: Creates an initial classification prompt optimized for:
   - Token efficiency (under 100 tokens)
   - Cache-friendly structure (static rules first, variable data last)
   - Reactor exception handling
   - English language for token efficiency

2. **Test**: Sends the prompt to the hub for all 10 items, tracking:
   - Classification accuracy
   - Budget consumption
   - Token usage and caching

3. **Improve**: If the test fails, analyzes feedback and generates an improved prompt

4. **Iterate**: Repeats until success or max attempts reached

## Key Techniques

### Prompt Caching Strategy
The prompt is structured to maximize cache hits:
```
[Static classification rules - cached across requests]
[Variable data at end: ID {id}, Description: {description}]
```

This ensures the expensive classification logic is cached, and only the small variable portion (item ID and description) changes between requests.

### Budget Management
Tracks costs in real-time:
- Input tokens: 0.02 PP per 10 tokens
- Cached tokens: 0.01 PP per 10 tokens (50% savings)
- Output tokens: 0.02 PP per 10 tokens

### Reactor Exception
The prompt explicitly handles reactor-related items:
- Keywords: reactor, fuel rod, uranium, plutonium, radioactive, nuclear, fission, enriched
- These items are always classified as NEU regardless of danger level

## Run

```bash
npm run start
```

Or with auto-reload:
```bash
npm run dev
```

## Required Setup

1. Copy `env.example` to `.env` in the repo root
2. Set your API keys:
   - `AIDEVS_API_KEY` - Your AI_devs hub API key
   - `OPENAI_API_KEY` or `OPENROUTER_API_KEY` - For the prompt engineer LLM

## Project Structure

```
02_01_categorize-solution/
├── app.js                    # Main entry point
├── package.json              # Dependencies and scripts
├── src/
│   ├── agent.js             # Prompt engineer agent logic
│   ├── config.js            # Configuration and constraints
│   └── helpers/
│       ├── api.js           # Responses API wrapper
│       ├── hub.js           # Hub communication and utilities
│       └── logger.js        # Colored terminal output
```

## Example Output

```
┌────────────────────────────────────────┐
│ Categorize Solution                    │
│ Agentic Prompt Optimization            │
└────────────────────────────────────────┘

[21:00:00] → Fetching CSV data from hub...
[21:00:01] ✓ Loaded 10 items to classify

Items to classify:
  01: Uranium fuel rods for reactor
  02: Industrial explosives
  03: Office furniture
  ...

╔══════════════════════════════════════╗
║ ATTEMPT 1                            ║
╚══════════════════════════════════════╝

Testing prompt:
"Classify: DNG=weapons/explosives/toxic, NEU=food/tools/reactor items. Item {id}: {description}. Answer: DNG or NEU"

[21:00:02] Prompt (45 tokens): Classify: DNG=weapons...
[21:00:03] ✓ 01: NEU (Uranium fuel rods for reactor)
[21:00:03] ✓ 02: DNG (Industrial explosives)
...
[21:00:10] Budget: 1.35 / 1.5 PP (90.0%)

╔══════════════════════════════════════╗
║ FLAG                                 ║
╚══════════════════════════════════════╝
{FLG:...}

✓ Task completed successfully!
  Attempts: 1
  Final cost: 1.35 PP
```

## Notes

- The CSV file changes every few minutes - always fetches fresh data
- Uses Claude Sonnet 4.6 as the prompt engineer (powerful reasoning)
- The hub uses a small model (gpt-5.2-mini) for actual classification
- Automatically resets the hub counter between attempts
- Maximum 10 attempts before giving up