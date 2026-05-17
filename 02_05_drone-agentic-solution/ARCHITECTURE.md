# Agentic Drone Control System Architecture

## Overview

A multi-agent system that autonomously solves the drone control challenge from scratch, using specialized agents with clear responsibilities, long-term memory, and dynamic tool disclosure.

## Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    COORDINATOR AGENT                         │
│  - Orchestrates all sub-agents                              │
│  - Maintains mission state                                   │
│  - Decides which agent to activate next                      │
│  - Manages long-term memory                                  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ VISION AGENT │    │  DOC AGENT   │    │ BUILDER AGENT│
│              │    │              │    │              │
│ - Analyzes   │    │ - Fetches    │    │ - Constructs │
│   map        │    │   API docs   │    │   instruction│
│ - Locates    │    │ - Extracts   │    │   sequence   │
│   dam        │    │   functions  │    │ - Uses memory│
│ - Counts     │    │ - Understands│    │   & feedback │
│   grid       │    │   parameters │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    ┌──────────────┐
                    │VALIDATOR     │
                    │AGENT         │
                    │              │
                    │ - Submits    │
                    │   to hub     │
                    │ - Interprets │
                    │   feedback   │
                    │ - Triggers   │
                    │   refinement │
                    └──────────────┘
```

## Agent Responsibilities

### 1. Coordinator Agent
**Role**: Mission orchestrator and decision maker

**Responsibilities**:
- Initialize mission with task description
- Maintain global state (what's known, what's needed)
- Decide which agent to activate based on current state
- Manage long-term memory (observations, learnings)
- Coordinate information flow between agents
- Determine when mission is complete

**Tools**:
- `activate_vision_agent` - Analyze map
- `activate_doc_agent` - Fetch and parse documentation
- `activate_builder_agent` - Build instruction sequence
- `activate_validator_agent` - Test instructions
- `record_observation` - Save to long-term memory
- `recall_observations` - Retrieve from memory
- `complete_mission` - Finish with result

**Memory Structure**:
```javascript
{
  observations: [
    { agent: "vision", finding: "Grid is 3x4", confidence: "high" },
    { agent: "doc", finding: "set() is overloaded", confidence: "high" },
    { agent: "validator", finding: "Need height parameter", confidence: "high" }
  ],
  state: {
    map_analyzed: true,
    dam_location: { col: 2, row: 4 },
    doc_fetched: true,
    instructions_built: true,
    validation_attempts: 3
  }
}
```

### 2. Vision Agent
**Role**: Visual analysis specialist

**Responsibilities**:
- Analyze drone map image
- Count grid dimensions precisely
- Locate dam by color intensity
- Provide confidence scores
- Re-analyze if feedback indicates error

**Tools**:
- `analyze_image` - Vision API call
- `count_grid_lines` - Precise counting
- `locate_feature` - Find specific features
- `verify_coordinates` - Double-check location

**Output Format**:
```javascript
{
  grid: { columns: 3, rows: 4 },
  dam: { column: 2, row: 4 },
  confidence: "high",
  reasoning: "Dam has intensified cyan color in bottom-center"
}
```

### 3. Documentation Agent
**Role**: API documentation specialist

**Responsibilities**:
- Fetch HTML documentation
- Parse and extract function signatures
- Understand parameter types and formats
- Identify required vs optional parameters
- Build function catalog

**Tools**:
- `fetch_documentation` - Get HTML doc
- `parse_html` - Extract structured data
- `extract_functions` - List all functions
- `understand_parameters` - Parse param requirements

**Output Format**:
```javascript
{
  functions: [
    {
      name: "setDestinationObject",
      params: ["ID"],
      format: "[A-Z]{3}[0-9]+[A-Z]{2}",
      required: true
    },
    {
      name: "set",
      variants: [
        { params: ["x", "y"], description: "Set coordinates" },
        { params: ["xm"], description: "Set height" },
        { params: ["mode"], description: "Engine on/off" },
        { params: ["power"], description: "Engine power %" }
      ]
    }
  ]
}
```

### 4. Instruction Builder Agent
**Role**: Command sequence constructor

**Responsibilities**:
- Build instruction sequence from requirements
- Use memory of previous attempts
- Incorporate validator feedback
- Ensure proper ordering
- Handle missing parameters

**Tools**:
- `build_sequence` - Construct instructions
- `validate_format` - Check syntax
- `add_instruction` - Append to sequence
- `reorder_instructions` - Fix sequencing

**Input**:
- Dam coordinates from Vision Agent
- Function catalog from Doc Agent
- Feedback from Validator Agent
- Memory of previous attempts

**Output**:
```javascript
{
  instructions: [
    "set(engineON)",
    "set(100%)",
    "setDestinationObject(PWR6132PL)",
    "set(2,4)",
    "set(50m)",
    "set(destroy)",
    "set(return)",
    "flyToLocation"
  ],
  reasoning: "Added height after feedback about trees"
}
```

### 5. Validator Agent
**Role**: Testing and refinement specialist

**Responsibilities**:
- Submit instructions to hub
- Parse error messages
- Identify missing requirements
- Trigger appropriate agent for fixes
- Recognize success (FLAG)

**Tools**:
- `submit_instructions` - POST to /verify
- `parse_error` - Extract error details
- `identify_issue` - Categorize problem
- `suggest_fix` - Recommend solution

**Error Interpretation**:
```javascript
{
  "Unknown instruction": "Doc Agent needs to re-check",
  "wrong coordinates": "Vision Agent needs to re-analyze",
  "too dangerous": "Builder needs to add height",
  "engine power": "Builder needs engine commands",
  "lose it forever": "Builder needs return instruction"
}
```

## Communication Protocol

### Message Format
```javascript
{
  from: "coordinator",
  to: "vision_agent",
  type: "request",
  action: "analyze_map",
  data: { map_url: "..." },
  context: { attempt: 1, previous_result: null }
}
```

### Response Format
```javascript
{
  from: "vision_agent",
  to: "coordinator",
  type: "response",
  success: true,
  data: { grid: {...}, dam: {...} },
  confidence: "high",
  observations: ["Grid is 3x4", "Dam at bottom-center"]
}
```

## Long-Term Memory System

### Memory Types

1. **Episodic Memory**: What happened
   ```javascript
   {
     episode: 1,
     agent: "validator",
     action: "submit_instructions",
     result: "error",
     error: "Unknown instruction: setTarget",
     learning: "Function name is setDestinationObject, not setTarget"
   }
   ```

2. **Semantic Memory**: What we know
   ```javascript
   {
     fact: "Dam location",
     value: { column: 2, row: 4 },
     confidence: "high",
     source: "vision_agent",
     verified: true
   }
   ```

3. **Procedural Memory**: How to do things
   ```javascript
   {
     procedure: "build_drone_instructions",
     steps: [
       "Turn on engines first",
       "Set power before flight",
       "Set destination and coordinates",
       "Set height to clear obstacles",
       "Set mission goals",
       "Add return instruction",
       "Execute with flyToLocation"
     ]
   }
   ```

### Memory Operations

- `store(type, data)` - Save to memory
- `recall(type, query)` - Retrieve from memory
- `update(id, data)` - Modify existing memory
- `compress()` - Summarize old memories (observer pattern)
- `reflect()` - Extract patterns and learnings

## Dynamic Tool Disclosure

Tools are revealed progressively based on agent needs:

### Phase 1: Discovery
- Coordinator gets basic orchestration tools
- Vision agent gets image analysis tools

### Phase 2: Understanding
- Doc agent gets HTML parsing tools
- Builder gets sequence construction tools

### Phase 3: Execution
- Validator gets submission tools
- All agents get memory tools

### Phase 4: Refinement
- Builder gets refinement tools based on errors
- Vision gets re-analysis tools if needed

## Execution Flow

```
1. Coordinator: Initialize mission
   ↓
2. Coordinator: Activate Vision Agent
   ↓
3. Vision Agent: Analyze map → Return dam location
   ↓
4. Coordinator: Store observation, Activate Doc Agent
   ↓
5. Doc Agent: Fetch & parse docs → Return function catalog
   ↓
6. Coordinator: Store observation, Activate Builder Agent
   ↓
7. Builder Agent: Build instructions using memory
   ↓
8. Coordinator: Activate Validator Agent
   ↓
9. Validator Agent: Submit → Get feedback
   ↓
10. If error:
    - Coordinator: Analyze error
    - Activate appropriate agent for fix
    - Go to step 7
    ↓
11. If success (FLAG):
    - Coordinator: Complete mission
    - Store final observations
```

## Key Design Principles

1. **Separation of Concerns**: Each agent has one clear responsibility
2. **Memory-Driven**: Agents learn from previous attempts
3. **Feedback Loops**: Errors trigger specific refinements
4. **Progressive Disclosure**: Tools revealed as needed
5. **Autonomous**: No human intervention required
6. **Observable**: All decisions and actions logged
7. **Resilient**: Can recover from errors and retry

## Success Criteria

✅ Discovers task requirements autonomously
✅ Analyzes map without human guidance
✅ Understands API documentation independently
✅ Builds correct instruction sequence
✅ Refines based on feedback
✅ Obtains FLAG without manual intervention
✅ Maintains clear audit trail of decisions