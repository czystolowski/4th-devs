# Failure Log Compression Solution

Solution for the AI_devs 4th edition lesson on log compression and failure analysis.

## Challenge

Compress power plant failure logs to fit within 1500 token budget while preserving all critical information needed for root cause analysis.

## Solution Architecture

### Separation of Concerns

**Main App (`app.js`)** - Handles all data processing:
- Downloads raw logs from hub
- Filters to CRIT level only (most critical events)
- Removes duplicate entries
- Formats logs consistently
- Counts tokens and verifies budget
- Manages iterative verification loop

**Agent (`src/agent.js`)** - Handles only:
- AI-powered log compression
- Applies aggressive abbreviation rules
- Maintains critical information

### Key Insights

1. **CRIT-only filtering**: Reduced 890 entries to 114 CRIT events
2. **Deduplication**: Further reduced to 15 unique critical events
3. **Token efficiency**: Processed logs = 580 tokens (well under 1500 limit)
4. **No AI compression needed**: Rule-based processing was sufficient

### Processing Pipeline

```
Raw Logs (248KB)
    ↓
Filter CRIT only (114 entries)
    ↓
Remove duplicates (15 unique)
    ↓
Format consistently
    ↓
Verify with hub → Flag received!
```

## Running the Solution

```bash
cd 02_03_failure-solution
node app.js
```

## Configuration

- **Model**: gpt-4o-mini (cost-effective for compression)
- **Token Budget**: 1500 tokens max
- **Log Levels**: CRIT only (most aggressive filtering)

## Results

- **Final Token Count**: 580/1500 tokens
- **Compression Ratio**: Not needed (rule-based processing sufficient)
- **Flag**: Successfully captured

## Files

- `app.js` - Main orchestration
- `src/agent.js` - AI compression logic
- `src/config.js` - Configuration
- `src/helpers/hub.js` - Hub API communication
- `src/helpers/logger.js` - Logging utilities
- `workspace/` - Processing artifacts
  - `raw-logs.txt` - Downloaded logs
  - `processed-logs.txt` - Filtered and deduplicated logs
  - `final-solution.txt` - Submitted solution

## Lessons Learned

1. **Rule-based preprocessing is crucial** - Filtering and deduplication reduced data by 99%
2. **CRIT-only is sufficient** - Lower severity levels add noise without critical information
3. **Deduplication matters** - Many CRIT events repeat with different timestamps
4. **Token counting discrepancy** - Local estimates differ from hub, but aggressive filtering compensates
5. **Separation of concerns** - Clear split between data processing and AI logic improves control