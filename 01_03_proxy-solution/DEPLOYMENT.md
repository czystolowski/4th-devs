# Deployment Guide

## Quick Start

1. **Install dependencies**
```bash
cd 01_03_proxy-solution
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env and add your AGENT_TOKEN
```

3. **Start the server**
```bash
npm start
```

4. **Expose publicly** (choose one method)

### Option A: ngrok (Recommended)
```bash
# Install ngrok from https://ngrok.com
ngrok http 3000
```
Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### Option B: pinggy (No installation)
```bash
ssh -p 443 -R0:localhost:3000 a.pinggy.io
```
Copy the URL from terminal output

### Option C: VPS/Cloud Server
Deploy to any server with Node.js and expose port 3000

## Testing Locally

```bash
# In another terminal
node test.js
```

## Submit to Hub

```bash
curl -X POST https://hub.ag3nts.org/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "YOUR_API_KEY",
    "task": "proxy",
    "answer": {
      "url": "https://your-public-url.com",
      "sessionID": "test-session-123"
    }
  }'
```

## Troubleshooting

### Server won't start
- Check if port 3000 is available: `lsof -i :3000`
- Verify AGENT_TOKEN is set in .env
- Check AI_API_KEY is configured in parent config.js

### AI not responding
- Verify API key is valid
- Check network connectivity
- Review logs for error messages

### Tool calls failing
- Verify AGENT_TOKEN has access to packages API
- Check package IDs are valid
- Review API response in logs

### ngrok connection issues
- Free tier has connection limits
- URL changes on restart
- Consider paid plan for stable URL

## Production Considerations

1. **Persistence**: Current implementation uses in-memory sessions. For production:
   - Add Redis or database for session storage
   - Implement session cleanup/expiry

2. **Security**:
   - Add rate limiting
   - Implement authentication
   - Use HTTPS in production

3. **Monitoring**:
   - Add logging service (e.g., Winston)
   - Monitor API usage and costs
   - Track session metrics

4. **Scaling**:
   - Use PM2 or similar for process management
   - Consider load balancer for multiple instances
   - Implement session sharing across instances