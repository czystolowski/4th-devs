# S04E01 — OKO Editor

Cover up the Skolwin rocket incident by making three precise edits to the **OKO operational monitoring centre** — using the hub backend API only (web UI is read-only; touching it would alert operators).

## Task summary

| # | Change | Location | What |
|---|--------|----------|------|
| 1 | Reclassify incident | `incydenty` | MOVE03 (vehicle+human) → MOVE04 (animals) |
| 2 | Close task | `zadania` | mark `done=YES`, update description to mention beavers |
| 3 | Decoy incident | `incydenty` | replace spare entry with MOVE01 (humans near Komarowo) |

## Incident code reference

From the OKO operator note *"Metody kodowania incydentów"*:

| Code   | Meaning |
|--------|---------|
| MOVE01 | Human movement detected |
| MOVE02 | Vehicle detected |
| MOVE03 | Vehicle + human detected |
| MOVE04 | Animals detected |
| RECO01 | Weapons found |
| RECO02 | Provisions found |
| RECO03 | Vehicle found |
| RECO04 | Other reconnaissance |
| PROB01 | Radio signal sample |
| PROB02 | Internet traffic sample |
| PROB03 | Physical media sample |

Codes are always 6 characters: first 4 = type, last 2 = subtype.

## OKO credentials

| Field      | Value |
|------------|-------|
| Panel      | https://oko.ag3nts.org/ |
| Login      | Zofia |
| Password   | Zofia2026! |
| Access key | `AGENT_TOKEN` from `.env` |

> The web panel is used **read-only** for inspection. All mutations go through `https://hub.ag3nts.org/verify`.

## Hub API (okoeditor)

### `help`
```json
{ "apikey": "…", "task": "okoeditor", "answer": { "action": "help" } }
```

### `update`
```json
{
  "apikey": "…",
  "task": "okoeditor",
  "answer": {
    "action": "update",
    "page": "incydenty | notatki | zadania",
    "id": "<32-char hex>",
    "title": "optional new title",
    "content": "optional new description",
    "done": "YES | NO  (zadania only)"
  }
}
```

Rules:
- `id` must match an existing record on `page`
- At least one of `title` or `content` must be present
- `done` is accepted only for page `zadania`
- Page `uzytkownicy` is read-only

### `done`
```json
{ "apikey": "…", "task": "okoeditor", "answer": { "action": "done" } }
```

Returns the flag when all three conditions are satisfied.

## Project structure

```
04_01_okoeditor-solution/
├── app.js                      Entry point — orchestrates all six steps
├── package.json
├── README.md
└── src/
    ├── edits.js                Three named edit operations + stable IDs
    ├── oko.js                  Read-only OKO web-panel client (login, list, detail)
    └── helpers/
        └── api.js              Hub API wrapper (updateEntry, submitDone, fetchHelp)
```

## Running

```bash
# From this directory:
node app.js

# Or from project root:
cd 04_01_okoeditor-solution && node app.js
```

Requires `AGENT_TOKEN` in the root `.env` file.

## Expected output

```
🕵️  OKO Editor — S04E01
====================================================

🔐 Step 1: Logging in to OKO operator panel…
  ✓ Session established

  Current incidents (6 total):
    [380792b2…] MOVE04 Aktywność zwierząt nieopodal miasta Skolwin ← SKOLWIN
    ...

📋 Step 2: Reading incident-code classification table…
  ✓ MOVE - wykryto ruch 01 człowiek 02 pojazd 03 pojazd + człowiek 04 zwierzęta

✏️  Step 3: Reclassifying Skolwin incident → MOVE04 (animals)…
  ✓ code 110 — Entry updated successfully.

✅ Step 4: Marking Skolwin task as done (beavers observed)…
  ✓ code 110 — Entry updated successfully.

🏚️  Step 5: Inserting Komarowo human-movement decoy (MOVE01)…
  ✓ code 110 — Entry updated successfully.

📤 Step 6: Submitting "done" to the hub…

🚩 FLAG: {FLG:NEWREALITY}
✅ Mission accomplished — Skolwin is safe!
```
