# Implementation Summary: Search Steps Support

## ✅ What Was Implemented

### 1. Database Schema Updates
- ✅ Added `loginSteps` field to `DeepWebEndpoint` table
- ✅ Added `searchSteps` field to `DeepWebEndpoint` table
- Both fields store JSON arrays of step-by-step instructions

### 2. Worker Thread Updates
- ✅ Created `executeSteps()` function that handles both login and search steps
- ✅ Supports placeholders: `{{reference}}`, `{{username}}`, `{{password}}`
- ✅ Supports step types: `goto`, `fill`, `click`, `wait`, `select`, `press`, `navigate`
- ✅ Integrated search steps execution after login (if provided)
- ✅ Falls back to direct URL navigation if search steps not provided

### 3. Configuration Updates
- ✅ Updated `ScrapeConfig` interface with `searchSteps` and `reference` fields
- ✅ Updated worker messages to include search steps
- ✅ Updated `ScraperWorker` to pass search steps to worker thread

### 4. Single Source Processor
- ✅ Updated to pass `searchSteps` and `reference` to scraper
- ✅ Browser context reuse for session persistence across multiple searches

### 5. Documentation
- ✅ Created `SEARCH_STEPS_EXAMPLES.md` with examples
- ✅ Created `playwright-codegen.ts` script for recording steps

## 🎯 How It Works

### Flow for Sources WITH Search Steps:

```
1. Login (if required) → execute loginSteps
2. Execute searchSteps → fill form, click search, wait for results
3. Extract content from page
4. Parse with parser
```

### Flow for Sources WITHOUT Search Steps:

```
1. Login (if required) → execute loginSteps or legacy login
2. Navigate directly to URL (with {{reference}} replaced)
3. Extract content (JSON or HTML)
4. Parse with parser
```

## 📝 Example Configuration

### For Partequipos (with search steps):

```json
{
  "originCode": "PARTEQUIPOS",
  "requiresLogin": true,
  "loginSteps": [
    {
      "type": "goto",
      "url": "https://partequipos.com/login",
      "options": { "waitUntil": "domcontentloaded" }
    },
    {
      "type": "fill",
      "selector": "input[name='username']",
      "value": "{{username}}"
    },
    {
      "type": "fill",
      "selector": "input[name='password']",
      "value": "{{password}}"
    },
    {
      "type": "click",
      "selector": "button[type='submit']",
      "options": { "waitUntil": "networkidle" }
    }
  ],
  "searchSteps": [
    {
      "type": "goto",
      "url": "https://partequipos.com/buscar",
      "options": { "waitUntil": "domcontentloaded" }
    },
    {
      "type": "wait",
      "selector": "input#busqueda",
      "options": { "timeout": 10000 }
    },
    {
      "type": "fill",
      "selector": "input#busqueda",
      "value": "{{reference}}"
    },
    {
      "type": "click",
      "selector": "button.buscar",
      "options": { "waitUntil": "networkidle" }
    },
    {
      "type": "wait",
      "selector": ".resultados",
      "options": { "timeout": 20000 }
    }
  ]
}
```

### For AgroCosta (no login, no search steps - direct URL):

```json
{
  "originCode": "AGROCOSTA",
  "requiresLogin": false,
  "url": "https://agrocosta.com/search?ref={{reference}}",
  "searchSteps": null
}
```

## 🔧 How to Add Search Steps

### Method 1: Using Prisma

```typescript
await prisma.deepWebEndpoint.update({
  where: { originCode: 'PARTEQUIPOS' },
  data: {
    searchSteps: [
      {
        type: 'goto',
        url: 'https://partequipos.com/search',
        options: { waitUntil: 'domcontentloaded' },
      },
      {
        type: 'fill',
        selector: "input[name='search']",
        value: '{{reference}}',
      },
      {
        type: 'click',
        selector: "button[type='submit']",
      },
    ],
  },
});
```

### Method 2: Using SQL

```sql
UPDATE "DeepWebEndpoint"
SET "searchSteps" = '[
  {
    "type": "goto",
    "url": "https://example.com/search",
    "options": { "waitUntil": "domcontentloaded" }
  },
  {
    "type": "fill",
    "selector": "input[name='search']",
    "value": "{{reference}}"
  },
  {
    "type": "click",
    "selector": "button[type='submit']"
  }
]'::json
WHERE "originCode" = 'PARTEQUIPOS';
```

### Method 3: Using Playwright Codegen

```bash
npm run codegen:record PARTEQUIPOS https://partequipos.com/search
```

This will:
1. Open browser
2. Record your actions
3. Generate steps JSON
4. Save to `scripts/recorded-steps/partequipos.json`

## 📋 Next Steps

1. **Run migration** to add `searchSteps` field:
   ```bash
   npm run db:migrate
   ```

2. **Configure search steps** for each source that needs them

3. **Test each source** individually using the new API routes

4. **Update API routes** for remaining sources (gecolsa, partequipos, etc.)

## 🎯 Key Features

✅ **Session Persistence**: Browser context reused across searches (no re-login)
✅ **Flexible Steps**: Support for complex multi-step flows
✅ **Placeholder Support**: `{{reference}}`, `{{username}}`, `{{password}}`
✅ **Backward Compatible**: Sources without searchSteps still work with direct URLs
✅ **Human-like Behavior**: Delays and typing simulation between steps

## 📚 Documentation

- `docs/SEARCH_STEPS_EXAMPLES.md` - Examples and usage
- `scripts/playwright-codegen.ts` - Step recording tool
- `IMPLEMENTATION_GUIDE.md` - Overall architecture guide

