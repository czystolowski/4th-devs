# Ask Mode Rules (Non-Obvious Only)

> **Note:** For token optimization tactics (caching, budgets, chunking), see main AGENTS.md in project root.

## Documentation Context

### Lesson Structure
- Lessons numbered `XX_YY_name` format (e.g., `02_01_categorize-solution`)
- `-solution` suffix indicates completed solution, NOT starter code
- Each lesson is self-contained with its own dependencies
- No shared test framework - lessons are standalone examples

### Module Organization
- JavaScript lessons: `app.js` entry point in lesson root
- TypeScript lessons: `src/index.ts` entry point
- REPL lessons: `src/repl.js` for interactive sessions
- Workspace directories (`workspace/`) are sandboxed for file operations

### Configuration Hierarchy
- Root `config.js` handles API keys and provider resolution
- Lesson-specific `src/config.js` for model, budget, and constraints
- Root `.env` file loaded automatically by root config (Node 24+)
- Never import API keys directly - use root config exports

### Running Lessons
- MUST run from lesson directory: `cd lesson_dir && node app.js`
- Check root `package.json` for lesson-specific scripts
- Some lessons have pre-scripts (e.g., `prelessonX:*`)
- TypeScript lessons use `npx tsx` or `bun`, NOT `node`

### MCP Lessons
- Require `npm run ensure:files-mcp` before running
- `mcp.json` in lesson root defines server configurations
- MCP servers run as stdio subprocesses
- File operations use MCP filesystem server, NOT Node.js fs

### Demo & Examples
- `demo/` directories contain example outputs, NOT test suites
- Run demos with lesson-specific scripts in root `package.json`
- README.md in each lesson explains the concept and usage

### Special Requirements
- Graph lessons (02_03): Require Neo4j running locally
- Gmail lessons (03_04): Require OAuth setup via `bun src/auth.ts`
- Browser lessons (03_03): Use Playwright for automation
- Some lessons use Bun instead of Node (check package.json)
