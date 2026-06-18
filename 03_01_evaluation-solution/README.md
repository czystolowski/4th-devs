# Sensor Evaluation Solution

Optimized solution for detecting anomalies in 10,000 sensor readings with minimal LLM costs.

## Optimization Strategy

### 1. Programmatic Validation (Free)
Detects anomalies that don't require LLM:
- **Out of range values**: Check if sensor readings exceed valid ranges
- **Unexpected sensor fields**: Check if sensor returns data it shouldn't (e.g., temperature sensor returning pressure)

This eliminates ~46 files from needing LLM validation.

### 2. Note Deduplication (Massive Token Savings)
- 9,999 files have only 2,032 unique operator notes
- Group files by identical notes
- Validate each unique note once, apply result to all files with that note
- **Savings**: ~80% reduction in data sent to LLM

### 3. Smart Filtering (Further Reduction)
Only send notes to LLM that need validation:
- Operator says "OK" but data has issues
- Operator reports problems but data is fine

Skip notes where operator assessment matches reality.
- **Result**: Only ~357 unique notes need LLM validation (from 2,032)

### 4. Prompt Caching (50% Cost Reduction)
Structure prompt with static content FIRST:
```
STATIC (cached):
- Validation rules
- Range definitions  
- Output format instructions

VARIABLE (not cached):
- Actual sensor data
- Operator notes
```

LLM caches the static part, only processes variable data.
- **Savings**: ~50% on input tokens after first call

### 5. Batch Processing (Efficiency)
- Process 100 notes per API call (vs 1 per call)
- Compact output format (just case numbers)
- **Result**: ~4 API calls instead of 357

### 6. Compact Data Format
Instead of full JSON, send minimal data:
```
Before: {"temperature_K": 742, "pressure_bar": 0, ...}
After: temp=742K
```
- **Savings**: ~70% fewer tokens per case

## Total Optimization

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Files to validate | 9,999 | 357 unique notes | 96% |
| API calls | 357 | 4 | 99% |
| Tokens per call | ~50K | ~15K | 70% |
| Cost per call | $0.15 | $0.0225 | 85% |
| **Total cost** | **~$53** | **~$0.09** | **99.8%** |

## Usage

```bash
# Download sensor data
cd workspace
curl -L -o sensors.zip https://hub.ag3nts.org/dane/sensors.zip
unzip sensors.zip
rm sensors.zip

# Run analysis
cd ..
node app.js
```

## Architecture

```
app.js                          # Main orchestrator
├── src/validator.js            # Programmatic checks
├── src/helpers/api-optimized.js # LLM validation with caching
├── src/helpers/hub.js          # Result submission
└── src/config.js               # Sensor ranges & settings
```

## Key Files

- **validator.js**: Pure logic, no LLM needed
  - `validateProgrammatically()` - Find data anomalies
  - `groupByOperatorNotes()` - Deduplicate notes
  - `hasDataAnomalies()` - Check if data is bad
  
- **api-optimized.js**: Maximum caching efficiency
  - Static rules in system message (cached)
  - Variable data in user message (not cached)
  - Batch processing (100 notes/call)
  - Compact output format

## Results

- **Programmatic anomalies**: 46 files
- **LLM-detected anomalies**: TBD (after OpenRouter auth fix)
- **Total unique anomalies**: TBD
- **Estimated cost**: < $0.10