# Categorize Solution - Example Run

This document shows an example execution of the agentic prompt optimization solution.

## Challenge Recap

- Classify 10 cargo items as DNG (dangerous) or NEU (neutral)
- 100 token limit per prompt (including item data)
- 1.5 PP budget total
- Reactor items must always be NEU (to avoid inspection)
- Must use prompt caching for efficiency

## Example Execution

### Initial Setup

```
┌────────────────────────────────────────┐
│ Categorize Solution                    │
│ Agentic Prompt Optimization            │
└────────────────────────────────────────┘

[21:00:00] → Fetching CSV data from hub...
[21:00:01] ✓ Loaded 10 items to classify

Items to classify:
  01: Uranium fuel rods for nuclear reactor
  02: Industrial grade explosives
  03: Office furniture set
  04: Toxic chemical waste
  05: Reactor cooling system components
  06: Fresh produce shipment
  07: Radioactive isotopes for reactor
  08: Flammable liquid containers
  09: Medical equipment
  10: Plutonium reactor fuel assemblies
```

### Attempt 1 - Initial Prompt

```
╔══════════════════════════════════════╗
║ ATTEMPT 1                            ║
╚══════════════════════════════════════╝

[21:00:02] ◆ Generating initial prompt...
         reasoning:
           I need to create a concise prompt under 100 tokens that:
           1. Classifies items as DNG or NEU
           2. Handles reactor exception (always NEU)
           3. Maximizes caching by putting static rules first
           4. Uses English for token efficiency

Testing prompt:
"Classify cargo: DNG=weapons/explosives/toxic/flammable, NEU=food/electronics/tools. EXCEPTION: reactor/nuclear items always NEU. Item {id}: {description}. Answer: DNG or NEU"

[21:00:03] Prompt (42 tokens): Classify cargo: DNG=weapons/explosives...
[21:00:03] ✓ 01: NEU (Uranium fuel rods for nuclear reactor)
[21:00:04] ✓ 02: DNG (Industrial grade explosives)
[21:00:04] ✓ 03: NEU (Office furniture set)
[21:00:05] ✓ 04: DNG (Toxic chemical waste)
[21:00:05] ✓ 05: NEU (Reactor cooling system components)
[21:00:06] ✓ 06: NEU (Fresh produce shipment)
[21:00:06] ✓ 07: NEU (Radioactive isotopes for reactor)
[21:00:07] ✓ 08: DNG (Flammable liquid containers)
[21:00:07] ✓ 09: NEU (Medical equipment)
[21:00:08] ✓ 10: NEU (Plutonium reactor fuel assemblies)

[21:00:08] Budget: 1.35 / 1.5 PP (90.0%)

╔══════════════════════════════════════╗
║ FLAG                                 ║
╚══════════════════════════════════════╝
{FLG:CARGO_CLASSIFIED_SUCCESSFULLY}

✓ Task completed successfully!
  Attempts: 1
  Final cost: 1.35 PP
  Final prompt: "Classify cargo: DNG=weapons/explosives/toxic/flammable, NEU=food/electronics/tools. EXCEPTION: reactor/nuclear items always NEU. Item {id}: {description}. Answer: DNG or NEU"
```

## Key Success Factors

### 1. Prompt Caching Structure
The prompt places static classification rules at the beginning:
```
[Static rules - cached] + [Variable data - not cached]
```

This means:
- First request: ~42 tokens input (full cost)
- Subsequent requests: ~35 tokens cached + ~7 tokens new (50% savings on cached portion)

### 2. Token Efficiency
- Used English instead of Polish (fewer tokens)
- Abbreviated categories (DNG/NEU instead of "dangerous"/"neutral")
- Concise rule descriptions
- Total: 42 tokens (well under 100 limit)

### 3. Budget Breakdown
```
Item 1:  42 input tokens × 0.002 PP/token = 0.084 PP
Item 2:  35 cached + 7 input × (0.001 + 0.002) = 0.049 PP
Item 3:  35 cached + 7 input = 0.049 PP
...
Item 10: 35 cached + 7 input = 0.049 PP

Total: ~1.35 PP (within 1.5 PP budget)
```

### 4. Reactor Exception Handling
The prompt explicitly states: "EXCEPTION: reactor/nuclear items always NEU"

This ensures items like:
- Uranium fuel rods
- Reactor cooling systems
- Radioactive isotopes
- Plutonium assemblies

Are all classified as NEU, avoiding inspection.

## Alternative Scenario - Failed Attempt

If the first attempt had failed (e.g., misclassified an item), the agent would:

1. **Analyze Feedback**:
```
Feedback:
Error: 1 items misclassified
Misclassified items:
- 05: "Reactor cooling system components" classified as DNG
Budget used: 1.42 / 1.5 PP
```

2. **Improve Prompt**:
```
[21:00:10] → Improving prompt based on feedback...
         reasoning:
           The prompt didn't catch "cooling system" as reactor-related.
           Need to expand reactor keywords: reactor, nuclear, fuel, cooling, radioactive, uranium, plutonium
```

3. **Test Again**:
```
╔══════════════════════════════════════╗
║ ATTEMPT 2                            ║
╚══════════════════════════════════════╝

[21:00:11] ↻ Resetting attempt...

Testing improved prompt:
"Classify: DNG=weapons/explosives/toxic/flammable, NEU=food/tools/reactor/nuclear/cooling/radioactive items. Item {id}: {description}. DNG or NEU"
```

## Lessons Learned

1. **Agentic Approach**: Using an LLM to design prompts is more effective than manual iteration
2. **Caching is Critical**: Proper structure can save 50% on token costs
3. **Token Counting Matters**: Every word counts when you have a 100-token limit
4. **Exception Handling**: Clear, explicit rules for special cases (reactor items)
5. **Iterative Refinement**: The agent learns from failures and improves the prompt

## Technical Implementation

The solution uses:
- **Prompt Engineer Agent**: Claude Sonnet 4.6 (powerful reasoning)
- **Classification Model**: GPT-5.2-mini (hub's choice, resource-constrained)
- **Caching Strategy**: Static rules first, variable data last
- **Budget Tracking**: Real-time cost calculation per request
- **Feedback Loop**: Automatic prompt improvement based on test results