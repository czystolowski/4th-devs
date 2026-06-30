# S04E02 — Wind Turbine Scheduler (windpower)

## Lesson Overview

This solution programs a wind turbine scheduling system under a strict **40-second service window** using parallelised async API calls. The core challenge is fetching weather data (which takes ~24 seconds) while completing all remaining operations within the remaining time budget.

**Flag:** `{FLG:IVEGOTTHEPOWER}`

## Problem Statement

A wind turbine needs to be scheduled to:

1. **Survive storms** — when wind exceeds 14 m/s, blade pitch must be set to 90° (feathered) to prevent damage. The turbine resets ~1 hour after each storm, so consecutive storm periods each require a separate protection config point.
2. **Produce required power** — find the first weather window where the turbine can produce enough kW to meet the power plant's energy deficit.
3. **All config points must be digitally signed** — each requires an `unlockCode` generated via the `unlockCodeGenerator` action.

### Time Constraint

All operations must complete within **40 seconds** from calling `start`. A linear, sequential approach will not fit within the window.

## Solution Architecture

```
Phase 1 (0.0s)  — start + queue [weather, powerplantcheck] in parallel
Phase 2 (0.3s)  — poll getResult × 2  (weather ≈24s, powerplant ≈10s)
Phase 3 (24s)   — analyse forecast → build config points (storms + production)
Phase 4 (24s)   — queue N unlockCodeGenerator requests in parallel
Phase 4 (24s+)  — poll getResult × N (codes arrive in ~2s)
Phase 5 (26s)   — submit bulk config (one API call for all points)
Phase 6 (26s)   — queue turbinecheck (no need to collect the result)
Phase 7 (26s)   — call done → receive flag
Total: ≈26s  ✓
```

## Key Technical Decisions

### Parallelism is mandatory
- Weather and powerplantcheck are queued in a single `Promise.all` — they run concurrently on the server side.
- All unlock codes for all config points are queued simultaneously, completing in ~2s regardless of count.
- Collecting turbinecheck result would add ~15s to the critical path. Instead, just **queue it** before `done` — the `done` action validates the configuration independently.

### Power estimation via interpolation
The documented wind yield table gives ranges (e.g. "4 m/s → 10-15%"). The solution uses linear interpolation between midpoint breakpoints:

| Wind (m/s) | Yield |
|-----------|-------|
| 0         |   0 % |
| 4         | 12.5% |
| 6         |  35 % |
| 8         |  65 % |
| 10        |  95 % |
| ≥12       | 100 % |

At 4.9 m/s (the typical production window): ~22.6% of 14 kW = **~3.2 kW**, enough for a 2–3 kW deficit.

### Power deficit parsing
The API returns `powerDeficitKw` as a string like `"2-3"` or `"3-4"`. The solution uses the **minimum** of the range as the production requirement (most conservative check that any 4.9 m/s wind would satisfy).

### Config key format
The batch config API uses `"YYYY-MM-DD HH:MM:SS"` as the key. The `unlockCode` lookup uses `signedParams.startDate + ' ' + signedParams.startHour` returned by the unlock code generator.

## Turbine Rules Summary

| Condition | Pitch Angle | Mode       |
|-----------|-------------|------------|
| Wind > 14 m/s (storm) | 90° (feathered) | `idle` |
| Wind ≥ 4 m/s, sufficient output | 0° (optimal) | `production` |
| Otherwise | — | not scheduled |

## Running

```bash
# From this directory:
node app.js
```

Requires `AGENT_TOKEN` in the root `.env` file.

## What Didn't Work (Investigation Notes)

| Approach | Issue |
|----------|-------|
| Sequential API calls | Exceeds 40s — weather alone takes ~24s |
| Queuing turbinecheck and collecting result | +15s on critical path → total ~41s > 40s |
| Including turbinecheck in initial parallel batch | The result reflects state when *processed*, not when *queued* — shows pre-config state |
| Using step midpoints directly without interpolation | Underpredicts power at fractional wind speeds |

## Concepts from Previous Lessons Applied

- **Async parallelism** (`Promise.all`) — from multi-agent coordination patterns
- **Critical path optimisation** — fire slow requests first; don't block on unnecessary results
- **API polling with bounded retry** — `collectResults()` with timeout guard
- **Bulk API submission** — single request for all config points avoids per-call latency
