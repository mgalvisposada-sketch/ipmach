# Deep Search Service - Architecture Analysis

## 📋 Overview

This document analyzes the requirements and architecture for creating a **standalone Deep Search Service** that performs web scraping and parsing without database access. The service will receive all necessary configuration from the Next.js API and return parsed results.

## 🎯 Requirements

### Core Requirements
1. **No Database Access**: Service must receive all config via API (no database connection)
2. **Scraping & Parsing**: Perform Playwright scraping and content parsing
3. **Persistent Sessions**: Login once per source, keep browsers open indefinitely, reuse authenticated sessions
4. **Scalable**: Can be deployed independently and scaled horizontally
5. **Session Management**: Maintain browser contexts per origin, never close unless error

### Data Flow
```
Next.js API (/api/search/deep-web/[originCode])
    ↓
1. Fetch endpoint config from database
2. Build request payload with all necessary data
3. Call Deep Search Service
    ↓
Deep Search Service
    ↓
1. Receive configuration payload
2. Initialize browser (if needed)
3. Execute scraping
4. Parse content
5. Return products array
    ↓
Next.js API
    ↓
1. Apply business logic (price markup, sorting)
2. Return formatted response to frontend
```

## 📦 Required Data to Pass

### Complete Configuration Payload

Based on `DeepWebEndpoint` schema and `ScrapeConfig` interface, the service needs:

```typescript
interface DeepSearchRequest {
  // Search parameters
  reference: string;              // The reference to search for
  
  // Endpoint identification
  originCode: string;             // e.g., "AGROCOSTA", "PARTEQUIPOS"
  originName: string;             // Display name
  
  // URL Configuration
  url: string;                    // URL template (with {{reference}} already replaced)
  method: 'GET' | 'POST';
  
  // Authentication
  requiresLogin: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  loginFormSelector?: string;
  usernameField?: string;
  passwordField?: string;
  cookies?: string;               // Pre-configured cookies (e.g., ImportadoraGranAndina)
  
  // Token Configuration
  token?: string;
  tokenHeaderName?: string;
  tokenPlacement?: 'header' | 'query' | 'body';
  
  // Request Body (for POST)
  requestBodyTemplate?: string;  // With {{reference}} already replaced
  
  // Browser Automation Steps
  loginSteps?: Array<{
    type: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'press' | 'navigate';
    selector?: string;
    value?: string;
    url?: string;
    options?: {
      delay?: number;
      timeout?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      button?: 'left' | 'right' | 'middle';
      key?: string;
    };
  }>;
  
  searchSteps?: Array<{
    type: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'press' | 'navigate';
    selector?: string;
    value?: string;
    url?: string;
    options?: {
      delay?: number;
      timeout?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      button?: 'left' | 'right' | 'middle';
      key?: string;
    };
  }>;
  
  // Timeout & Retry Configuration
  timeoutMs: number;              // Default: 40000
  retryAttempts: number;          // Default: 1
  waitForSelector?: string;       // Selector to wait for after search
  
  // Parser Configuration
  parserConfig?: any;             // Origin-specific parser settings (JSON)
}
```

### Response Format

```typescript
interface DeepSearchResponse {
  success: boolean;
  originCode: string;
  originName: string;
  products: Array<{
    reference: string;
    description?: string;
    price: number;
    stock: number;
    hasStock: boolean;
    location?: string;
    origin?: string;
  }>;
  productCount: number;
  metadata?: any;
  error?: string;
}
```

## 🛠️ Technology Stack Recommendation

### Recommended Stack: **Node.js + TypeScript + Express**

#### Why This Stack?
1. **Consistency**: Matches existing Next.js/TypeScript codebase
2. **Code Reuse**: Can share parser classes and utilities
3. **Playwright Support**: Excellent Node.js support
4. **Performance**: Fast startup, good for microservices
5. **Ecosystem**: Rich npm ecosystem for scraping/parsing

### Alternative Stacks (Considerations)

#### Option 1: Python + FastAPI
**Pros:**
- Excellent scraping libraries (Selenium, BeautifulSoup, Scrapy)
- Strong data processing capabilities
- Good for ML/AI integration (if needed later)

**Cons:**
- Different language from main codebase
- Code duplication for parsers
- Deployment complexity (different runtime)

#### Option 2: Go + Gin
**Pros:**
- Excellent performance
- Low memory footprint
- Fast startup

**Cons:**
- Playwright support is limited
- Would need to rewrite all parsers
- Different language ecosystem

#### Option 3: Node.js + NestJS
**Pros:**
- Enterprise-grade framework
- Built-in dependency injection
- Excellent TypeScript support

**Cons:**
- More boilerplate than Express
- Might be overkill for this service

### **RECOMMENDATION: Node.js + TypeScript + Express**

## 📁 Recommended File Structure

```
deep-search-service/
├── src/
│   ├── index.ts                 # Entry point, Express server setup
│   ├── config/
│   │   ├── environment.ts      # Environment variable validation
│   │   └── constants.ts        # Service constants
│   ├── routes/
│   │   └── search.ts            # POST /search endpoint
│   ├── controllers/
│   │   └── searchController.ts # Request handling logic
│   ├── services/
│   │   ├── scraperService.ts   # Orchestrates scraping
│   │   └── parserService.ts    # Orchestrates parsing
│   ├── scrapers/
│   │   ├── PlaywrightScraper.ts # Playwright wrapper
│   │   ├── ScraperWorker.ts     # Worker thread wrapper
│   │   └── ScrapeConfig.ts     # Type definitions
│   ├── parsers/
│   │   ├── interfaces/
│   │   │   └── IParser.ts      # Parser interface
│   │   ├── BaseParser.ts       # Abstract base parser
│   │   ├── ParserFactory.ts    # Parser factory
│   │   ├── PartequiposParser.ts
│   │   ├── AgroCostaParser.ts
│   │   ├── GecolsaParser.ts
│   │   ├── ServitractorParser.ts
│   │   ├── ImportadoraGranAndinaParser.ts
│   │   ├── RetrotracParser.ts
│   │   └── types.ts            # Type definitions
│   ├── workers/
│   │   ├── playwright-worker.ts # Worker thread implementation
│   │   └── worker-messages.ts  # Message types
│   ├── utils/
│   │   ├── openai-extractor.ts  # OpenAI integration (for Servitractor)
│   │   ├── logger.ts           # Logging utility
│   │   └── errors.ts           # Error handling utilities
│   └── middleware/
│       ├── errorHandler.ts     # Global error handler (sanitized)
│       ├── requestLogger.ts    # Request logging (masked sensitive data)
│       ├── validator.ts        # Request validation
│       ├── auth.ts              # API key authentication
│       ├── rateLimiter.ts       # Rate limiting
│       ├── securityHeaders.ts  # Security headers
│       └── auditLogger.ts       # Security audit logging
├── scripts/
│   ├── build-worker.js         # Build worker thread (esbuild)
│   └── docker-build.sh         # Docker build script
├── tests/
│   ├── unit/
│   │   ├── parsers/
│   │   └── services/
│   └── integration/
│       └── search.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml          # For local development
├── README.md
└── docs/
    ├── API.md                   # API documentation
    └── DEPLOYMENT.md            # Deployment guide
```

## 🔌 API Design

### Endpoint: `POST /search`

#### Request
```http
POST /search
Content-Type: application/json

{
  "reference": "ABC123",
  "originCode": "AGROCOSTA",
  "originName": "AgroCosta",
  "url": "https://agro-costa.com/consulta/consulta_inventario.php?referencia=ABC123",
  "method": "POST",
  "requiresLogin": true,
  "loginUrl": "https://agro-costa.com/consulta/login.php",
  "loginUsername": "ciparc",
  "loginPassword": "COL25",
  "loginSteps": [...],
  "searchSteps": [...],
  "timeoutMs": 40000,
  "retryAttempts": 1,
  "waitForSelector": ".results",
  "parserConfig": {}
}
```

#### Success Response (200)
```json
{
  "success": true,
  "originCode": "AGROCOSTA",
  "originName": "AgroCosta",
  "products": [
    {
      "reference": "ABC123",
      "description": "Filtro de aceite",
      "price": 50000,
      "stock": 10,
      "hasStock": true,
      "location": "Bogotá"
    }
  ],
  "productCount": 1,
  "metadata": {
    "scrapedAt": "2025-01-15T10:30:00Z",
    "responseTime": 3500
  }
}
```

#### Error Response (400/500)
```json
{
  "success": false,
  "originCode": "AGROCOSTA",
  "originName": "AgroCosta",
  "error": "Timeout: Page did not load within 40000ms",
  "products": [],
  "productCount": 0
}
```

### Health Check: `GET /health`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "browserPool": {
    "size": 4,
    "available": 3,
    "active": 1
  },
  "sessions": {
    "totalContexts": 6,
    "authenticatedContexts": 6,
    "contextsByOrigin": {
      "AGROCOSTA": { "authenticated": true, "lastUsed": "2025-01-15T10:30:00Z" },
      "PARTEQUIPOS": { "authenticated": true, "lastUsed": "2025-01-15T10:25:00Z" },
      "SERVITRACTOR": { "authenticated": true, "lastUsed": "2025-01-15T10:20:00Z" }
    }
  }
}
```

## 📦 Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.56.1",
    "cheerio": "^1.0.0-rc.12",
    "jsdom": "^23.0.1",
    "openai": "^4.20.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "typescript": "^5.2.0",
    "tsx": "^4.1.0",
    "esbuild": "^0.25.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "nodemon": "^3.0.2"
  }
}
```

## 🔄 Integration Flow

### Current Flow (Next.js API)
```typescript
// Current: /api/search/deep-web/[originCode]/route.ts
1. Fetch endpoint from database
2. Build URL, headers, body
3. Call pool.scrape() with config
4. Parse content
5. Apply price markup
6. Return response
```

### New Flow (With Service + Persistent Sessions + Security)
```typescript
// New: /api/search/deep-web/[originCode]/route.ts
1. Fetch endpoint from database
2. Build complete request payload
3. Add authentication header (API key)
4. Call Deep Search Service: POST /search
   - Service validates API key
   - Service validates request payload
   - Service checks rate limits
   - Service checks for existing context for originCode
   - If exists and authenticated: Reuse (fast path)
   - If not exists or not authenticated: Login once, then search
5. Receive parsed products (or error)
6. Apply price markup (÷ 0.6)
7. Sort by stock availability
8. Return response
```

### Next.js Integration Example (With Security)
```typescript
// Next.js: /api/search/deep-web/[originCode]/route.ts
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest, { params }: { params: { originCode: string } }) {
  // 1. Authenticate user (Next.js session)
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch endpoint config from database
  const endpoint = await prisma.deepWebEndpoint.findFirst({
    where: { originCode: params.originCode, isActive: true }
  });

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  }

  // 3. Build request payload
  const { reference } = await request.json();
  const payload = {
    reference,
    originCode: endpoint.originCode,
    originName: endpoint.name,
    url: endpoint.url.replace('{{reference}}', encodeURIComponent(reference)),
    method: endpoint.method,
    requiresLogin: endpoint.requiresLogin,
    loginSteps: endpoint.loginSteps,
    searchSteps: endpoint.searchSteps,
    // ... other config
  };

  // 4. Call Deep Search Service with authentication
  try {
    const serviceUrl = process.env.DEEP_SEARCH_SERVICE_URL;
    const apiKey = process.env.DEEP_SEARCH_SERVICE_API_KEY;

    const response = await fetch(`${serviceUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // API key authentication
      },
      body: JSON.stringify(payload),
      // Timeout to prevent hanging
      signal: AbortSignal.timeout(180000), // 3 minutes max
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Service error');
    }

    const data = await response.json();

    // 5. Apply business logic
    const products = data.products.map((p: any) => ({
      ...p,
      price: Math.round(p.price / 0.6), // Price markup
    }));

    // 6. Sort by stock availability
    products.sort((a: any, b: any) => {
      if (a.hasStock && !b.hasStock) return -1;
      if (!a.hasStock && b.hasStock) return 1;
      return (b.stock || 0) - (a.stock || 0);
    });

    return NextResponse.json({
      success: true,
      products,
      productCount: products.length,
    });
  } catch (error: any) {
    console.error('Deep search service error:', error);
    return NextResponse.json(
      { error: error.message || 'Service unavailable' },
      { status: 500 }
    );
  }
}
```

### Session Lifecycle in Service
```typescript
// First Request for Origin (e.g., AGROCOSTA)
1. No context exists for originCode
2. Create new browser context
3. Execute loginSteps → Authenticate
4. Mark context as authenticated
5. Execute searchSteps → Search
6. Return results
7. Keep context open (never close)

// Subsequent Requests for Same Origin
1. Context exists for originCode
2. Validate context is still valid
3. If valid: Reuse context (skip login) ✅
4. Execute searchSteps → Search
5. Return results
6. Keep context open (never close)

// Error Recovery
1. If session expired (redirected to login)
2. Re-authenticate automatically
3. Keep context open
4. Retry search
```

### Service Implementation
```typescript
// Service: POST /search
1. Validate request payload
2. Get or create browser context for originCode
3. Check if context is authenticated
   - If not authenticated: Execute loginSteps (first time only)
   - If authenticated: Reuse existing session
4. Execute searchSteps with {{reference}} replacement
5. Extract HTML/JSON content
6. Select parser based on originCode
7. Parse content
8. Return products array
9. Keep context open for next request (never close)
```

## 🏗️ Architecture Decisions

### 1. Persistent Session Design
- **Decision**: Maintain persistent browser contexts per origin, never close
- **Rationale**: 
  - Login once per source (first request only)
  - Fast subsequent requests (no login overhead)
  - Better performance (5-10 seconds saved per request)
  - Sessions persist across all requests
- **Implementation**:
  - One browser context per origin (e.g., AGROCOSTA, PARTEQUIPOS)
  - Contexts cached in memory by originCode
  - Login performed only on first request per origin
  - Contexts never expire (only close on explicit error)
  - Browser instances stay alive for service lifetime
- **Memory Impact**: ~90-180MB for 6 sources (manageable)
- **Error Recovery**: Re-authenticate if session expires, but keep context open

### 2. Browser Pool Management with Persistent Contexts
- **Decision**: Maintain browser pool with persistent contexts per origin
- **Rationale**:
  - Reuse browser instances for performance
  - Reuse authenticated contexts for speed
  - Reduce login overhead significantly
- **Implementation**: 
  - Pool size configurable via env var (default: 4)
  - One context per origin, shared across requests
  - Contexts stored in Map<originCode, BrowserContext>
  - No expiration time (contexts live forever)
  - Only cleanup on explicit errors or service shutdown
  - Health check includes pool status and context count

### 3. Parser Code Sharing
- **Decision**: Copy parser classes to service
- **Rationale**:
  - Service is independent
  - No shared codebase dependency
- **Alternative**: Publish parsers as npm package (future consideration)

### 4. Session Persistence Strategy
- **Decision**: Never-close browser contexts with login-once-per-source
- **Rationale**:
  - Maximum performance (no login overhead after first request)
  - Better user experience (faster searches)
  - Reduced load on external sites
- **Implementation**:
  - Context cache: `Map<originCode, CachedContext>`
  - Context validation: Check if still valid before reuse
  - Login detection: Only login if `isAuthenticated === false`
  - Error recovery: Re-authenticate if session expires, but keep context
  - No expiration: Contexts live until service restart or error
- **Memory Management**:
  - Monitor memory usage
  - Set max contexts limit if needed
  - Manual cleanup endpoint for maintenance

### 5. Error Handling with Session Recovery
- **Decision**: Return structured error responses with automatic session recovery
- **Rationale**:
  - Client can handle errors gracefully
  - Better debugging
  - Automatic recovery from session expiration
- **Implementation**:
  - Try-catch around all operations
  - Return error in response body
  - Log errors for monitoring
  - Detect session expiration (redirect to login page)
  - Automatically re-authenticate if session expires
  - Keep context open even after errors (only close on critical failures)

## 🔐 Security Considerations

### 1. Inter-Service Authentication

#### Option A: API Key Authentication (Recommended for Internal Services)
- **Implementation**: Shared secret API key
- **Request Header**:
  ```http
  Authorization: Bearer <shared-api-key>
  ```
- **Next.js Side**:
  ```typescript
  const response = await fetch(`${DEEP_SEARCH_SERVICE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEP_SEARCH_SERVICE_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  ```
- **Service Side**: Validate API key in middleware
- **Pros**: Simple, fast, good for internal services
- **Cons**: Key rotation requires coordination

#### Option B: JWT Token Authentication
- **Implementation**: Next.js generates JWT, service validates
- **Token Payload**:
  ```json
  {
    "iss": "motor-parts-system",
    "sub": "api-service",
    "exp": 3600,
    "iat": 1234567890
  }
  ```
- **Next.js Side**: Generate JWT with secret
- **Service Side**: Validate JWT signature and expiration
- **Pros**: Stateless, can include metadata, expiration built-in
- **Cons**: More complex, requires JWT library

#### Option C: Mutual TLS (mTLS) - Highest Security
- **Implementation**: Certificate-based authentication
- **Setup**: Both services have certificates, validate each other
- **Pros**: Strongest security, prevents man-in-the-middle
- **Cons**: Complex setup, certificate management overhead

#### Option D: Internal Network Only (Simplest)
- **Implementation**: Deploy on same network, firewall rules
- **Pros**: Simplest, no auth overhead
- **Cons**: Less secure if network is compromised

**RECOMMENDATION**: **Option A (API Key)** for internal services, **Option B (JWT)** if you need token expiration or metadata

### 2. Request Validation & Sanitization

#### Input Validation
```typescript
// Validate request payload
interface DeepSearchRequest {
  reference: string;        // Required, max length, alphanumeric
  originCode: string;       // Required, enum of valid origins
  url: string;             // Required, valid URL format
  // ... other fields
}

// Validation rules:
- reference: string, 1-100 chars, alphanumeric + dash/underscore
- originCode: enum ['AGROCOSTA', 'PARTEQUIPOS', ...]
- url: valid URL format, must be HTTPS (or allowlist)
- timeoutMs: number, 1000-120000 (1s to 2min max)
- loginSteps/searchSteps: array, max 50 steps, validate step types
```

#### URL Sanitization
```typescript
// Prevent SSRF (Server-Side Request Forgery)
const allowedDomains = [
  'agro-costa.com',
  'partequipos.com',
  // ... other allowed domains
];

function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return allowedDomains.includes(urlObj.hostname);
  } catch {
    return false;
  }
}
```

#### SQL Injection Prevention
- Not applicable (no database access)
- But validate all string inputs to prevent code injection

### 3. Rate Limiting

#### Per-Origin Rate Limiting
```typescript
// Limit requests per origin to prevent abuse
const rateLimits = {
  'AGROCOSTA': { maxRequests: 10, windowMs: 60000 }, // 10/min
  'PARTEQUIPOS': { maxRequests: 15, windowMs: 60000 }, // 15/min
  // ... other origins
};
```

#### Global Rate Limiting
```typescript
// Limit total requests per client (by API key)
const globalRateLimit = {
  maxRequests: 100,
  windowMs: 60000, // 100 requests per minute
};
```

#### Implementation
- Use `express-rate-limit` middleware
- Store counters in Redis (for distributed systems) or memory
- Return `429 Too Many Requests` when exceeded

### 4. Resource Limits & Timeouts

#### Request Timeouts
```typescript
// Per-request timeout (from payload)
const maxTimeout = 120000; // 2 minutes absolute max
const requestTimeout = Math.min(config.timeoutMs, maxTimeout);

// Global timeout for entire request processing
const globalTimeout = 180000; // 3 minutes
```

#### Concurrent Request Limits
```typescript
// Max concurrent requests per instance
const MAX_CONCURRENT_REQUESTS = 50;

// Max concurrent requests per origin
const MAX_CONCURRENT_PER_ORIGIN = 5;
```

#### Memory Limits
```typescript
// Monitor memory usage
const MAX_MEMORY_MB = 2048; // 2GB
// Alert if memory exceeds threshold
// Reject new requests if memory is high
```

### 5. Network Security

#### HTTPS/TLS
- **Requirement**: All communication over HTTPS
- **Service**: Use TLS certificates
- **Next.js → Service**: HTTPS only, no HTTP
- **Certificate Validation**: Verify certificates (no self-signed in production)

#### Network Isolation
- **Deployment**: Deploy on private network/VPC
- **Firewall Rules**: 
  - Only allow Next.js API to connect to service
  - Block all other external access
  - Use security groups/network policies

#### IP Whitelisting (Optional)
```typescript
// Only allow requests from Next.js API IPs
const allowedIPs = [
  '10.0.1.0/24',  // Next.js API subnet
  // ... other allowed IPs
];

function isAllowedIP(ip: string): boolean {
  return allowedIPs.some(allowed => {
    // IP range matching logic
    return ipMatchesRange(ip, allowed);
  });
}
```

### 6. Secrets Management

#### Environment Variables
```bash
# Never commit secrets to code
DEEP_SEARCH_SERVICE_API_KEY=<generate-strong-random-key>
JWT_SECRET=<generate-strong-random-secret>
```

#### Secret Rotation
- Rotate API keys periodically (e.g., every 90 days)
- Use secret management service (AWS Secrets Manager, HashiCorp Vault)
- Coordinate rotation between services

#### Credential Storage
- **Login Credentials**: Passed in request (encrypted in transit)
- **Service Secrets**: Stored in environment variables or secret manager
- **Never Log**: Never log credentials, API keys, or tokens

### 7. Request/Response Security

#### Request Signing (Optional, Advanced)
```typescript
// Sign requests to prevent tampering
const signature = crypto
  .createHmac('sha256', API_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

headers['X-Signature'] = signature;

// Service validates signature
```

#### Response Encryption (Optional)
- Only if sensitive data in responses
- Use TLS (HTTPS) for encryption in transit
- Consider encrypting sensitive fields if storing

#### CORS Configuration
```typescript
// Only allow requests from Next.js API origin
const corsOptions = {
  origin: process.env.NEXTJS_API_ORIGIN,
  credentials: true,
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

### 8. Logging & Monitoring Security

#### Sensitive Data Masking
```typescript
// Never log credentials or sensitive data
function sanitizeLog(data: any): any {
  const sanitized = { ...data };
  if (sanitized.loginPassword) sanitized.loginPassword = '***';
  if (sanitized.token) sanitized.token = '***';
  if (sanitized.apiKey) sanitized.apiKey = '***';
  return sanitized;
}
```

#### Security Event Logging
- Log all authentication failures
- Log rate limit violations
- Log suspicious patterns (e.g., many failed requests)
- Alert on security events

#### Audit Trail
- Log all requests with:
  - Timestamp
  - Source IP
  - Origin code
  - Success/failure
  - Response time
- Retain logs for compliance (e.g., 90 days)

### 9. Error Handling Security

#### Error Message Sanitization
```typescript
// Don't expose internal details in errors
// BAD:
throw new Error(`Database connection failed: ${dbError}`);

// GOOD:
throw new Error('Service temporarily unavailable');
// Log full error internally
```

#### Information Disclosure Prevention
- Don't expose stack traces in production
- Don't expose internal paths or structure
- Return generic error messages to clients
- Log detailed errors server-side only

### 10. Session Security

#### Context Isolation
- Each origin has isolated browser context
- No cross-origin cookie leakage
- Separate storage per context

#### Credential Handling
- Credentials passed in request (not stored in service)
- Credentials only used for authentication
- Never log or expose credentials

#### Session Validation
- Validate session before reuse
- Detect session expiration
- Re-authenticate if needed
- Clear invalid sessions

### 11. Security Headers

#### HTTP Security Headers
```typescript
// Add security headers to responses
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

### 12. Security Checklist

#### Implementation Checklist
- [ ] API key authentication implemented
- [ ] Request validation and sanitization
- [ ] URL allowlist to prevent SSRF
- [ ] Rate limiting per origin and global
- [ ] HTTPS/TLS enforced
- [ ] Network isolation configured
- [ ] Secrets stored securely (not in code)
- [ ] Sensitive data masked in logs
- [ ] Error messages sanitized
- [ ] Security headers added
- [ ] Audit logging implemented
- [ ] Security monitoring alerts configured

#### Security Testing
- [ ] Test authentication failures
- [ ] Test rate limiting
- [ ] Test input validation
- [ ] Test SSRF prevention
- [ ] Test error handling
- [ ] Penetration testing (optional)

## 📊 Performance Considerations

### 1. Browser Pool Size
- **Default**: 4 workers
- **Configurable**: Via `BROWSER_POOL_SIZE` env var
- **Scaling**: Adjust based on server CPU cores

### 2. Timeout Management
- **Default**: 40 seconds per request
- **Configurable**: Per request via payload
- **Global**: Max timeout limit (e.g., 60s)

### 3. Session Caching (Required)
- **In-Memory**: Cache authenticated browser contexts per origin
- **TTL**: Never expire (only close on error)
- **Key**: `originCode` (e.g., 'AGROCOSTA', 'PARTEQUIPOS')
- **Storage**: `Map<originCode, CachedContext>`
- **Benefits**: Login once, reuse forever

### 4. Result Caching (Optional)
- **In-Memory**: Cache results for repeated searches
- **TTL**: 5 minutes
- **Key**: `originCode:reference`

### 5. Concurrent Requests
- **Limit**: Max concurrent requests per instance
- **Queue**: Queue requests when pool is full
- **Monitoring**: Track queue depth
- **Session Sharing**: Multiple requests can share same context (one per origin)

## 🚀 Deployment Options

### Option 1: Docker Container
```dockerfile
FROM node:20-slim
# Install Playwright browsers
RUN npx playwright install chromium
# Copy code and install dependencies
# Expose port 3001
```

### Option 2: Serverless (AWS Lambda / Vercel)
- **Pros**: Auto-scaling, pay-per-use
- **Cons**: Cold starts, Playwright setup complexity

### Option 3: Kubernetes Deployment
- **Pros**: Auto-scaling, high availability
- **Cons**: More complex setup

### **RECOMMENDATION: Docker Container**
- Simple deployment
- Good performance
- Easy to scale horizontally

## 📝 Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Browser Pool
BROWSER_POOL_SIZE=4
BROWSER_TIMEOUT=60000

# Session Persistence
CONTEXT_EXPIRATION_MS=0  # 0 = never expire (Infinity)
CONTEXT_CLEANUP_INTERVAL_MS=0  # 0 = disabled (no automatic cleanup)
ENABLE_PAGE_REUSE=true  # Keep pages open for reuse (optional optimization)

# OpenAI (for Servitractor)
OPENAI_API_KEY=sk-...

# Security - Inter-Service Authentication
DEEP_SEARCH_SERVICE_API_KEY=your-secret-api-key  # Shared secret between Next.js and service
NEXTJS_API_ORIGIN=https://your-nextjs-api.com    # Allowed origin for CORS
ALLOWED_IPS=10.0.1.0/24                          # IP whitelist (optional)

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100                      # Global rate limit
RATE_LIMIT_WINDOW_MS=60000                       # Per minute
RATE_LIMIT_PER_ORIGIN_MAX=10                     # Per origin per minute

# Security Settings
REQUIRE_HTTPS=true                                # Enforce HTTPS
ENABLE_IP_WHITELIST=false                        # Enable IP whitelisting
LOG_SENSITIVE_DATA=false                          # Never log sensitive data

# Logging
LOG_LEVEL=info
```

## 🔄 Code Reuse Strategy

### Shared Code (Copy to Service)
1. **Parser Classes**: Copy to service (or extract to shared package)
   - `src/lib/parsers/*` → `deep-search-service/src/parsers/*`
2. **Type Definitions**: Copy `ScrapeConfig`, `ParseResult`, etc.
   - `src/lib/scrapers/ScrapeConfig.ts` → `deep-search-service/src/scrapers/ScrapeConfig.ts`
   - `src/lib/parsers/types.ts` → `deep-search-service/src/parsers/types.ts`
3. **Worker Thread Code**: Copy `playwright-worker.ts`
   - `src/lib/workers/playwright-worker.ts` → `deep-search-service/src/workers/playwright-worker.ts`
   - `src/lib/workers/worker-messages.ts` → `deep-search-service/src/workers/worker-messages.ts`
4. **Scraper Infrastructure**: Copy browser pool and worker classes
   - `src/lib/scrapers/PersistentBrowserPool.ts` → `deep-search-service/src/scrapers/PersistentBrowserPool.ts`
   - `src/lib/scrapers/ScraperWorker.ts` → `deep-search-service/src/scrapers/ScraperWorker.ts`
   - `src/lib/scrapers/ScraperWorkerPool.ts` → `deep-search-service/src/scrapers/ScraperWorkerPool.ts`
5. **Utilities**: Copy helper functions
   - `src/lib/utils/openai-extractor.ts` → `deep-search-service/src/utils/openai-extractor.ts`

### Service-Specific Code (New)
1. **Express Routes**: New
2. **Request Validation**: New (with security checks)
3. **Authentication Middleware**: New (API key validation)
4. **Rate Limiting Middleware**: New
5. **Error Handling**: New (sanitized errors)
6. **Health Checks**: New
7. **Security Headers**: New
8. **Audit Logging**: New

## 🗑️ Next.js Backend Cleanup

### Files to Remove from Next.js (After Service Migration)

#### Scraper Infrastructure (Move to Service)
- ❌ `src/lib/scrapers/PersistentBrowserPool.ts` - Move to service
- ❌ `src/lib/scrapers/ScraperWorker.ts` - Move to service
- ❌ `src/lib/scrapers/ScraperWorkerPool.ts` - Move to service
- ❌ `src/lib/scrapers/PlaywrightScraper.ts` - Move to service (if exists)
- ❌ `src/lib/scrapers/single-source-processor.ts` - No longer needed (service handles this)
- ✅ `src/lib/scrapers/ScrapeConfig.ts` - Keep type definitions (or remove if not used)

#### Worker Thread Code (Move to Service)
- ❌ `src/lib/workers/playwright-worker.ts` - Move to service
- ❌ `src/lib/workers/worker-messages.ts` - Move to service
- ❌ `src/lib/workers/README.md` - Move to service (if needed)

#### Parser Classes (Move to Service)
- ❌ `src/lib/parsers/PartequiposParser.ts` - Move to service
- ❌ `src/lib/parsers/AgroCostaParser.ts` - Move to service
- ❌ `src/lib/parsers/GecolsaParser.ts` - Move to service
- ❌ `src/lib/parsers/ServitractorParser.ts` - Move to service
- ❌ `src/lib/parsers/ImportadoraGranAndinaParser.ts` - Move to service
- ❌ `src/lib/parsers/RetrotracParser.ts` - Move to service
- ❌ `src/lib/parsers/ParserFactory.ts` - Move to service
- ❌ `src/lib/parsers/BaseParser.ts` - Move to service
- ❌ `src/lib/parsers/interfaces/IParser.ts` - Move to service
- ❌ `src/lib/parsers/types.ts` - Move to service (or keep if shared types)

#### Build Scripts (Remove from Next.js)
- ❌ `scripts/build-worker.js` - No longer needed (service has its own build)

#### API Routes (Simplify)
- ✅ `src/app/api/search/deep-web/[originCode]/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/deep-web/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/agrocosta/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/gecolsa/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/partequipos/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/retrotrac/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/servitractor/route.ts` - **SIMPLIFY** (just call service)
- ✅ `src/app/api/search/importadoragranandina/route.ts` - **SIMPLIFY** (just call service)

### Simplified Next.js Endpoint Structure

#### Before (Current - Complex)
```typescript
// src/app/api/search/deep-web/[originCode]/route.ts
- Fetch endpoint from database
- Initialize PersistentBrowserPool
- Process endpoint with Playwright
- Parse content with parsers
- Apply business logic
- Return response
```

#### After (Simplified - Service Call)
```typescript
// src/app/api/search/deep-web/[originCode]/route.ts
- Authenticate user (Next.js session)
- Fetch endpoint config from database
- Build request payload
- Call Deep Search Service (HTTP request)
- Apply business logic (price markup, sorting)
- Return response
```

### Files to Keep in Next.js

#### Database & Configuration
- ✅ `prisma/schema.prisma` - Keep (DeepWebEndpoint model)
- ✅ `src/lib/prisma.ts` - Keep (database access)
- ✅ Database migrations - Keep

#### API Routes (Simplified)
- ✅ All `/api/search/deep-web/*` routes - Keep but simplify
- ✅ All `/api/search/{originCode}` routes - Keep but simplify

#### Utilities (If Still Used)
- ✅ `src/lib/utils/openai-extractor.ts` - **REMOVE** (moved to service)
- ✅ Other utilities - Keep if used elsewhere

## 🐳 Docker Configuration Changes

### Next.js Dockerfile - Remove Playwright

#### Current Dockerfile (With Playwright)
```dockerfile
# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 ... # Many Playwright dependencies

# Install Playwright browsers
RUN npx playwright install chromium

# Build worker thread
RUN npm run build:worker

# Copy Playwright modules
COPY --from=builder node_modules/playwright ./node_modules/playwright
COPY --from=builder node_modules/playwright-core ./node_modules/playwright-core

# Copy Playwright browsers
COPY --from=builder /app/.cache/ms-playwright /app/.cache/ms-playwright
```

#### Updated Dockerfile (Without Playwright)
```dockerfile
# Remove all Playwright-related dependencies
# No need for:
# - Playwright system dependencies (libnss3, libatk, etc.)
# - Playwright browser installation
# - Worker thread build
# - Playwright module copying
# - Browser cache copying

# Simplified Dockerfile:
FROM node:20-slim AS base

FROM base AS deps
WORKDIR /app
# Only install Node.js dependencies (no Playwright deps)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --prefer-offline --no-audit
RUN npx prisma generate

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (no worker thread build needed)
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Minimal system dependencies (no Playwright)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# No Playwright modules or browsers needed
# No worker thread files needed

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### Dockerfile Size Reduction

#### Before (With Playwright)
- **Base Image**: ~200MB
- **Playwright Dependencies**: ~150MB
- **Playwright Browsers**: ~300MB
- **Total**: ~650MB

#### After (Without Playwright)
- **Base Image**: ~200MB
- **Minimal Dependencies**: ~10MB
- **Total**: ~210MB

**Reduction**: ~440MB smaller image (68% reduction)

### Next.js Configuration Changes

#### `next.config.js` - Remove Playwright Externals

##### Current (With Playwright)
```javascript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'playwright-core'],
  },
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      // Exclude Playwright from bundle
      config.externals.push({
        'playwright': 'commonjs playwright',
        'playwright-core': 'commonjs playwright-core',
      });
      // Exclude worker thread files
      config.module.rules.unshift({
        test: /playwright-worker\.(ts|js)$/,
        loader: 'ignore-loader',
      });
    }
    return config;
  },
};
```

##### Updated (Without Playwright)
```javascript
const nextConfig = {
  // Remove Playwright-related config
  // No need for serverComponentsExternalPackages
  // No need for webpack Playwright externals
  // No need for worker thread exclusion
  
  output: 'standalone',
  images: {
    domains: ['localhost'],
  },
  // ... other config
};
```

### Package.json Changes

#### Remove Playwright Dependencies
```json
{
  "dependencies": {
    // Remove these:
    // "playwright": "^1.56.1",
  },
  "devDependencies": {
    // Remove these:
    // "esbuild": "^0.25.0",  // Only needed for worker build
    // "ignore-loader": "^0.1.2",  // Only for Playwright exclusion
  },
  "scripts": {
    // Remove this:
    // "build:worker": "node scripts/build-worker.js",
    
    // Update build script:
    "build": "next build",  // No longer needs build:worker
  }
}
```

### Environment Variables Cleanup

#### Remove from Next.js `.env`
```bash
# Remove these (no longer needed in Next.js):
# DEEP_WEB_WORKER_POOL_SIZE=4
# PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright

# Add these (for service communication):
DEEP_SEARCH_SERVICE_URL=https://deep-search-service:3001
DEEP_SEARCH_SERVICE_API_KEY=your-shared-secret-key
```

## 📝 Migration Checklist

### Phase 1: Service Setup
- [ ] Create new service repository
- [ ] Copy parser classes to service
- [ ] Copy worker thread code to service
- [ ] Copy scraper infrastructure to service
- [ ] Set up Express API in service
- [ ] Implement persistent sessions in service

### Phase 2: Next.js Cleanup
- [ ] Update `/api/search/deep-web/[originCode]/route.ts` to call service
- [ ] Update `/api/search/deep-web/route.ts` to call service
- [ ] Update all individual source routes to call service
- [ ] Remove `src/lib/scrapers/*` files (except types if needed)
- [ ] Remove `src/lib/workers/*` files
- [ ] Remove `src/lib/parsers/*` files
- [ ] Remove `scripts/build-worker.js`
- [ ] Remove `single-source-processor.ts`

### Phase 3: Docker & Build Cleanup
- [ ] Remove Playwright dependencies from `package.json`
- [ ] Remove `build:worker` script from `package.json`
- [ ] Remove Playwright system dependencies from Dockerfile
- [ ] Remove Playwright browser installation from Dockerfile
- [ ] Remove worker thread build from Dockerfile
- [ ] Remove Playwright module copying from Dockerfile
- [ ] Remove Playwright browser cache copying from Dockerfile
- [ ] Update `next.config.js` to remove Playwright externals
- [ ] Remove Playwright webpack rules from `next.config.js`

### Phase 4: Configuration Cleanup
- [ ] Remove Playwright env vars from Next.js `.env`
- [ ] Add service communication env vars to Next.js `.env`
- [ ] Update documentation to reflect changes
- [ ] Test simplified endpoints

### Phase 5: Verification
- [ ] Verify Next.js build works without Playwright
- [ ] Verify Docker image builds successfully
- [ ] Verify Docker image size is reduced
- [ ] Test all deep web search endpoints
- [ ] Verify service handles all requests correctly

## 📈 Monitoring & Observability

### Metrics to Track
- Request count per origin
- Average response time
- Error rate
- Browser pool utilization
- Queue depth
- Active session count per origin
- Session authentication status
- Context reuse rate (how often contexts are reused vs created)
- Memory usage per context

### Logging
- Structured logging (JSON format)
- Request/response logging
- Error stack traces
- Performance metrics

## ✅ Implementation Checklist

### Phase 1: Service Setup
- [ ] Initialize Node.js + TypeScript project
- [ ] Set up Express server
- [ ] Configure TypeScript
- [ ] Set up build scripts (worker thread compilation)
- [ ] Create Dockerfile (with Playwright)
- [ ] Copy parser classes from Next.js
- [ ] Copy worker thread code from Next.js
- [ ] Copy scraper infrastructure from Next.js

### Phase 2: Core Functionality
- [ ] Copy parser classes
- [ ] Copy worker thread code
- [ ] Implement persistent context caching
- [ ] Implement login-once-per-source logic
- [ ] Implement scraper service with session persistence
- [ ] Implement parser service
- [ ] Create search endpoint
- [ ] Add context validation and error recovery

### Phase 3: Integration & Next.js Cleanup
- [ ] Update Next.js API to call service (simplify endpoints)
- [ ] Remove scraper files from Next.js (`src/lib/scrapers/*`)
- [ ] Remove worker files from Next.js (`src/lib/workers/*`)
- [ ] Remove parser files from Next.js (`src/lib/parsers/*`)
- [ ] Remove build-worker script from Next.js
- [ ] Test end-to-end flow
- [ ] Handle errors gracefully

### Phase 4: Docker & Build Cleanup
- [ ] Remove Playwright from Next.js `package.json`
- [ ] Remove `build:worker` script from Next.js
- [ ] Update Next.js Dockerfile (remove Playwright dependencies)
- [ ] Update `next.config.js` (remove Playwright externals)
- [ ] Remove Playwright env vars from Next.js
- [ ] Verify Next.js builds without Playwright
- [ ] Verify Docker image size reduction

### Phase 5: Security Implementation
- [ ] Implement API key authentication
- [ ] Add request validation middleware
- [ ] Implement URL allowlist (SSRF prevention)
- [ ] Add rate limiting (per origin + global)
- [ ] Configure HTTPS/TLS
- [ ] Set up network isolation
- [ ] Implement secrets management
- [ ] Add security headers
- [ ] Set up audit logging
- [ ] Mask sensitive data in logs

### Phase 6: Production Ready
- [ ] Add health checks with session info
- [ ] Add monitoring/logging
- [ ] Performance testing
- [ ] Security testing
- [ ] Load testing
- [ ] Documentation

## 🎯 Summary

### Recommended Stack
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express
- **Scraping**: Playwright
- **Parsing**: Cheerio, jsdom
- **Deployment**: Docker

### Key Benefits
1. **Separation of Concerns**: Database logic in Next.js, scraping in service
2. **Scalability**: Service can scale independently
3. **Maintainability**: Clear boundaries between components
4. **Performance**: Browser pool management within service + persistent sessions
5. **Flexibility**: Can deploy service separately or together
6. **Session Persistence**: Login once per source, reuse forever (5-10s saved per request)
7. **Security**: Inter-service authentication, rate limiting, SSRF prevention, audit logging

### Session Persistence Benefits
- ✅ **Login Once**: Authenticate only on first request per source
- ✅ **Fast Searches**: No login overhead for subsequent requests
- ✅ **Better Performance**: 5-10 seconds saved per request after first
- ✅ **Reduced Load**: Less authentication requests to external sites
- ✅ **Better UX**: Faster response times for users

### Memory Considerations
- **6 Sources**: ~90-180MB for all persistent sessions
- **Per Source**: ~15-30MB (context + optional page)
- **Manageable**: Modern servers can easily handle this
- **Monitoring**: Track memory usage and context count

### Security Implementation Priority
1. **Critical**: API key authentication
2. **Critical**: Request validation and URL allowlist (SSRF prevention)
3. **High**: Rate limiting
4. **High**: HTTPS/TLS enforcement
5. **Medium**: Network isolation
6. **Medium**: Security headers
7. **Medium**: Audit logging
8. **Low**: IP whitelisting (if needed)

### Next Steps
1. Create service repository/project
2. Copy necessary code (parsers, workers, scrapers)
3. Implement persistent context caching (never-close sessions)
4. Implement Express API with session management
5. **Implement security layer** (authentication, validation, rate limiting)
6. Update Next.js API to call service (simplify endpoints)
7. **Remove Playwright from Next.js** (files, dependencies, Docker)
8. **Clean up Next.js Dockerfile** (remove Playwright, reduce size)
9. Test session persistence and error recovery
10. **Security testing** (authentication, rate limiting, SSRF prevention)
11. Deploy and monitor memory usage and security events

### Benefits of Cleanup
- ✅ **Smaller Next.js Image**: ~440MB reduction (68% smaller)
- ✅ **Faster Builds**: No Playwright browser installation
- ✅ **Simpler Codebase**: Clear separation of concerns
- ✅ **Easier Maintenance**: Scraping logic isolated in service
- ✅ **Better Scalability**: Service can scale independently

