# Lessons Learned from Previous Tasks

## Key Patterns from Completed Tasks

### 1. API Response Format Awareness (02_04_mailbox)
**Critical Discovery**: Always verify actual API response structure
- ZMail API returned `items` not `messages`
- Content was in `message` field, not `body`
- **Lesson**: Read API responses carefully, don't assume standard naming

### 2. Interactive Systems (02_04_mailbox)
**Pattern**: Some systems respond to user actions (conversation-like)
- Mailbox was "active" - new messages appeared after reading existing ones
- Required persistent session with wait-and-check pattern
- **Lesson**: Treat interactive APIs like conversation partners, not static databases

### 3. Token Budget Management (02_03_failure)
**Strategy**: Calculate costs BEFORE making API calls
- Formula: `(tokens / 10) * cost_per_10_tokens`
- Cached tokens cost ~50% less
- **Lesson**: Budget tracking prevents wasted API calls

### 4. Prompt Caching Optimization
**Technique**: Static content first, variable data last
- Enables automatic caching on repeated calls
- Example: `"Rules: DNG=weapons. {code}: {description}"` (rules cached)
- **Lesson**: Structure prompts for maximum cache reuse

### 5. Agentic Function Calling (All tasks)
**Architecture**: Tools + Agent Loop + Feedback
- Define tools with clear descriptions and parameters
- Agent decides which tools to call and when
- Iterate based on tool results and feedback
- **Lesson**: Let AI orchestrate, provide good tools

### 6. Vision Model Usage (02_02_electricity)
**Best Practice**: Use vision models for image analysis
- Can send image URLs directly (no download needed)
- Good for: counting, locating, analyzing visual patterns
- Models: `gpt-4o`, `gpt-5.4` (better for precise counting)
- **Lesson**: Vision models excel at spatial/visual tasks

### 7. Iterative Refinement
**Approach**: Start simple, refine based on feedback
- Don't over-engineer first attempt
- API error messages guide corrections
- **Lesson**: Reactive iteration > perfect first try

### 8. Module Structure Patterns
**Standard Layout** (from 02_03, 02_04):
```
lesson_dir/
├── app.js              # Main entry point
├── package.json        # ES modules, scripts
├── src/
│   ├── config.js       # Task-specific config
│   ├── agent.js        # AI agent logic
│   └── helpers/
│       ├── api.js      # API wrappers
│       └── logger.js   # Logging utilities
└── workspace/          # Sandboxed file operations
```

## Insights from 02_05 Modules

### 02_05_agent: Observer/Reflector Pattern
**Purpose**: Context window management for long conversations
- **Observer**: Compresses old messages into structured observations
- **Reflector**: Further distills observations when they grow too large
- **Memory**: Persists to `workspace/memory/`
- **Lesson**: Multi-level compression maintains context in long sessions

### 02_05_sandbox: MCP + QuickJS Execution
**Purpose**: Safe tool execution in sandboxed environment
- **MCP**: Dynamic tool discovery from MCP servers
- **QuickJS**: Sandboxed JavaScript execution
- **Agent Templates**: Load from `.agent.md` files
- **Lesson**: Sandbox untrusted code, discover tools dynamically

## Drone Task Strategy

Based on lessons learned:

1. **Vision First**: Use vision model to analyze map and locate dam
2. **Two-Phase Approach**: 
   - Phase 1: Vision model identifies dam sector (row, col)
   - Phase 2: Text model builds instruction sequence
3. **Iterative Refinement**: Submit best guess, adjust based on API feedback
4. **Documentation Analysis**: Focus on required functions, ignore noise
5. **Reset Available**: Use `hardReset` if configuration gets messy

## Critical Success Factors

✅ **Verify API formats** - Don't assume, always check actual responses
✅ **Use appropriate models** - Vision for images, cheap models for simple tasks
✅ **Budget tracking** - Calculate before calling, track cumulative costs
✅ **Iterative approach** - Start simple, refine based on feedback
✅ **Tool-based architecture** - Let AI orchestrate with good tools
✅ **Caching optimization** - Static first, variable last