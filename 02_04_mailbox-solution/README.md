# Mailbox Search Solution

Solution for the "mailbox" task - finding information from Wiktor's emails in an active mailbox.

## Task Overview

Search a mailbox for emails from Wiktor (proton.me domain) and extract three pieces of information:
1. **password** - Password to employee system
2. **date** - Attack date on power plant (YYYY-MM-DD format)
3. **confirmation_code** - Security ticket confirmation code (SEC- + 32 chars)

## Solution Approaches

### 1. Agentic Approach (app.js)
Uses AI agent with function calling to search and extract information.

**Features:**
- Polls mailbox every 5 seconds until messages arrive
- AI agent with tools for searching and reading emails
- Automatic extraction using LLM
- Fallback to direct regex extraction if agent fails
- Handles OpenRouter API rate limits gracefully

**Run:**
```bash
node app.js
```

### 2. Simple Direct Approach (app-simple.js)
Direct search and regex-based extraction without AI.

**Features:**
- Multiple search strategies (from:proton.me, Wiktor, security, password)
- Regex patterns for extracting password, date, and confirmation code
- Fast and doesn't require AI API calls
- Good for debugging and understanding the data

**Run:**
```bash
node app-simple.js
```

### 3. Polling Approach (app-poll.js)
Continuous polling with direct extraction.

**Features:**
- Polls every 5 seconds for up to 2.5 minutes
- Multiple search queries to catch all relevant emails
- Direct regex extraction
- Automatic verification when all data found

**Run:**
```bash
node app-poll.js
```

## Project Structure

```
02_04_mailbox-solution/
├── app.js              # Main agentic solution with polling
├── app-simple.js       # Simple direct extraction
├── app-poll.js         # Polling version
├── package.json        # Node.js configuration
├── src/
│   ├── config.js       # Task configuration
│   ├── agent.js        # AI agent logic with tools
│   └── helpers/
│       ├── zmail.js    # ZMail API client
│       └── logger.js   # Logging utilities
```

## API Usage

### ZMail API Actions

- `help` - Get available actions
- `getInbox` - List inbox threads
- `search` - Search with Gmail-like operators
- `getMessages` - Get full message content by ID

### Search Operators

- `from:proton.me` - Emails from specific domain
- `subject:security` - Subject contains keyword
- `OR` / `AND` - Combine queries
- `"exact phrase"` - Exact match

## Extraction Patterns

### Password
```regex
/(?:password|hasło|pass|pwd)[\s:=]+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+)/i
```

### Date (YYYY-MM-DD)
```regex
/\b(20\d{2}-\d{2}-\d{2})\b/
```

### Confirmation Code (SEC- + 32 chars)
```regex
/\b(SEC-[A-Za-z0-9]{32})\b/
```

## Notes

- Mailbox is described as "active" - messages may arrive during execution
- Polling is necessary as mailbox starts empty
- Multiple search strategies increase chances of finding all information
- Direct extraction is more reliable than AI when API limits are hit
- All three values must be found before verification

### API Response Format

**Important:** The ZMail API returns data in a specific format:
- Search results: `{ items: [...] }` (NOT `messages`)
- Message content: `{ items: [{ message: "...", ... }] }` (content in `message` field, NOT `body`)
- Each item has `rowID` as the unique identifier

The solution has been updated to handle these formats correctly.

## Environment Variables

Required in `.env`:
- `AGENT_TOKEN` - Hub API key for ZMail and verification
- `OPENROUTER_API_KEY` or `OPENAI_API_KEY` - For AI agent (optional for direct approaches)