# S05E01 — Radio Monitoring

**Task:** `radiomonitoring` | **Flag:** `{FLG:GOODMORNINGZION}`

Intercept and analyse radio signals from a listening post to locate the hidden city codenamed **"Syjon"**, then transmit a final intelligence report to the hub.

## Solution

| Field | Value |
|---|---|
| `cityName` | `Skarszewy` |
| `cityArea` | `10.73` km² |
| `warehousesCount` | `11` |
| `phoneNumber` | `644122092` |

## Running

```bash
cd 05_01_radiomonitoring-solution
node app.js
```

Requires `AGENT_TOKEN` in root `.env`.

### API key requirements

| Scenario | Works? | Notes |
|---|---|---|
| `OPENAI_API_KEY` set | ✅ Full | Whisper used for audio; vision via OpenRouter or OpenAI |
| `OPENROUTER_API_KEY` + balance ≥ $0.50 | ✅ Full | Gemini Flash used for audio transcription |
| `OPENROUTER_API_KEY` + balance < $0.50 | ⚠️ Partial | Audio skipped with a warning; all other signals analysed |

**Audio transcription matters** — the warehouse count is only mentioned in the MP3 signal.
Without audio transcription the `warehousesCount` field will be `null` and the final submit will fail.

### Changing the audio model

In [`src/analyze.js`](src/analyze.js) the default OpenRouter audio model is `google/gemini-2.5-flash-lite` (~$0.002/min). To use a more capable model swap the commented line:

```js
const AUDIO_MODEL_OPENROUTER = 'google/gemini-2.5-flash-lite';
// const AUDIO_MODEL_OPENROUTER = 'google/gemini-2.5-flash';   // more accurate
```

## Architecture

```
start session
     │
     ▼
listen loop (up to 200 signals)
     │
     ├─ transcription field        → TEXT corpus
     ├─ attachment text/xml|csv    → decoded locally → TEXT corpus
     ├─ attachment application/json→ decoded locally → TEXT corpus
     ├─ attachment image/png|jpeg  → vision model (gpt-4o) → description → TEXT corpus
     ├─ attachment audio/mpeg      → Whisper / Gemini → transcript → TEXT corpus
     │                               (or warning if no key/balance)
     └─ other / noise              → discarded
     │
     ▼
single gpt-4o call over full corpus → extract 4 fields as JSON
     │
     ▼
transmit report → {FLG:...}
```

### Signal types in this task

| Signal | Type | Content |
|---|---|---|
| Transcriptions | TEXT | Radio chatter, trading lists, city gossip |
| `text/csv` | TEXT | Market board — lists `Syjon` as a trader |
| `application/json` | JSON | City stats: coordinates, `occupiedArea`, `riverAccess`, `farmAnimals` |
| `text/xml` | TEXT | Decoy — destroyed city archive (`trainingData="true"`) |
| `image/jpeg` | IMAGE → vision | Irrelevant meme — discarded by LLM |
| `image/png` | IMAGE → vision | **Key:** handwritten note "Jacek Kramer – 644-122-092, noclegi na Syjonie" |
| `audio/mpeg` | AUDIO → Whisper/Gemini | **Key:** *"planujemy wybudować dwunasty magazyn"* → 11 warehouses |

### How "Syjon" was identified

1. The JSON city list has no entry named "Syjon" — it was erased from the map.
2. Only **Skarszewy** and Drohiczyn have both `riverAccess: true` and `farmAnimals: true`.
3. Text signals describe Skarszewy as *"Miasto ocalałych"* with fertile land, cattle and river access — matching the task brief.
4. The CSV trading board lists `Syjon` and `Skarszewy` as separate entries, but this reflects two different trade offers from the same city (cattle vs. beef).

### Key design decisions

- **Binary → decode locally first** — `text/xml`, `application/json`, `text/csv` decoded without any LLM tokens.
- **MIME-based routing** eliminates ~30% of signals as noise at zero API cost.
- **Single batch extraction** at the end instead of 30+ per-signal LLM calls.
- **Chat Completions for vision** (not Responses API) — better OpenRouter `image_url` compatibility.
- **Graceful audio degradation** — if neither Whisper nor a funded OpenRouter account is available, the pipeline continues and warns rather than crashing; only the final submit will fail due to the missing warehouse count.
