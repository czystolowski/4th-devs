# S04E03 — Domatowo Rescue Mission

**Lesson**: Resilient AI Workflows — Retry, Circuit Breaker, DLQ, Output Monitoring  
**Task**: `domatowo`  
**Result**: ✅ `{FLG:WEVEGOTHIM}`

## Overview

An autonomous rescue-agent that searches the ruins of the bombed city of Domatowo for a surviving partisan and evacuates them with a helicopter — all within a 300-action-point budget.

The mission is solved in a single deterministic pass: a transporter carries 3 scouts to three target clusters on the map and drops each one at the optimal insertion point. Scouts inspect every 3-floor apartment block (the tallest buildings, "Blok 3p") until the partisan is found, then the helicopter is immediately called.

---

## Running

```bash
cd 04_03_domatowo-solution
node app.js
```

Requires `AGENT_TOKEN` in the root `.env` file.

---

## Mission Intelligence

Intercepted radio signal:
> *"I survived. Bombs destroyed the city. Soldiers were here, looking for resources, they took the oil. Now it's empty. I have a weapon, I'm wounded. I hid in one of the tallest apartment blocks. I have no food. Help."*

**Key deduction**: "tallest blocks" → `B3` / "Blok 3p" (3-floor buildings) — the only tile type that fits.

---

## Map & Strategy

```
   A  B  C  D  E  F  G  H  I  J  K
 1 TR RO RO RO EM [B3 B3]TR EM PK PK
 2 TR TR EM RO RO [B3 B3]TR RO PK PK
 3 EM EM EM RO PK EM EM TR RO EM EM
 4 B1 B1 EM RO PK SZ SZ SZ RO BS BS
 5 B1 B1 EM RO PK SZ SZ SZ RO BS BS
 6 RO RO RO RO RO RO RO RO RO RO EM   ← spawn row
 7 B2 B2 EM RO EM KS KS KS EM TR EM
 8 B2 B2 EM RO EM KS KS KS EM TR EM
 9 EM RO RO RO RO RO RO RO RO RO EM
10[B3 B3 B3]EM TR EM EM [B3 B3]TR EM
11[B3 B3 B3]EM TR EM EM [B3 B3]TR EM
```

14 `B3` tiles spread across 3 isolated clusters:

| Cluster | Tiles | Nearest road drop |
|---------|-------|-------------------|
| 1 (top-right) | F1, G1, F2, G2 | E2 (transporter) |
| 2 (bottom-left) | A10–C11 | B9 (transporter) |
| 3 (bottom-right) | H10–I11 | H9 (transporter) |

### Action-Point Budget

| Step | Action | Cost |
|------|--------|------|
| Create transporter + 3 scouts | `create` | 20 |
| Drive A6 → E2 | `move` transporter | 9 |
| Dismount Scout-1 | `dismount` | 0 |
| Scout-1 inspects F2, F1, G1, G2 | `move` + `inspect` ×4 | 32 |
| Drive E2 → B9 | `move` transporter | 11 |
| Dismount Scout-2 | `dismount` | 0 |
| Scout-2 inspects A9→B10 cluster | `move` + `inspect` ×7 | 55 |
| Drive B9 → H9 | `move` transporter | 7 |
| Dismount Scout-3 | `dismount` | 0 |
| Scout-3 inspects H10, H11, I11, I10 | `move` + `inspect` ×4 | 32 |
| **Total (worst case)** | | **~166 pts** |

Actual budget used: **~161 pts** (139 remaining out of 300).

Early exit: as soon as one scout confirms the partisan, the helicopter is called immediately — no further inspections are done.

---

## Detection Logic

The API returns inspection results as Polish-language log entries. Positive findings (partisan found) always describe the person in the sentence, containing "Mężczyzna" (man) or "Kobieta" (woman). All negative messages only describe empty rooms.

Confirmed positive message patterns:
```
"Poszukiwany odnaleziony. Mężczyzna po trzydziestce, schowany w szafie technicznej."
"Jest kontakt. Mężczyzna, około 30 lat, próbował przeczekać w schowku na parterze."
"Kontakt potwierdzony. Mężczyzna około 30 lat, ukrywał się na parterze za ladą."
"Cel jest z nami. Mężczyzna około 30 lat, ranny w ramię, ale przytomny."
```

The detector checks for `"mężczyzna"` / `"kobieta"` and a set of confirmed positive-phrase prefixes. It deliberately avoids ambiguous keywords like `"odnaleziono"` that appear in negative messages like `"Nie odnaleziono osoby"`.

---

## Resilience Patterns Applied (S04E03 lesson)

This solution demonstrates all four patterns taught in the lesson:

### 1. Retry with Exponential Back-off + Jitter
Every API call goes through the `api()` function which automatically retries on transient errors (network failures, HTTP 5xx). It uses *decorrelated jitter* to avoid the "thundering herd" problem: each retry delay is sampled randomly from a growing range, preventing all retry instances from hitting the API at the same moment.

```js
// Decorrelated jitter: prevents synchronized retries across instances
const jitter = Math.random() * (3 * delay - baseDelayMs) + baseDelayMs;
delay = Math.min(delay * 2, 8000); // cap at 8s
```

4xx errors are treated as permanent (bad request) and not retried.

### 2. Schema Validation (Output Monitoring)
Every API response is validated by `assertFields()` before processing. Missing required fields immediately throw a descriptive error, catching "silent degradation" where the API returns HTTP 200 but with missing or malformed data.

### 3. Dead Letter Queue (Failed-Action Tracker)
Patrol cells that fail to be moved to or inspected are recorded in `failedActions` (a lightweight in-memory DLQ). The mission continues on a best-effort basis — a single failed cell does not abort the operation. At the end, all failed actions are reported so an operator can investigate.

### 4. Circuit Breaker Pattern
Implemented implicitly via the retry logic: after `maxAttempts` failures the error is thrown immediately rather than waiting on a permanently broken service. Permanent 4xx errors short-circuit retries entirely.

---

## Key API Discoveries

- **Dismount spawns on adjacent free tiles** — not on the transporter's position. Scouts are placed on the nearest available cell around the transporter.
- **Movement is synchronous** — despite the `"Move queued"` message, the unit is immediately at the destination when the next call is made.
- **Inspection results are in `getLogs()`** — the `inspect` response says "check logs for details"; actual text is in `logs[].msg` (not `logs[].message`).
- **Positive log field is `entry.field`** (not `entry.position`).
- **Partisan position is re-randomized on every `reset`** — always within one of the 14 `B3` tiles.

---

## File Structure

```
04_03_domatowo-solution/
├── app.js          # Main solution — autonomous rescue agent
├── package.json    # ES module config
└── README.md       # This file
```
