# Plan Mode Rules (Non-Obvious Only)

> **Note:** For token optimization tactics (caching, budgets, chunking), see main AGENTS.md in project root.

## Architecture Constraints

### Lesson Independence
- Each lesson is completely self-contained
- No shared dependencies between lessons (except root config.js)
- Lessons can use different runtimes (Node vs Bun vs tsx)
- No monorepo-style shared packages

### Configuration Architecture
- Root `config.js` is the ONLY source of API keys and provider logic
- Lesson configs (`src/config.js`) only contain lesson-specific settings
- Provider resolution happens at root level (OpenAI vs OpenRouter)
- Model name normalization via `resolveModelForProvider()` at root

### API Integration Pattern
- All lessons use Responses API, NOT Chat Completions API
- Response structure: `{ output: [{ type, content }] }` not `{ choices }`
- Each lesson wraps API calls in `src/helpers/api.js`
- Budget tracking (when present) happens in `src/helpers/stats.js`

### MCP Architecture
- MCP servers are separate processes (stdio transport)
- Client spawns server as subprocess, NOT HTTP requests
- Server configs in `mcp.json` at lesson root
- File operations abstracted through MCP when available

### Module Execution Model
- Lessons MUST run from their own directory (not root)
- Pre-scripts in root package.json handle setup (e.g., MCP server files)
- TypeScript lessons use tsx or bun, NOT tsc compilation
- REPL lessons use interactive loop pattern

### Budget Constraints
- Budget tracking is per-lesson, NOT global
- Formula: `(tokens / 10) * cost_per_10_tokens`
- Cached tokens have separate (lower) cost rate
- Budget failure stops execution immediately

### Testing Strategy
- No centralized test framework
- Each lesson is a runnable example/demo
- `demo/` directories show expected outputs
- Validation happens through hub.ag3nts.org submissions (when applicable)

### Special Architectural Notes
- Graph lessons (02_03): External Neo4j dependency
- Gmail lessons (03_04): OAuth flow with token persistence
- Browser lessons (03_03): Playwright for automation
- API lesson (05_04): Full backend with Drizzle ORM