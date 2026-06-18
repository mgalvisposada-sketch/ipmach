# Deep Web Search - Architecture Analysis

## 📋 Overview

The Deep Web Search feature allows searching across multiple external sources (AgroCosta, Gecolsa, Partequipos, Retrotrac, Servitractor, ImportadoraGranAndina) simultaneously. The system uses a **progressive parallel search** approach where each source is queried independently and results appear as they complete.

## 🏗️ Architecture Flow

### High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Search Page)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  User clicks "Búsqueda Profunda" or "Externos"      │  │
│  │  ↓                                                     │  │
│  │  handleDeepWebSearch()                                │  │
│  │  ↓                                                     │  │
│  │  1. Fetch active sources from /api/config/endpoints   │  │
│  │  2. Initialize UI with tabs for all sources           │  │
│  │  3. Make parallel requests to each source             │  │
│  │     POST /api/search/deep-web/{originCode}            │  │
│  │  ↓                                                     │  │
│  │  Results update progressively as each source completes│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Parallel HTTP Requests
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ /api/search/ │   │ /api/search/ │   │ /api/search/ │
│ deep-web/    │   │ deep-web/     │   │ deep-web/     │
│ AGROCOSTA    │   │ GECOLSA       │   │ PARTEQUIPOS   │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Individual Source Processing                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Fetch endpoint config from database                │  │
│  │  2. Build URL with {{reference}} placeholder           │  │
│  │  3. Get browser from PersistentBrowserPool             │  │
│  │  4. Execute loginSteps (if required)                   │  │
│  │  5. Execute searchSteps with {{reference}} replacement  │  │
│  │  6. Extract HTML/JSON content                          │  │
│  │  7. Parse content with origin-specific parser             │  │
│  │  8. Apply price markup (÷ 0.6)                         │  │
│  │  9. Return products array                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ JSON Response
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Frontend     │   │ Frontend     │   │ Frontend     │
│ Updates      │   │ Updates      │   │ Updates      │
│ AgroCosta    │   │ Gecolsa      │   │ Partequipos  │
│ Tab          │   │ Tab          │   │ Tab          │
└──────────────┘   └──────────────┘   └──────────────┘
```

## 🔄 Detailed Component Flow

### 1. Frontend: Search Page (`/search/page.tsx`)

#### Initialization
```typescript
handleDeepWebSearch(term, clientId, clientType)
```

**Step 1: Fetch Active Sources**
- Calls `/api/config/endpoints` to get list of active endpoints
- Filters for `isActive: true`
- Creates initial UI state with tabs for all sources (pending state)

**Step 2: Parallel Requests**
- Creates array of promises, one per source
- Each promise calls: `POST /api/search/deep-web/{originCode}`
- All requests execute in parallel using `Promise.allSettled()`

**Step 3: Progressive Updates**
- As each source completes, immediately updates:
  - `deepWebResultsByOrigin` Map with results
  - `deepWebOrigins` array with product counts
  - `deepWebErrors` Map if errors occur
  - UI tabs show loading/success/error states

**Step 4: Final State**
- After all promises settle, shows summary toast
- Updates selected tab (keeps "NORMAL" if normal results exist)

### 2. Backend: Individual Source Endpoint (`/api/search/deep-web/[originCode]/route.ts`)

#### Request Processing
```typescript
POST /api/search/deep-web/{originCode}
Body: { reference, clientId?, clientType? }
```

**Step 1: Authentication & Validation**
- Validates session
- Validates reference parameter
- Normalizes originCode to uppercase

**Step 2: Fetch Endpoint Configuration**
- Queries `DeepWebEndpoint` table by `originCode`
- Validates endpoint exists and is active

**Step 3: Initialize Browser Pool**
- Uses `PersistentBrowserPool` (shared across requests)
- Pool size: `DEEP_WEB_WORKER_POOL_SIZE` env var (default: 4)
- Reuses browser contexts for session persistence

**Step 4: Process Endpoint**
- Calls `processEndpoint()` function
- Returns `{ result?: ParseResult, error?: ParseError }`

**Step 5: Apply Business Logic**
- Applies price markup: `price = price / 0.6`
- Sorts by stock availability (hasStock first, then by stock quantity)
- Returns formatted response

### 3. Endpoint Processing (`processEndpoint()`)

#### URL Building
```typescript
// Replace {{reference}} placeholder
url = endpoint.url.replace('{{reference}}', encodeURIComponent(reference))

// Handle special cases (pageParameters, tokens, etc.)
```

#### Authentication Setup
```typescript
// Build headers
headers = {
  'Content-Type': 'application/json',
  ...(token ? { [tokenHeaderName]: token } : {})
}

// Handle cookies (for ImportadoraGranAndina)
if (originCode === 'IMPORTADORAGRANANDINA') {
  headers['Cookie'] = process.env.IMPORTADORAGRANANDINA_COOKIES
}
```

#### Browser Automation
```typescript
// Use PersistentBrowserPool to scrape
content = await pool.scrape({
  url,
  method: endpoint.method,
  headers,
  body,
  timeout: endpoint.timeoutMs,
  requiresLogin: endpoint.requiresLogin,
  loginSteps: endpoint.loginSteps,      // Step-by-step login
  searchSteps: endpoint.searchSteps,    // Step-by-step search
  reference: reference,                  // For {{reference}} replacement
  // ... other config
})
```

#### Content Parsing
```typescript
// Determine content type (HTML vs JSON)
if (isRetrotrac || isServitractor) {
  parsedContent = content  // HTML
} else {
  try {
    parsedContent = JSON.parse(content)
  } catch {
    parsedContent = content  // Fallback to string
  }
}
```

#### Parser Selection & Execution
```typescript
// Get origin-specific parser
parser = await ParserFactory.getParser(endpoint)

// Verify parser can handle content
if (!parser.canParse(parsedContent)) {
  return { error: 'Parser cannot handle content format' }
}

// Parse content
parseResult = await parser.parse(parsedContent, reference)
```

### 4. Browser Pool (`PersistentBrowserPool`)

#### Purpose
- Manages pool of browser workers
- Reuses browser contexts for session persistence
- Handles login state across multiple searches

#### Worker Management
- Pool size: Configurable via `DEEP_WEB_WORKER_POOL_SIZE`
- Each worker: Isolated Playwright browser instance
- Context reuse: Maintains cookies/sessions per origin

#### Scraping Process
```typescript
pool.scrape(config) {
  // 1. Get or create worker for origin
  // 2. Execute loginSteps if required (only once per session)
  // 3. Execute searchSteps with {{reference}} replacement
  // 4. Extract HTML/JSON content
  // 5. Return content
}
```

### 5. Parser System

#### Parser Factory Pattern
```typescript
ParserFactory.getParser(endpoint) {
  // Returns origin-specific parser:
  // - PartequiposParser
  // - AgroCostaParser
  // - GecolsaParser
  // - ServitractorParser
  // - ImportadoraGranAndinaParser
  // - RetrotracParser
}
```

#### Parser Interface
```typescript
interface IParser {
  canParse(content: any): boolean
  parse(content: any, reference: string): Promise<ParseResult>
}
```

#### Parse Result Structure
```typescript
interface ParseResult {
  originCode: string
  originName: string
  products: Product[]
  metadata?: any
}

interface Product {
  reference: string
  description?: string
  price: number
  stock: number
  hasStock: boolean
  location?: string
  origin?: string
}
```

## 📊 Data Flow

### Request Flow
1. **Frontend** → `POST /api/search/deep-web/{originCode}`
2. **Backend** → Fetch endpoint config from database
3. **Backend** → Get browser from pool
4. **Browser** → Execute loginSteps (if needed)
5. **Browser** → Execute searchSteps with reference
6. **Browser** → Extract HTML/JSON
7. **Backend** → Parse with origin-specific parser
8. **Backend** → Apply price markup (÷ 0.6)
9. **Backend** → Sort by stock availability
10. **Backend** → Return JSON response
11. **Frontend** → Update UI progressively

### State Management (Frontend)

#### State Variables
```typescript
// Search results
searchResults: SearchResult[]              // Normal search results
externalResults: ExternalResult[]           // Costex results
deepWebResults: SearchResult[]              // All deep web results (flat)

// Deep web results by origin
deepWebResultsByOrigin: Map<string, SearchResult[]>

// Origins metadata
deepWebOrigins: Array<{
  originCode: string
  originName: string
  productCount: number
  hasError: boolean
}>

// Errors by origin
deepWebErrors: Map<string, string>

// UI state
selectedOriginTab: string                   // 'NORMAL' or originCode
isDeepWebSearching: boolean
deepWebSearchingSources: Array<{...}>       // Sources being searched
```

#### Progressive Updates
- Each source completes independently
- State updates immediately when source finishes
- UI reflects real-time progress:
  - Spinner while searching
  - Checkmark when complete
  - Error icon if failed
  - Product count in tab label

## 🎯 Key Features

### 1. Progressive Results
- Results appear as each source completes
- No need to wait for slowest source
- Better user experience

### 2. Parallel Processing
- All sources searched simultaneously
- Maximum throughput
- Independent error handling

### 3. Session Persistence
- Browser pool maintains login sessions
- Reuses authenticated contexts
- Reduces login overhead

### 4. Tabbed Interface
- "Búsqueda Normal" tab for internal/Costex results
- One tab per deep web source
- Visual indicators (loading, success, error)

### 5. Error Resilience
- Failed sources don't block others
- Errors displayed per source
- Continues processing remaining sources

### 6. Price Markup
- Automatic markup applied: `price / 0.6`
- Consistent pricing across sources
- Business logic centralized

## 🔧 Configuration

### Database Schema (`DeepWebEndpoint`)
```prisma
model DeepWebEndpoint {
  originCode        String   @unique
  name              String
  url               String   // With {{reference}} placeholder
  method            HttpMethod
  isActive          Boolean
  requiresLogin     Boolean
  loginSteps        Json?    // Step-by-step login instructions
  searchSteps       Json?    // Step-by-step search instructions
  timeoutMs         Int
  retryAttempts     Int
  // ... other fields
}
```

### Environment Variables
```bash
DEEP_WEB_WORKER_POOL_SIZE=4        # Browser pool size
IMPORTADORAGRANANDINA_COOKIES=...  # Cookie header for Importadora
```

### Step Configuration Examples

#### Login Steps
```json
[
  { "type": "goto", "url": "https://example.com/login" },
  { "type": "fill", "selector": "#username", "value": "{{username}}" },
  { "type": "fill", "selector": "#password", "value": "{{password}}" },
  { "type": "click", "selector": "button[type='submit']" },
  { "type": "wait", "selector": ".dashboard", "options": { "timeout": 10000 } }
]
```

#### Search Steps
```json
[
  { "type": "goto", "url": "https://example.com/search" },
  { "type": "fill", "selector": "#search", "value": "{{reference}}" },
  { "type": "click", "selector": "button.search" },
  { "type": "wait", "selector": ".results", "options": { "timeout": 15000 } }
]
```

## 📈 Performance Characteristics

### Parallel Execution
- **Before**: Sequential processing (slowest source blocks all)
- **After**: Parallel processing (all sources search simultaneously)
- **Improvement**: ~6x faster for 6 sources

### Progressive Updates
- **Before**: Wait for all sources, then show all results
- **After**: Show results as each source completes
- **Improvement**: Perceived performance significantly better

### Session Reuse
- **Before**: Login for every search
- **After**: Reuse authenticated sessions
- **Improvement**: ~2-3x faster for subsequent searches

## 🐛 Error Handling

### Source-Level Errors
- Each source handles errors independently
- Errors stored in `deepWebErrors` Map
- UI shows error icon in tab
- Other sources continue processing

### Error Types
1. **Connection Errors**: Network timeouts, DNS failures
2. **Authentication Errors**: Login failures, expired sessions
3. **Parsing Errors**: Parser cannot handle content format
4. **Timeout Errors**: Source takes too long to respond

### Error Display
- Error icon (⚠️) in tab
- Error message in empty state
- Toast notification with summary

## 🔐 Security Considerations

### Authentication
- All endpoints require valid session
- Session validated via NextAuth
- Unauthorized requests return 401

### Data Isolation
- Each browser worker isolated in separate thread
- No shared state between requests
- Cookies/sessions scoped per origin

### Input Validation
- Reference parameter validated
- URL encoding applied
- SQL injection prevented (Prisma ORM)

## 📝 Summary

The Deep Web Search system uses a **progressive parallel architecture** where:

1. **Frontend** makes parallel requests to individual source endpoints
2. **Backend** processes each source independently using browser automation
3. **Results** update progressively as each source completes
4. **UI** shows tabbed interface with real-time status indicators
5. **Performance** optimized through parallel execution and session reuse

This architecture provides:
- ✅ Fast response times (parallel processing)
- ✅ Better UX (progressive results)
- ✅ Error resilience (independent error handling)
- ✅ Scalability (browser pool management)
- ✅ Maintainability (modular parser system)

