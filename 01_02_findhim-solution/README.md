# Find Him Solution (S01E02)

This solution identifies which suspect from S01E01 was near a nuclear power plant by analyzing location data and determining their access level.

## Task Overview

Find the suspect who was closest to a nuclear power plant by:
1. Loading suspects from the previous task (S01E01)
2. Fetching power plant locations from the API
3. Checking each suspect's location history
4. Calculating distances to power plants using Haversine formula
5. Identifying the closest suspect
6. Fetching their access level
7. Submitting the answer

## Prerequisites

- Node.js 24+
- Completed S01E01 task (suspects list in `../01_01_people-solution/output.json`)
- `.env` file in project root with `AGENT_TOKEN`

## Usage

```bash
npm start
```

## Solution Architecture

### Files

- **app.js** - Main application logic and workflow
- **helpers.js** - Utility functions:
  - `calculateDistance()` - Haversine formula for geographic distance
  - `fetchPowerPlants()` - Get power plant locations
  - `fetchPersonLocations()` - Get person's location history
  - `fetchAccessLevel()` - Get person's access level
  - `findClosestPowerPlant()` - Find nearest power plant to locations
  - `processSuspectsInBatches()` - Batch processing with rate limiting
- **submit.js** - Answer submission to verification endpoint
- **package.json** - Project configuration

### API Endpoints Used

1. **Power Plants**: `GET https://hub.ag3nts.org/data/{apikey}/findhim_locations.json`
2. **Person Locations**: `POST https://hub.ag3nts.org/api/location`
3. **Access Level**: `POST https://hub.ag3nts.org/api/accesslevel`
4. **Verification**: `POST https://hub.ag3nts.org/verify`

### Algorithm

1. Load suspects from S01E01 (males, 20-40 years old, from Grudziądz, transport specialization)
2. Fetch all power plant locations with coordinates
3. For each suspect:
   - Fetch their location history (coordinates)
   - Calculate distance to each power plant using Haversine formula
   - Track the minimum distance
4. Identify the suspect with the smallest distance to any power plant
5. Fetch that suspect's access level using their birth year
6. Submit answer with: name, surname, accessLevel, powerPlant code

### Output Format

```json
{
  "name": "FirstName",
  "surname": "LastName",
  "accessLevel": 3,
  "powerPlant": "PWR1234PL"
}
```

## Key Concepts

- **Haversine Formula**: Calculates great-circle distance between two points on a sphere
- **Batch Processing**: Processes suspects in batches to avoid API rate limits
- **Distance Optimization**: Finds minimum distance across all location-powerplant pairs
- **Data Pipeline**: Chains multiple API calls to build complete answer

## Notes

- The solution uses the Haversine formula for accurate geographic distance calculation
- Batch processing with delays prevents API rate limiting
- All distances are calculated in kilometers
- The suspect with the minimum distance to any power plant is selected