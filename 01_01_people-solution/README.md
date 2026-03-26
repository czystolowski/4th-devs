# 01_01_people-solution

CSV people data processor with AI-powered specialization tagging and advanced filtering capabilities.

## Overview

This solution processes CSV data containing people information, uses AI to deduce professional specializations from job descriptions, and provides powerful filtering capabilities. It combines concepts from three foundational repositories to create a complete data processing pipeline.

## Features

- **CSV Processing**: Downloads and parses CSV files with UTF-8/ISO-8859-1 encoding support
- **AI-Powered Tagging**: Uses AI to deduce specializations from job descriptions
- **Advanced Filtering**: Filter by gender, age range, city, and specializations
- **Batch Processing**: Handles large datasets with rate limiting and retry logic
- **Structured Output**: Produces clean JSON format ready for API submission

## Concepts Used

This solution combines concepts from:
- **01_01_interaction**: Multi-turn AI conversations for data enrichment
- **01_01_structured**: JSON schema validation for structured outputs
- **01_01_grounding**: Pipeline processing and data extraction patterns

## Setup

1. Ensure Node.js 24+ is installed
2. Configure your API key in the root `config.js` file
3. Set your `AGENT_TOKEN` in the root `config.js`

## Usage

### Run the complete pipeline
```bash
node app.js
```

This will:
1. Download CSV from the configured URL
2. Parse and structure the data
3. Filter by criteria (males, age 20-40, from Grudziądz)
4. Use AI to deduce specialization tags
5. Filter by transport specialization
6. Submit results to the verification endpoint

### Submit existing results
```bash
node submit.js
```

Submits the `output.json` file to the verification endpoint.

## Project Structure

```
01_01_people-solution/
├── app.js          # Main application pipeline
├── submit.js       # Submission utility (standalone or imported)
├── helpers.js      # CSV parsing, encoding, date extraction
├── database.js     # PeopleDatabase class with filtering
├── schema.js       # JSON schemas for AI responses
├── package.json    # Dependencies and scripts
└── README.md       # Documentation
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
    "tags": ["transport", "praca z pojazdami"]
  }
]
```

## Allowed Specializations

- `IT` - Technology, programming, software engineering
- `transport` - Logistics, freight, delivery, warehousing
- `edukacja` - Teaching, training, education
- `medycyna` - Healthcare, medicine, diagnostics, pharmacy
- `praca z ludźmi` - Customer service, HR, consulting, sales
- `praca z pojazdami` - Vehicle operation, repair, maintenance
- `praca fizyczna` - Manual labor, construction, production

## Key Components

### CSV Processing ([`helpers.js`](helpers.js))
- [`downloadCSV()`](helpers.js:27) - Downloads with encoding detection
- [`parseCSV()`](helpers.js:48) - Parses comma-separated values with quoted fields
- [`extractBirthYear()`](helpers.js:116) - Handles YYYY-MM-DD and M/D/YY formats
- [`processPersonRow()`](helpers.js:141) - Converts CSV rows to structured objects

### Filtering ([`database.js`](database.js))
The [`PeopleDatabase`](database.js:4) class provides chainable filters:
```javascript
const db = new PeopleDatabase(people);

const result = db
  .filterByGender('M')
  .filterByAge(20, 40)
  .filterByCity('Grudziądz')
  .filterBySpecialization('transport');
```

### AI Processing ([`app.js`](app.js))
- [`deduceTagsFromJob()`](app.js:36) - Uses AI to extract specializations
- [`processPeopleWithTags()`](app.js:100) - Batch processing with rate limiting

### Submission ([`submit.js`](submit.js))
- [`submitAnswer()`](submit.js:11) - Submits results to verification endpoint
- Can be imported or run standalone

## Technical Details

### Encoding Handling
The solution handles Polish characters (ą, ć, ę, ł, ń, ó, ś, ź, ż) by:
1. Attempting UTF-8 decoding first
2. Falling back to ISO-8859-1 (Latin-1) if needed
3. Normalizing special characters (≈, ö, etc.)

### Date Parsing
Supports multiple date formats:
- `YYYY-MM-DD` (e.g., 1987-05-15)
- `M/D/YY` (e.g., 7/7/75)
- Handles 2-digit years with century inference

### Batch Processing
Processes people in batches of 11 with:
- Parallel AI requests within each batch
- 500ms delay between batches to avoid rate limits
- Error handling for individual failures

## License

MIT