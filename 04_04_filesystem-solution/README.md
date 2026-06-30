# S04E04 — Filesystem: Natan's Trade Notes

**Task name:** `filesystem`  
**Flag:** `{FLG:DEALWITHIT}`

## Overview

The task is to parse three unstructured note files (`ogłoszenia.txt`, `rozmowy.txt`, `transakcje.txt`) and build a structured virtual filesystem via a remote API representing a post-apocalyptic inter-city trade network.

## Problem

Natan Rams, a trade coordinator from Domatowo, kept chaotic handwritten notes about:
- Which cities needed which goods (and how many)
- Which person was responsible for trade in each city
- What goods each city offered for sale (through barter transactions)

The goal is to reorganize this into a clean 3-directory structure consumable by agents.

## Filesystem Structure

```
/
├── miasta/          # City needs (JSON)
│   ├── opalino
│   ├── domatowo
│   ├── brudzewo
│   ├── darzlubie
│   ├── celbowo
│   ├── mechowo
│   ├── puck
│   └── karlinkowo
│
├── osoby/           # Trade representatives (name + city link)
│   ├── natan_rams
│   ├── iga_kapecka
│   ├── rafal_kisiel
│   ├── marta_frantz
│   ├── oskar_radtke
│   ├── eliza_redmann
│   ├── damian_kroll
│   └── lena_konkel
│
└── towary/          # Goods for sale (links to selling cities)
    ├── ryz
    ├── marchew
    ├── chleb
    ├── wolowina
    ├── kilof
    ├── wiertarka
    ├── maka
    ├── mlotki
    ├── makaron
    ├── kapusta
    ├── ziemniaki
    ├── kurczak
    └── lopata
```

## Data Extraction

### Source files

| File | Content |
|---|---|
| `ogłoszenia.txt` | Bulletin-board announcements listing each city's needs with quantities |
| `rozmowy.txt` | Natan's phone call diary — names of trade representatives per city |
| `transakcje.txt` | Barter ledger: `SellerCity -> good -> BuyerCity` |

### City needs (from `ogłoszenia.txt`)

| City | Needs |
|---|---|
| opalino | chleb×45, woda×120, mlotki×6 |
| domatowo | makaron×60, woda×150, lopaty×8 |
| brudzewo | ryz×55, woda×140, wiertarki×5 |
| darzlubie | wolowina×25, woda×130, kilofy×7 |
| celbowo | kurczak×40, woda×125, mlotki×6 |
| mechowo | ziemniaki×100, kapusta×70, marchew×65, woda×165, lopaty×9 |
| puck | chleb×50, ryz×45, woda×175, wiertarki×7 |
| karlinkowo | makaron×52, wolowina×22, ziemniaki×95, woda×155, kilofy×6 |

### Trade representatives (from `rozmowy.txt`)

| City | Person | File |
|---|---|---|
| domatowo | Natan Rams | `natan_rams` |
| opalino | Iga Kapecka | `iga_kapecka` |
| brudzewo | Rafal Kisiel | `rafal_kisiel` |
| darzlubie | Marta Frantz | `marta_frantz` |
| celbowo | Oskar Radtke | `oskar_radtke` |
| mechowo | Eliza Redmann | `eliza_redmann` |
| puck | Damian Kroll | `damian_kroll` |
| karlinkowo | Lena Konkel | `lena_konkel` |

### Goods for sale (from `transakcje.txt`)

| Good | Selling cities |
|---|---|
| ryz | darzlubie, opalino, karlinkowo |
| marchew | puck |
| chleb | domatowo, celbowo, brudzewo |
| wolowina | opalino |
| kilof | puck, mechowo, celbowo |
| wiertarka | karlinkowo, domatowo |
| maka | brudzewo, mechowo |
| mlotki | karlinkowo, mechowo |
| makaron | opalino |
| kapusta | celbowo |
| ziemniaki | domatowo, darzlubie |
| kurczak | darzlubie |
| lopata | brudzewo, puck |

## File Format Details

**`/miasta/<city>`** — JSON object, keys are goods, values are quantities (no units):
```json
{"chleb":45,"woda":120,"mlotki":6}
```

**`/osoby/<first_last>`** — Full name on line 1, then a markdown link to the city file:
```markdown
Iga Kapecka

[opalino](/miasta/opalino)
```

**`/towary/<good>`** — One markdown link per selling city:
```markdown
[darzlubie](/miasta/darzlubie)
[opalino](/miasta/opalino)
[karlinkowo](/miasta/karlinkowo)
```

## API Constraints

From the `help` response:
- `max_directory_name_length`: 30
- `max_file_name_length`: 20
- `max_directory_depth`: 3
- `allowed_name_pattern`: `^[a-z0-9_]+$` — **no Polish diacritics** in names
- `global_unique_names`: true — no two files/dirs can share a name across the whole tree

## Implementation

The solution is a single [`app.js`](./app.js) script using ES modules and the root `config.js` for `AGENT_TOKEN`.

**Key decisions:**
1. **Batch mode** — all 32 operations (3 dirs + 8 city files + 8 person files + 13 good files) sent in a single request after a separate `reset`
2. **Polish diacritics stripped** in all filenames (`ryż→ryz`, `wołowina→wolowina`, `mąka→maka`, `łopata→lopata`, `młotek→mlotki`)
3. Good names taken from raw transaction data, not normalized to strict singular (the system expected `mlotki` and `ziemniaki` despite the task saying "singular nominative")

## Running

```bash
cd 04_04_filesystem-solution
node app.js
```

Requires `AGENT_TOKEN` in the root `.env` file.
