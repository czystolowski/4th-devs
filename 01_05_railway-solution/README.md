# 01_05_railway-solution

Activate railway route X-01 via self-documenting API with automatic retry and rate limiting.

## Task Overview

The API has no documentation except for a `help` action that returns its own documentation. The system:
- Regularly returns 503 errors (simulated overload)
- Has very restrictive rate limits
- Requires following exact action sequences

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure `AGENT_TOKEN` is set in root `.env` file

3. Run:
```bash
npm start
```

## How It Works

1. **Fetch Documentation**: Call `help` action to get API documentation
2. **Parse Actions**: Extract available actions, parameters, and sequence
3. **Execute Sequence**: Follow the documented steps to activate route X-01
4. **Handle Errors**: Automatically retry on 503, respect rate limits
5. **Extract Flag**: Look for `{FLG:...}` in responses

## Key Features

- **Automatic 503 Retry**: Exponential backoff for server overload
- **Rate Limit Handling**: Monitors HTTP headers and waits for reset
- **Comprehensive Logging**: Every request/response logged for debugging
- **Self-Documenting**: No hardcoded actions - follows API documentation

## API Endpoint

```
POST https://hub.ag3nts.org/verify
```

### Help Action
```json
{
  "apikey": "your-key",
  "task": "railway",
  "answer": {
    "action": "help"
  }
}
```

## Notes

- The API is intentionally difficult - patience required
- 503 errors are part of the challenge, not real failures
- Rate limits are very strict - respect them
- Model choice matters - fewer API calls = better success rate