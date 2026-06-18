# Deep Search Service

Standalone microservice for deep web searching with Puppeteer browser automation.

## Features

- **Puppeteer Automation**: Modern browser automation with session persistence
- **No Database**: All configuration comes from API requests
- **Session Management**: File-based session persistence (cookies, storage)
- **API Key Authentication**: Secure inter-service communication
- **Rate Limiting**: Per-origin and global rate limits
- **Request Validation**: Input validation and SSRF prevention
- **Security Headers**: HTTP security headers
- **Health Checks**: Monitor service and session status

## Stack

- Node.js 20+
- TypeScript
- Express
- Puppeteer (browser automation)
- Cheerio (HTML parsing)
- OpenAI (for Servitractor/Retrotrac parsing)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
API_KEY=your-secret-api-key-here
PORT=3001
OPENAI_API_KEY=your-openai-api-key
PUPPETEER_HEADLESS=true
```

### 3. Build

```bash
npm run build
```

### 4. Start

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### POST /search

Search a single source. Accepts full endpoint configuration in request body.

**Headers:**
```
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reference": "1R0750",
  "originCode": "RETROTRAC",
  "originName": "Retrotrac",
  "url": "https://tiendab2b.retrotrac.com/home",
  "method": "GET",
  "requiresLogin": true,
  "loginUrl": "https://tiendab2b.retrotrac.com/login",
  "loginUsername": "comercial3@ciparcol.com",
  "loginPassword": "CIPARCOL4",
  "loginSteps": [
    {
      "type": "goto",
      "url": "https://tiendab2b.retrotrac.com/login",
      "options": { "waitUntil": "domcontentloaded", "timeout": 60000 }
    },
    {
      "type": "fill",
      "selector": "input[type='email']",
      "value": "{{username}}"
    }
  ],
  "timeoutMs": 120000,
  "waitForSelector": "main",
  "parserConfig": { "type": "html" }
}
```

**Response:**
```json
{
  "success": true,
  "originCode": "RETROTRAC",
  "originName": "Retrotrac",
  "products": [...],
  "productCount": 5,
  "metadata": {}
}
```

### GET /health

Health check with Puppeteer session status.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 1234.56,
  "timestamp": "2025-01-08T10:00:00.000Z",
  "puppeteer": {
    "sessions": 2,
    "sessionFiles": ["retrotrac-session.json", "servitractor-session.json"]
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | Secret key for API authentication | Required |
| `PORT` | Service port | `3001` |
| `HOST` | Host to bind to | `0.0.0.0` |
| `OPENAI_API_KEY` | OpenAI API key (for Servitractor/Retrotrac) | Optional |
| `PUPPETEER_HEADLESS` | Run browser in headless mode | `true` |
| `NEXTJS_API_ORIGIN` | CORS origin for Next.js | `*` |

## Architecture

- **No Database**: All endpoint configuration comes from API requests
- **Stateless Service**: Each request is independent
- **Session Persistence**: Browser sessions saved to `.puppeteer-sessions/`
- **Step Execution**: Supports `goto`, `fill`, `click`, `wait`, `press` steps
- **Iframe Support**: Handles iframes (e.g., Zoho in Servitractor)

## Development

```bash
# Development mode with auto-reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

## Docker

```bash
docker build -t deep-search-service .
docker run -p 3001:3001 --env-file .env deep-search-service
```

## Security

- API key authentication required
- Request validation and sanitization
- URL allowlist (SSRF prevention)
- Rate limiting (per origin + global)
- Security headers
- Sensitive data masking in logs

## See Also

- `START.md` - Detailed startup instructions
- `QUICKSTART.md` - Quick reference guide
- `SETUP_CHECKLIST.md` - Setup checklist
- `VISIBLE_BROWSER_SETUP.md` - Running with visible browser
