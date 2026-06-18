# Implementation Guide: Per-Source API Endpoints with Multi-Step User Behavior Simulation

## 📋 Executive Summary

This guide answers your questions and provides a roadmap for implementing individual API endpoints per source (AgroCosta, Gecolsa, etc.) with multi-step user behavior simulation.

---

## ❓ Question 1: Worker Thread Isolation - Separate Service?

### Answer: **NO, same project, different execution thread**

**Worker thread isolation** does **NOT** require a separate project or service. It's a **Node.js Worker Thread** that runs **within the same Next.js application** but in a **separate execution thread**.

### Current Architecture:

```
┌─────────────────────────────────────────────────────────┐
│           Next.js Application (Single Project)          │
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐   │
│  │  Main Thread     │         │  Worker Thread    │   │
│  │  (Next.js API)   │────────▶│  (Playwright)     │   │
│  │                  │  Messages│                  │   │
│  │  - API Routes    │◀────────│  - Browser        │   │
│  │  - Business Logic│  Results│  - Automation     │   │
│  └──────────────────┘         └──────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Benefits:
✅ **No separate deployment** - Everything in one project
✅ **Isolated execution** - Playwright crashes don't affect main app
✅ **No bundle size issues** - Playwright not included in Next.js bundle
✅ **Same database** - Can share Prisma client
✅ **Easier maintenance** - Single codebase

### When to Use Separate Service:
- **Only if** you need to:
  - Scale scraping independently
  - Use different programming language
  - Deploy to different infrastructure
  - Isolate resource usage completely

**For your use case: Worker threads are sufficient!**

---

## ❓ Question 2: Playwright vs Selenium for Multi-Step Flows

### Answer: **Playwright is BETTER for your use case**

Based on research and your current implementation:

| Feature | Playwright | Selenium |
|---------|-----------|----------|
| **Performance** | WebSocket (faster) | HTTP (slower) |
| **Auto-wait** | ✅ Built-in | ❌ Manual waits needed |
| **Modern web** | ✅ Native support | ⚠️ Limited |
| **Multi-step flows** | ✅ Excellent | ✅ Good |
| **API support** | ✅ Better | ✅ Good |
| **Maintenance** | ✅ Active | ⚠️ Legacy |
| **Your codebase** | ✅ Already using | ❌ Not used |

### Your Current Implementation Already Supports:
✅ **Login flows** - See `playwright-worker.ts` lines 167-252
✅ **Multi-step automation** - Sequential actions
✅ **Cookie management** - Automatic cookie handling
✅ **Form filling** - Auto-waiting for elements
✅ **Navigation** - Smart waiting for page loads

### Migration from Selenium:
If you have Selenium steps, they're **easily convertible**:

**Selenium:**
```python
driver.find_element(By.ID, "username").send_keys("user")
driver.find_element(By.ID, "password").send_keys("pass")
driver.find_element(By.ID, "submit").click()
```

**Playwright (already in your code):**
```typescript
await page.fill(usernameField, username);
await page.fill(passwordField, password);
await page.click('button[type="submit"]');
```

**Recommendation: Stick with Playwright** - it's already integrated and better suited.

---

## 🎯 Your Requirements: Per-Source API Endpoints

### Current State:
- ✅ Single endpoint: `/api/search/deep-web` - searches ALL sources
- ✅ Worker thread isolation already implemented
- ✅ Multi-step flows (login) already supported
- ✅ Per-source parsers already exist

### What You Need:
Individual API endpoints per source:
- `/api/search/agrocosta?reference=ABC123`
- `/api/search/gecolsa?reference=ABC123`
- `/api/search/importadoragranandina?reference=ABC123`
- `/api/search/partequipos?reference=ABC123`
- `/api/search/retrotrac?reference=ABC123`
- `/api/search/servitractor?reference=ABC123`

---

## 🏗️ Implementation Architecture

### Option A: Individual API Routes (Recommended)

Create separate API routes for each source:

```
src/app/api/search/
├── deep-web/
│   └── route.ts              # Existing: All sources
├── agrocosta/
│   └── route.ts              # NEW: AgroCosta only
├── gecolsa/
│   └── route.ts              # NEW: Gecolsa only
├── importadoragranandina/
│   └── route.ts              # NEW: ImportadoraGranAndina only
├── partequipos/
│   └── route.ts              # NEW: Partequipos only
├── retrotrac/
│   └── route.ts              # NEW: Retrotrac only
└── servitractor/
    └── route.ts              # NEW: Servitractor only
```

### Option B: Dynamic Route with Source Parameter

Single route with source parameter:
- `/api/search/source/[originCode]?reference=ABC123`

### Recommendation: **Option A** (Individual Routes)

**Benefits:**
- Clear separation of concerns
- Easier to add source-specific logic
- Better for API documentation
- Easier to monitor per-source performance
- Can add source-specific middleware

---

## 📝 Implementation Plan

### Phase 1: Create Base Function for Single Source

Create a reusable function that processes one source:

```typescript
// src/lib/scrapers/single-source-processor.ts
import { ScraperWorker } from './ScraperWorker';
import { ParserFactory } from '@/lib/parsers/ParserFactory';
import { prisma } from '@/lib/prisma';

export async function processSingleSource(
  originCode: string,
  reference: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  // 1. Get endpoint from database
  const endpoint = await prisma.deepWebEndpoint.findUnique({
    where: { originCode },
  });

  if (!endpoint || !endpoint.isActive) {
    return {
      success: false,
      error: `Source ${originCode} not found or inactive`,
    };
  }

  // 2. Initialize scraper
  const scraper = new ScraperWorker();
  await scraper.initialize();

  try {
    // 3. Build request (same logic as deep-web/route.ts)
    const url = buildUrl(endpoint.url, reference, ...);
    const headers = buildHeaders(...);
    const body = buildBody(...);

    // 4. Scrape content
    const content = await scraper.scrape({
      url,
      method: endpoint.method,
      headers,
      body,
      timeout: endpoint.timeoutMs,
      requiresLogin: endpoint.requiresLogin,
      loginUrl: endpoint.loginUrl,
      // ... other login config
    });

    // 5. Get parser
    await registerParsers(); // Register all parsers
    const parser = await ParserFactory.getParser(endpoint);

    // 6. Parse content
    const result = await parser.parse(content, reference);

    return {
      success: true,
      data: {
        originCode: result.originCode,
        originName: result.originName,
        searchTerm: reference,
        products: result.products,
        metadata: result.metadata,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await scraper.close();
  }
}
```

### Phase 2: Create Individual API Routes

Example for AgroCosta:

```typescript
// src/app/api/search/agrocosta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { processSingleSource } from '@/lib/scrapers/single-source-processor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reference from query params
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference parameter is required' },
        { status: 400 }
      );
    }

    // Process single source
    const result = await processSingleSource('AGROCOSTA', reference);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('AgroCosta search error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Same as GET but accepts JSON body
  const { reference } = await request.json();
  // ... rest same as GET
}
```

### Phase 3: Repeat for Each Source

Create similar routes for:
- `gecolsa/route.ts`
- `importadoragranandina/route.ts`
- `partequipos/route.ts`
- `retrotrac/route.ts`
- `servitractor/route.ts`

---

## 🔄 Multi-Step Flow Support

### Your Current Implementation Already Supports This!

Looking at `playwright-worker.ts`, you already have:

1. **Login Flow** (lines 167-252):
   - Navigate to login URL
   - Wait for form
   - Fill credentials
   - Submit
   - Verify success

2. **Cookie Management** (lines 266-330):
   - Set cookies before navigation
   - Maintain session across requests

3. **Sequential Actions**:
   - Login → Navigate → Search → Extract

### How It Works:

```typescript
// In ScrapeConfig
{
  requiresLogin: true,
  loginUrl: "https://example.com/login",
  loginUsername: "user",
  loginPassword: "pass",
  loginFormSelector: "form#login",
  usernameField: "input[name='username']",
  passwordField: "input[name='password']",
  
  // Then the actual search URL
  url: "https://example.com/search?ref={{reference}}",
}
```

### For Your Selenium Steps:

If you have Selenium steps like:
1. Go to login page
2. Fill username
3. Fill password
4. Click submit
5. Wait for dashboard
6. Navigate to search
7. Enter reference
8. Click search
9. Extract results

**Convert to Playwright config:**

```typescript
{
  requiresLogin: true,
  loginUrl: "https://example.com/login",
  loginUsername: "user",
  loginPassword: "pass",
  loginFormSelector: "form",
  usernameField: "input#username",
  passwordField: "input#password",
  
  // After login, navigate to search
  url: "https://example.com/search",
  method: "POST",
  body: JSON.stringify({ reference: "{{reference}}" }),
  waitForSelector: ".results-table", // Wait for results
}
```

---

## 🎨 User Behavior Simulation

### Current Capabilities:
- ✅ Form filling
- ✅ Button clicking
- ✅ Navigation
- ✅ Waiting for elements
- ✅ Cookie management
- ✅ Session persistence

### Enhanced Simulation (if needed):

You can add more sophisticated behavior:

```typescript
// In playwright-worker.ts, enhance performLogin:
async function performLogin(page: any, config: any) {
  // 1. Navigate to login
  await page.goto(config.loginUrl);
  
  // 2. Simulate human delay
  await page.waitForTimeout(500 + Math.random() * 500);
  
  // 3. Fill fields (simulate typing)
  await page.type(config.usernameField, config.username, { delay: 50 });
  await page.waitForTimeout(200);
  await page.type(config.passwordField, config.password, { delay: 50 });
  
  // 4. Random mouse movement (optional)
  await page.mouse.move(100, 100);
  
  // 5. Submit
  await page.click('button[type="submit"]');
  
  // 6. Wait for navigation
  await page.waitForNavigation({ waitUntil: 'networkidle' });
}
```

---

## 📊 API Design Recommendations

### Request Format:

**Option 1: Query Parameters (RESTful)**
```
GET /api/search/agrocosta?reference=ABC123&clientType=1
```

**Option 2: JSON Body**
```
POST /api/search/agrocosta
{
  "reference": "ABC123",
  "clientType": 1,
  "clientId": 123
}
```

**Recommendation: Support both** (GET and POST)

### Response Format:

```json
{
  "success": true,
  "data": {
    "originCode": "AGROCOSTA",
    "originName": "AgroCosta",
    "searchTerm": "ABC123",
    "products": [
      {
        "reference": "ABC123",
        "description": "Product description",
        "price": 100.50,
        "stock": 5,
        "hasStock": true,
        "origin": "AGROCOSTA"
      }
    ],
    "metadata": {
      "totalFound": 1,
      "searchDuration": 1250,
      "timestamp": "2025-01-27T10:00:00Z"
    }
  }
}
```

---

## 🔧 Configuration Per Source

### Database Configuration (Already exists):

Each source has config in `DeepWebEndpoint` table:
- Login credentials
- URL templates
- Timeouts
- Retry attempts
- Selectors

### Environment Variables (Optional):

```env
# Per-source cookies (if needed)
AGROCOSTA_COOKIES="session=abc123; token=xyz"
GECOLSA_COOKIES="auth=token123"
SERVITRACTOR_COOKIES="..."

# Per-source API keys
AGROCOSTA_API_KEY="key123"
```

---

## 🚀 Deployment Considerations

### Current Setup (Worker Threads):
- ✅ Single deployment
- ✅ Same database
- ✅ Shared resources
- ✅ Easy to maintain

### If You Need Separate Service (Not Recommended):
Only if you need:
- Independent scaling
- Different infrastructure
- Resource isolation

**For most cases: Worker threads are sufficient!**

---

## ❓ Clarifying Questions

Before implementing, please answer:

### 1. API Access:
- **Q**: Should each source API require authentication?
- **Q**: Should clients be able to call individual sources directly?
- **Q**: Do you need rate limiting per source?

### 2. Multi-Step Flows:
- **Q**: Do ALL sources require login, or only some?
- **Q**: Are your Selenium steps documented (can share)?
- **Q**: Do any sources require multi-page navigation (login → dashboard → search → results)?

### 3. Error Handling:
- **Q**: If one source fails, should others continue?
- **Q**: Do you need retry logic per source?
- **Q**: Should failed requests be logged/alerted?

### 4. Response Format:
- **Q**: Should all sources return the same format?
- **Q**: Do you need source-specific metadata?
- **Q**: Should responses be cached?

### 5. Performance:
- **Q**: Expected requests per minute?
- **Q**: Should searches be queued or parallel?
- **Q**: Do you need request timeouts per source?

---

## 📋 Implementation Checklist

### Phase 1: Foundation ✅ (Already Done)
- [x] Worker thread isolation
- [x] Playwright integration
- [x] Parser system
- [x] Database schema

### Phase 2: Single Source Processor
- [ ] Create `single-source-processor.ts`
- [ ] Extract common logic from `deep-web/route.ts`
- [ ] Add error handling
- [ ] Add logging

### Phase 3: Individual API Routes
- [ ] Create `/api/search/agrocosta/route.ts`
- [ ] Create `/api/search/gecolsa/route.ts`
- [ ] Create `/api/search/importadoragranandina/route.ts`
- [ ] Create `/api/search/partequipos/route.ts`
- [ ] Create `/api/search/retrotrac/route.ts`
- [ ] Create `/api/search/servitractor/route.ts`

### Phase 4: Testing
- [ ] Test each endpoint individually
- [ ] Test authentication
- [ ] Test error handling
- [ ] Test multi-step flows
- [ ] Test performance

### Phase 5: Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Update README
- [ ] Add usage examples

---

## 🎯 Next Steps

1. **Answer the clarifying questions above**
2. **Confirm if you want individual routes or dynamic route**
3. **Share your Selenium steps** (if available) for conversion
4. **I'll implement the solution** based on your answers

---

## 📚 References

- Current implementation: `src/app/api/search/deep-web/route.ts`
- Worker thread: `src/lib/workers/playwright-worker.ts`
- Scraper wrapper: `src/lib/scrapers/ScraperWorker.ts`
- Parsers: `src/lib/parsers/`

---

**Ready to implement? Answer the questions above and I'll create the complete solution!** 🚀

