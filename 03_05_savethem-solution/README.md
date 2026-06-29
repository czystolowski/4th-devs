# S03E05 — SaveThem Route Planner

Plan the optimal route for our envoy to reach the city of **Skolwin** and negotiate for wind turbine parts — without exposing the city's location via digital contact.

## Task summary

- Discover available hub tools via the **toolsearch** registry
- Fetch the 10×10 terrain map for Skolwin
- Fetch vehicle specifications (rocket, car, horse, walk)
- Read movement rules from the books archive
- Compute the cheapest feasible path with a BFS + resource-budget pruner
- Submit the answer to `/verify`

## Resources

| Resource | Budget |
|----------|--------|
| Fuel     | 10     |
| Food     | 10     |

## Vehicle catalogue

| Vehicle | Fuel/move | Food/move | Notes                             |
|---------|-----------|-----------|-----------------------------------|
| rocket  | 1.0       | 0.1       | +0.2 fuel on tree tiles; no water |
| car     | 0.7       | 1.0       | +0.2 fuel on tree tiles; no water |
| horse   | 0.0       | 1.6       | Can ford water; chosen at start   |
| walk    | 0.0       | 2.5       | Can ford water; default on dismount |

## Tile legend

| Symbol | Meaning                                  |
|--------|------------------------------------------|
| `.`    | Open ground — always passable            |
| `T`    | Trees — passable; +0.2 fuel for engines  |
| `R`    | Rocks — impassable for everyone          |
| `W`    | Water — only horse and walk can cross    |
| `S`    | Start position                           |
| `G`    | Goal (Skolwin)                           |

## Solution

The water band at column 6 blocks all powered vehicles from reaching the goal directly.
The optimal strategy is:

1. **Rocket** for 8 moves (including one tree tile) to reach `(row 4, col 5)` — fuel 8.2, food 0.8
2. **Dismount** → walk mode
3. **Walk** 3 tiles through water to the goal — food 7.5

Total: **fuel 8.2 / 10**, **food 8.3 / 10** ✅

```json
["rocket","up","up","up","right","right","right","right","right","dismount","right","right","right"]
```

## Project structure

```
03_05_savethem-solution/
├── app.js                  Entry point — orchestrates all steps
├── package.json
├── README.md
└── src/
    ├── tools.js            Dynamic tool discovery via toolsearch
    ├── map.js              Grid utilities + BFS pathfinder (pure)
    ├── planner.js          Route planner — evaluates all strategies
    └── helpers/
        └── api.js          Hub API wrapper (toolsearch, callTool, submitAnswer)
```

## Running

```bash
# From this directory:
node app.js

# Or from project root:
cd 03_05_savethem-solution && node app.js
```

Requires `AGENT_TOKEN` in the root `.env` file.
