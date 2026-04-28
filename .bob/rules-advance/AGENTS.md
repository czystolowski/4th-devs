# Advance Mode Rules (Non-Obvious Only)

> **Note:** For token optimization tactics (caching, budgets, chunking), see main AGENTS.md in project root.

## Critical Coding Patterns

### Import Resolution
- MUST import from root `config.js` using relative path `../../config.js` or `../../../config.js`
- Each lesson has its own `src/config.js` for lesson-specific settings (model, budget, etc.)
- Never import API keys directly - always use root config exports

### API Helper Implementation
- `chat()` function signature varies by lesson - always check local `src/helpers/api.js`
- Some lessons include `recordUsage()` call in api.js, others don't
- Responses API returns `output` array with items of type `message`, `function_call`, or `reasoning`
- Extract text: `response.output.find(item => item.type === "message")?.content?.[0]?.text`

### MCP Integration (Available in Advance Mode)
- MCP servers run as stdio subprocesses, NOT HTTP
- MCP client spawns server with stdio transport
- Check for `mcp.json` in lesson root for server configs
- MCP tool calls return `{ content: [{ type: "text", text: "..." }] }` structure
- File operations MUST use MCP filesystem server when available

### Budget Tracking Implementation
- Budget tracking uses `(tokens / 10) * cost_per_10_tokens` formula
- Cached tokens have separate cost rate (usually half of input cost)
- Budget check happens BEFORE API call, failure stops execution immediately
- Usage stats stored in `src/helpers/stats.js` with `recordUsage()` function

### Module Entry Points
- JavaScript lessons: `app.js` in lesson root
- TypeScript lessons: `src/index.ts` with `npx tsx` or `bun` runner
- REPL lessons: `src/repl.js` for interactive sessions
- Always run from lesson directory: `cd lesson_dir && node app.js`

### Error Handling Pattern
- API errors throw with `data.error.message` from response
- No try-catch in most examples - errors bubble up
- Graceful shutdown handlers in `src/helpers/shutdown.js` for cleanup

## Graceful Shutdown Pattern
- Use `src/helpers/shutdown.js` for cleanup (DB connections, MCP clients)
- Handlers registered for SIGINT and SIGTERM
- Prevents duplicate shutdown with `shuttingDown` flag

## Access To
- MCP tools and servers
- Browser automation (in specific lessons like 03_03_browser)