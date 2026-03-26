# 01_01_people-solution

CSV people data processor with filtering and structured outputs using AI.

## Features

- Downloads CSV files from URLs
- Handles UTF-8 encoding and special characters
- Uses AI to extract and structure person data
- Supports filtering by:
  - Gender (M/F)
  - Age range
  - Birth place/city
  - Specializations (IT, transport, edukacja, medycyna, praca z ludźmi, praca z pojazdami, praca fizyczna)
- Handles multiple specializations per person
- Outputs structured JSON format

## Concepts Used

This solution combines concepts from:
- **01_01_interaction**: Multi-turn AI conversations for data enrichment
- **01_01_structured**: JSON schema for structured outputs
- **01_01_grounding**: Pipeline processing and data extraction

## Setup

1. Ensure you have Node.js 24+ installed
2. Create a `.env` file in the root directory (one level up) with your API key:
   ```
   OPENAI_API_KEY=sk-...
   # or
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

## Usage

### Run the example (no API calls required)
```bash
npm run example
```

### Process CSV from URL (requires API key)
```bash
npm start -- --url https://example.com/people.csv
```

Or with specialization enrichment:
```bash
npm start -- --url https://example.com/people.csv --enrich
```

## Output Format

```json
[
  {
    "name": "Jan",
    "surname": "Kowalski",
    "gender": "M",
    "born": 1987,
    "city": "Warszawa",
    "tags": ["IT", "praca z ludźmi"]
  }
]
```

## Filtering Examples

The solution provides a `PeopleDatabase` class with filtering methods:

```javascript
// Filter by gender
const males = db.filterByGender('M');

// Filter by age range
const adults = db.filterByAge(25, 40);

// Filter by city
const fromWarsaw = db.filterByCity('Warszawa');

// Filter by specialization
const itPeople = db.filterBySpecialization('IT');

// Chain filters
const result = db
  .filterByGender('M')
  .filterByAge(30, 50)
  .filterBySpecialization('IT');

## Project Structure

```
01_01_people-solution/
├── app.js              # Main application (CSV download & processing)
├── app-v2.js           # Enhanced version with retry logic
├── submit.js           # Direct submission script
├── analyze.js          # Data analysis tool
├── example.js          # Example usage with sample data
├── test-csv.js         # CSV parsing tests
├── helpers.js          # Utility functions (CSV, encoding, dates)
├── schema.js           # JSON schemas for structured outputs
├── database.js         # PeopleDatabase class with filtering
├── sample-data.csv     # Sample CSV file for testing
├── package.json        # Project configuration
└── README.md           # This file
```

## Key Features Explained

### UTF-8 Encoding
The [`downloadCSV()`](helpers.js:27) function handles encoding automatically:
- Tries UTF-8 first
- Falls back to ISO-8859-1 (Latin-1) for Polish characters
- Normalizes special characters (≈, ö, etc.)

### Structured Outputs
Uses JSON schemas ([`schema.js`](schema.js)) to ensure consistent data format:
- Validates gender (M/F)
- Extracts birth year from various date formats
- Enforces allowed specializations

### AI Processing Pipeline
The main application files ([`app.js`](app.js), [`app-v2.js`](app-v2.js)):
- Process CSV rows into structured person objects
- Use AI to deduce specialization tags from job descriptions
- Handle batch processing with retry logic to avoid rate limits

### Filtering & Querying
The [`PeopleDatabase`](database.js) class provides:
- Gender filtering
- Age range filtering
- City filtering
- Specialization filtering (single or multiple)
- Search by name
- Chainable filters
- Statistics and aggregations