# S04E05 – Food Warehouse Solution

**Flag:** `{FLG:JUSTEATIT}`

## Task Summary

Automate the food distribution system to create one order per city from `food4cities.json`, properly signed and addressed to the correct warehouse destination code, then call `done` to release the flag.

## Key Concepts Applied

- **API orchestration** — coordinate 4 distinct tools (database, signatureGenerator, orders, done) in the correct sequence
- **SQLite read-only queries** — discover schema, paginate results, resolve city→destination_id mappings
- **SHA1 signature generation** — each order requires a deterministic signature based on `login + birthday + destination_id`
- **Role-based access** — only users with `role=2` ("Obsługa transportów") may create orders
- **Rate-limit handling** — exponential backoff retry pattern for the `/verify` endpoint

## Architecture

```
food4cities.json ──► city list + item requirements
        │
        ▼
SQLite DB (read-only)
  destinations table ──► city name → destination_id (numeric)
  users table        ──► find creator with role=2
        │
        ▼
signatureGenerator  ──► SHA1(login + birthday + destination)
        │
        ▼
orders API
  reset   ──► clean state
  delete  ──► remove pre-existing seeded orders
  create  ──► one order per city (with creatorID + destination + signature)
  append  ──► batch-add all required items
        │
        ▼
done    ──► final validation → flag
```

## Data Mapping

| City       | destination_id | Items                                                   |
|------------|---------------|---------------------------------------------------------|
| Opalino    | 991828        | chleb×45, woda×120, mlotek×6                            |
| Domatowo   | 761834        | makaron×60, woda×150, lopata×8                          |
| Brudzewo   | 234434        | ryz×55, woda×140, wiertarka×5                           |
| Darzlubie  | 676323        | wolowina×25, woda×130, kilof×7                          |
| Celbowo    | 741906        | kurczak×40, woda×125, mlotek×6                          |
| Mechowo    | 695992        | ziemniaki×100, kapusta×70, marchew×65, woda×165, lopata×9 |
| Puck       | 140606        | chleb×50, ryz×45, woda×175, wiertarka×7                 |
| Karlinkowo | 707536        | makaron×52, wolowina×22, ziemniaki×95, woda×155, kilof×6 |

**Creator used:** `tgajewski` (user_id=2, role=2 "Obsługa transportów", birthday=1991-04-06)

## Gotchas Discovered

1. **API response codes differ from docs** — `create` returns `110` (not `102`), `append` returns `120` (not `103`)
2. **Creator role matters** — must be `role=2` ("Obsługa transportów"); using another role returns error `-652`
3. **Pre-existing seeded orders** — after `reset`, 4 orders for other cities remain and must be deleted before calling `done`
4. **Rate limiting** — the API enforces a request rate limit (code `-9999`); use exponential backoff retry

## Running

```bash
cd 04_05_foodwarehouse-solution
node app.js
```

Requires `AGENT_TOKEN` in the root `.env` file.
