# How to Start Deep Search Service

## Quick Start

### 1. Install Dependencies

```bash
cd DeepSearchService
npm install
```

This will install:
- Puppeteer (browser automation)
- Express (web server)
- All other required dependencies

### 2. Configure Environment Variables

Create a `.env` file in the `DeepSearchService` directory:

```env
# API Authentication
API_KEY=your-secret-api-key-here

# Service Configuration
PORT=3001
HOST=0.0.0.0

# OpenAI (for Servitractor/Retrotrac parsing)
OPENAI_API_KEY=your-openai-api-key

# CORS (optional)
NEXTJS_API_ORIGIN=http://localhost:3000

# Puppeteer (optional)
PUPPETEER_HEADLESS=true  # Set to false to see browser window
```

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 4. Start the Service

**Production mode:**
```bash
npm start
```

**Development mode (with auto-reload):**
```bash
npm run dev
```

### 5. Verify It's Running

The service should output:
```
🚀 Deep Search Service running on 0.0.0.0:3001
📝 Environment: development
🔐 API Key Auth: Enabled
🌐 Accessible on your local network
```

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

## Testing the Service

### Test with curl

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

## Troubleshooting

### Port Already in Use
If port 3001 is already in use:
```bash
# Change PORT in .env file
PORT=3002
```

### Puppeteer Browser Installation
Puppeteer will automatically download Chromium on first run. If it fails:
```bash
npx puppeteer browsers install chromium
```

### Permission Errors (Linux/Mac)
If you get permission errors:
```bash
chmod +x node_modules/.bin/puppeteer
```

## Next Steps

1. Update `motor-parts-system` API route to use the new simplified API
2. Ensure the API route sends full endpoint configuration in request body
3. Test with a real search request

