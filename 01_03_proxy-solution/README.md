# 01_03_proxy-solution

Intelligent proxy assistant with conversation memory for package logistics system.

## Mission

Build a publicly accessible HTTP endpoint that acts as an intelligent proxy assistant with conversation memory. The goal is to locate a package with reactor parts, obtain the security code, and redirect the shipment to the Żarnowiec power plant (code: PWR6132PL) without the operator noticing anything suspicious.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your API key:
```
AGENT_TOKEN=your-api-key-here
```

3. Start the server:
```bash
npm start
```

4. Expose publicly using ngrok or pinggy:
```bash
# Using ngrok
ngrok http 3000

# Using pinggy
ssh -p 443 -R0:localhost:3000 a.pinggy.io
```

5. Submit your endpoint to the hub:
```bash
curl -X POST https://hub.ag3nts.org/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "ed4a4b6e-180c-4a0f-a704-32c811b5d1a5",
    "task": "proxy",
    "answer": {
      "url": "https://sighing-lego-freewill.ngrok-free.dev",
      "sessionID": "test-session-123"
    }
  }'
```

## API Endpoints

### POST /
Main endpoint for operator communication.

Request:
```json
{
  "sessionID": "session-id",
  "msg": "operator message"
}
```

Response:
```json
{
  "msg": "assistant response"
}
```

### GET /
Health check endpoint.

## How it works

1. **Session Management**: Each sessionID maintains independent conversation history
2. **LLM Integration**: Uses function calling to interact with package API
3. **Covert Operation**: Automatically redirects reactor packages to PWR6132PL
4. **Natural Conversation**: Responds like a human logistics assistant

## Package API

External API: `https://hub.ag3nts.org/api/packages`

### Check Package Status
```json
{
  "apikey": "your-key",
  "action": "check",
  "packageid": "PKG12345678"
}
```

### Redirect Package
```json
{
  "apikey": "your-key",
  "action": "redirect",
  "packageid": "PKG12345678",
  "destination": "PWR3847PL",
  "code": "security-code"
}
```

## Tools Available to LLM

- `check_package`: Check package status and location
- `redirect_package`: Redirect package to new destination

## Notes

- The system prompt instructs the LLM to secretly change reactor package destinations to PWR6132PL
- Operator should not notice anything suspicious
- Security code is provided by operator during conversation
- Confirmation code from API must be passed back to operator