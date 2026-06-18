# Payload Verification - loginSteps and searchSteps

## ✅ Verification Complete

### What Was Fixed

1. **Prisma Query**: Ensures all fields are fetched (including `loginSteps` and `searchSteps`)
2. **Payload Construction**: Explicitly includes `loginSteps` and `searchSteps` from Prisma schema
3. **JSON Serialization**: Properly serializes JSON fields from Prisma (which may be Prisma.JsonValue)
4. **Service Receiving**: Service now logs when it receives steps and passes them to the scraper
5. **Scraper Config**: All steps are passed to the Playwright worker

### Data Flow

```
1. Next.js API Route
   ↓
   Fetches endpoint from Prisma (ALL fields including loginSteps, searchSteps)
   ↓
   Builds payload with:
   - loginSteps: endpoint.loginSteps (from Prisma JSON field)
   - searchSteps: endpoint.searchSteps (from Prisma JSON field)
   ↓
   Sends to Deep Search Service

2. Deep Search Service
   ↓
   Receives payload with loginSteps and searchSteps
   ↓
   Logs steps count and types
   ↓
   Passes to browser pool.scrape()

3. Browser Pool → Worker Thread
   ↓
   Receives scrapeConfig with loginSteps and searchSteps
   ↓
   Executes steps in order:
   - loginSteps: For authentication
   - searchSteps: For searching (with {{reference}} replacement)
```

### Fields Sent to Service

All fields from `DeepWebEndpoint` Prisma model:
- ✅ `reference` - Search term
- ✅ `originCode` - Source identifier
- ✅ `originName` - Source name
- ✅ `url` - Search URL (with {{reference}} replaced)
- ✅ `method` - GET or POST
- ✅ `requiresLogin` - Boolean
- ✅ `loginUrl` - Login page URL
- ✅ `loginUsername` - Username
- ✅ `loginPassword` - Password
- ✅ `loginFormSelector` - Form selector
- ✅ `usernameField` - Username field selector
- ✅ `passwordField` - Password field selector
- ✅ **`loginSteps`** - Array of login steps from Prisma
- ✅ **`searchSteps`** - Array of search steps from Prisma
- ✅ `timeoutMs` - Timeout in milliseconds
- ✅ `retryAttempts` - Number of retries
- ✅ `waitForSelector` - Selector to wait for
- ✅ `parserConfig` - Parser configuration
- ✅ `token` - API token
- ✅ `tokenHeaderName` - Token header name
- ✅ `tokenPlacement` - Token placement (header/query/body)
- ✅ `requestBodyTemplate` - POST body template
- ✅ `cookies` - Cookie string

### Logging Added

**Next.js Side:**
- Logs payload structure before sending
- Shows if loginSteps/searchSteps are present and their counts

**Service Side:**
- Logs when steps are received
- Shows step counts and types
- Logs scrape config before execution

### Testing

To verify steps are being sent:

1. Check Next.js logs for:
   ```
   [DEEP-WEB-SINGLE] Sending to service: {
     hasLoginSteps: true,
     loginStepsCount: 5,
     hasSearchSteps: true,
     searchStepsCount: 3
   }
   ```

2. Check Service logs for:
   ```
   [DeepSearchService] Received loginSteps for AGROCOSTA: { count: 5, types: 'goto, fill, click, ...' }
   [DeepSearchService] Received searchSteps for AGROCOSTA: { count: 3, types: 'goto, fill, click' }
   ```

### Example loginSteps Format (from Prisma)

```json
[
  {
    "type": "goto",
    "url": "https://example.com/login"
  },
  {
    "type": "fill",
    "selector": "#username",
    "value": "{{username}}"
  },
  {
    "type": "fill",
    "selector": "#password",
    "value": "{{password}}"
  },
  {
    "type": "click",
    "selector": "button[type='submit']"
  },
  {
    "type": "wait",
    "options": {
      "timeout": 5000
    }
  }
]
```

### Example searchSteps Format (from Prisma)

```json
[
  {
    "type": "goto",
    "url": "https://example.com/search"
  },
  {
    "type": "fill",
    "selector": "#search-input",
    "value": "{{reference}}"
  },
  {
    "type": "click",
    "selector": "#search-button"
  },
  {
    "type": "wait",
    "selector": ".results",
    "options": {
      "timeout": 10000
    }
  }
]
```

### ✅ Confirmation

**All fields from Prisma schema are now being sent to the Deep Search Service, including:**
- ✅ `loginSteps` (JSON array from Prisma)
- ✅ `searchSteps` (JSON array from Prisma)

The service receives and uses these steps for browser automation.

