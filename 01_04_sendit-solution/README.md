# 01_04_sendit-solution

AI-powered solution for the SPK (System Przesyłek Konduktorskich) declaration submission task. This solution combines lessons from previous 01_04_* repositories to automatically analyze documentation and determine correct declaration values.

## Task Overview

Submit a properly filled transport declaration to the Central Hub for the Conductor Shipment System. The declaration must pass both human and automated verification.

## Requirements

- **Budget**: 0 PP (free shipment or System-funded)
- **Route**: Gdańsk to Żarnowiec
- **Sender ID**: 450202122 (fake but valid)
- **Weight**: 2.8 tons (2800 kg)
- **Content**: Reactor fuel cassettes
- **Special notes**: None (to avoid manual verification)

## Solution Architecture

### Key Innovation: AI-Powered Documentation Analysis

Unlike a hardcoded solution, this implementation uses AI to:

1. **Fetch Documentation** - Downloads all relevant SPK documentation files
2. **Vision Analysis** - Uses GPT-4 Vision to analyze the blocked routes image
3. **Text Analysis** - Processes markdown documentation to extract rules
4. **Intelligent Decision Making** - Uses AI to determine:
   - Correct shipment category based on content description
   - Number of additional wagons needed for the weight
   - Appropriate route code considering blocked routes
   - Total cost calculation following SPK rules

### Lessons Combined

This solution integrates concepts from:

- **01_04_image_recognition** - Vision API for analyzing route images
- **01_04_reports** - Document processing and analysis
- **01_04_json_image** - Structured data extraction from images
- **01_01_people-solution** - Batch processing and API integration
- **01_02_findhim-solution** - Multi-step data gathering and analysis

## Project Structure

```
01_04_sendit-solution/
├── app.js                 # Main application orchestrator
├── src/
│   ├── api.js            # API clients (OpenAI, Hub)
│   └── analyzer.js       # AI-powered documentation analysis
├── package.json          # Dependencies
├── README.md            # Documentation
└── .gitignore           # Git exclusions
```

## How It Works

### Step 1: Documentation Fetching
```javascript
// Fetches from hub.ag3nts.org/dane/doc/
- index.md (main documentation)
- zalacznik-E.md (declaration template)
- dodatkowe-wagony.md (wagon calculations)
- zalacznik-F.md (network map)
- trasy-wylaczone.png (blocked routes image)
```

### Step 2: AI Analysis

**Category Determination**
```javascript
analyzeImage() + callOpenAI()
→ "kasety z paliwem do reaktora" 
→ Category A (Strategic)
→ 0 PP cost, can use blocked routes
```

**Wagon Calculation**
```javascript
callOpenAI() with weight and documentation
→ 2800 kg needs 1800 kg additional capacity
→ 1800 / 500 = 3.6 → 4 additional wagons
→ WDP = 4
```

**Route Determination**
```javascript
analyzeImage() for blocked routes
+ callOpenAI() with network map
→ X-01 (Gdańsk - Żarnowiec)
→ Blocked but accessible for Category A/B
```

**Cost Calculation**
```javascript
callOpenAI() with category, weight, route
→ Category A = System-funded
→ Total: 0 PP
```

### Step 3: Declaration Building

Uses analyzed data to fill the template:
```
KATEGORIA PRZESYŁKI: A
TRASA: X-01
WDP: 4
KWOTA DO ZAPŁATY: 0 PP
```

### Step 4: Submission

Submits to `https://hub.ag3nts.org/verify` and extracts flag.

## Usage

```bash
# Install dependencies
npm install

# Run the solution
npm start
```

## Output

The script generates:
- `declaration.txt` - The formatted declaration
- `analysis-report.json` - Detailed AI analysis results
- Console output with step-by-step progress

## Key Insights

### Why Category A?

The AI correctly identifies that "kasety z paliwem do reaktora" (reactor fuel cassettes) are strategic materials, qualifying for Category A which:
- Costs 0 PP (System-funded) ✓ Meets budget requirement
- Can use blocked routes ✓ Allows X-01 usage
- Gets free additional wagons ✓ No extra charges

### Why WDP = 4?

- Standard train: 1000 kg capacity (2 wagons × 500 kg)
- Required: 2800 kg
- Additional needed: 1800 kg
- Additional wagons: 1800 / 500 = 3.6 → 4 wagons
- WDP field = additional wagons (not total)

### Why Route X-01?

- Direct route from Gdańsk to Żarnowiec
- Blocked by Dyrektywa Specjalna 7.7
- Exception: Categories A and B can use it
- Task hint: "Don't worry about the closed route"

## API Keys Required

- `AGENT_TOKEN` - Hub authentication
- `OPENAI_API_KEY` - For GPT-4 and Vision API

## Dependencies

```json
{
  "dotenv": "^16.0.0"
}
```

## Result

Successfully submitted declaration and received flag: **{FLG:WISDOM}**

## License

MIT