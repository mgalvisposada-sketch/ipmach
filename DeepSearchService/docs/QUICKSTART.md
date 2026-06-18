# Deep Search Service - Quick Start Guide

## Prerequisites

- Node.js 20+
- npm or yarn

## Setup (3 Steps)

### 1. Install Dependencies

```bash
cd DeepSearchService
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

### 3. Build and Start

**Build:**
```bash
npm run build
```

**Start (Production):**
```bash
npm start
```

**Start (Development with auto-reload):**
```bash
npm run dev
```

## Verify Service is Running

1. **Check health endpoint:**
```bash
curl http://localhost:3001/health
```

2. **Test search endpoint:**
```bash
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -d '{
    "reference": "1R0750",
    "originCode": "RETROTRAC",
    "originName": "Retrotrac",
    "url": "https://tiendab2b.retrotrac.com/home",
    "method": "GET",
    "requiresLogin": true,
    "loginUrl": "https://tiendab2b.retrotrac.com/login",
    "loginUsername": "comercial3@ciparcol.com",
    "loginPassword": "CIPARCOL4",
    "loginSteps": [...],
    "timeoutMs": 120000,
    "waitForSelector": "main",
    "parserConfig": {"type": "html"}
  }'
```

## Common Issues

### Port already in use
**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:** Change `PORT` in `.env` or stop the process using port 3001.

### API Key authentication fails
**Error:** `Invalid API key`

**Solution:** Ensure `API_KEY` in `.env` matches `DEEP_SEARCH_SERVICE_API_KEY` in Next.js `.env`.

### Puppeteer browser not found
**Solution:** Puppeteer will auto-download Chromium on first run. If it fails:
```bash
npx puppeteer browsers install chromium
```

## Next.js Integration

In your Next.js `.env` file, add:
```env
DEEP_SEARCH_SERVICE_URL=http://localhost:3001
DEEP_SEARCH_SERVICE_API_KEY=your-shared-secret-api-key
```

Make sure the API key matches in both services!

## See Also

- `START.md` - Detailed startup instructions
- `README.md` - Full documentation
