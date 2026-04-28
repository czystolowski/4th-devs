# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Context

AI_devs 4th edition training course - collection of 24+ lessons demonstrating AI agent patterns, each in separate directories.

## Critical Non-Obvious Patterns

### Config System
- **MUST import from root `config.js`** for API keys/endpoints, NOT from lesson-specific configs
- Root config.js handles provider resolution (OpenAI vs OpenRouter) and model name normalization
- Use `resolveModelForProvider(model)` to auto-prefix OpenRouter models with `openai/`
- Root config loads `.env` from project root automatically (Node 24+ uses native `process.loadEnvFile`)

### Running Lessons
- **MUST run from lesson directory**: `cd lesson_dir && node app.js` (NOT from root)
- Some lessons require pre-scripts: check `package.json` for `prelessonX:*` scripts
- TypeScript lessons use `npx tsx` or `bun`, NOT `node`
- MCP lessons require `npm run ensure:files-mcp` first

### API Helpers Pattern
- Each lesson has `src/helpers/api.js` that wraps root config
- Standard exports: `chat()`, `extractText()`, `extractToolCalls()`, `extractReasoning()`
- `chat()` function signature varies by lesson - check local implementation
- Responses API uses `output` array, NOT `choices` like Chat Completions

### MCP Integration
- MCP servers run as stdio subprocesses (NOT HTTP)
- `mcp.json` in lesson root defines server configs
- MCP client in `src/mcp/client.js` or similar
- File operations MUST use MCP filesystem server, NOT Node.js fs directly (when MCP is available)

### Module Structure Variations
- JavaScript lessons: `app.js` entry, ES modules (`type: "module"`)
- TypeScript lessons: `src/index.ts` entry, use `tsx` or `bun`
- Some use REPL pattern (`src/repl.js`) for interactive sessions
- Workspace directories (`workspace/`) are sandboxed for file operations

### Budget Tracking
- Lessons with budget constraints track tokens in real-time
- Cost calculation: `(tokens / 10) * cost_per_10_tokens`
- Cached tokens cost less (check `cachedCost` in config)
- Budget exceeded = immediate failure, NOT warning

### Testing & Demos
- No standard test framework - each lesson is self-contained
- `demo/` directories contain example outputs, NOT test suites
- Run demos with lesson-specific scripts in root `package.json`

## Environment Requirements

- Node.js 24+ (enforced by root config.js)
- **Setup**: Use nvm to switch to Node 24: `source ~/.nvm/nvm.sh && nvm use 24`
- `.env` file in project root with `OPENROUTER_API_KEY` or `OPENAI_API_KEY`
- `AI_PROVIDER` env var determines which API to use (defaults to OpenAI if key present)
- `AGENT_TOKEN` required for hub.ag3nts.org submissions

## Non-Standard Conventions

- Lessons are numbered `XX_YY_name` format (e.g., `02_01_categorize-solution`)
- `-solution` suffix indicates completed solution, NOT starter code
- Some lessons use Bun instead of Node (check `package.json` scripts)
- Graph lessons (02_03) require Neo4j running locally
- Gmail lessons (03_04) require OAuth setup via `bun src/auth.ts`

## Token Optimization Tactics (Always Apply)

### Prompt Caching Strategy
- **Static content FIRST, variable data LAST** - enables prompt caching
- Example: `"Rules: DNG=weapons. NEU=food. {code}: {description}"` (rules cached, data varies)
- Cached tokens cost ~50% less (check `cachedCost` in lesson config)
- Responses API automatically caches static prefix on repeated calls

### Minimize Token Usage
- Use rule-based logic when possible (no LLM call needed)
- Batch operations when API supports it
- Check token count BEFORE API call to avoid wasted budget
- Use smaller models for simple tasks (gpt-4o-mini vs gpt-4o)

### Budget-First Development
- Calculate cost BEFORE making API calls: `(tokens / 10) * cost_per_10_tokens`
- Track cumulative cost across iterations
- Fail fast if budget exceeded (don't continue processing)
- Separate cached vs non-cached token costs in calculations

### Chunking Optimization
- Use overlap (typically 200 chars) to maintain context between chunks
- Recursive splitting: headers → paragraphs → sentences → words
- Track dropped/trimmed overlaps to optimize chunk boundaries