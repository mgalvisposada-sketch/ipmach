# Deep Web Search Feature - Technical Analysis

## 📋 Executive Summary

This document outlines the architecture and implementation strategy for the "Deep Web Search" feature, which allows searching across multiple external endpoints that return HTML or JSON responses. Each origin will have its own dedicated parser class following an interface pattern.

## 🏗️ Architecture Overview

### High-Level Flow

```
User clicks "Deep Web Search" 
  ↓
Frontend sends request to /api/search/deep-web
  ↓
API fetches active endpoints from database
  ↓
For each endpoint:
  ├─→ Use Playwright to fetch HTML/JSON
  ├─→ Load HTML into Cheerio/jSDOM for parsing
  ├─→ Route to origin-specific parser class
  └─→ Extract structured data
  ↓
Merge and normalize results
  ↓
Return unified response to frontend
```

## 🗄️ Database Schema

### DeepWebEndpoint Model

```prisma
model DeepWebEndpoint {
  id                Int       @id @default(autoincrement())
  originCode        String    @unique @db.VarChar(50)  // e.g., "PARTEQUIPOS", "SERVICE2"
  name              String    @db.VarChar(255)          // Display name
  url               String    @db.Text                   // Full URL or template with {{reference}}
  method            HttpMethod @default(GET)            // GET or POST
  token             String?   @db.VarChar(500)          // Auth token value
  tokenHeaderName   String?   @db.VarChar(100)          // e.g., "Authorization", "X-API-Key"
  tokenPlacement    TokenPlacement @default(header)     // header, query, body
  requestBodyTemplate String? @db.Text                  // JSON template for POST
  isActive          Boolean   @default(true)
  parserConfig      Json?                              // Origin-specific parser config
  timeoutMs         Int       @default(30000)
  retryAttempts    Int       @default(1)
  waitForSelector   String?   @db.VarChar(200)          // Playwright selector to wait for
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([originCode])
  @@index([isActive])
}

enum HttpMethod {
  GET
  POST
}

enum TokenPlacement {
  header
  query
  body
}
```

### Search Result Storage (Optional - for caching)

```prisma
model DeepWebSearchCache {
  id          Int       @id @default(autoincrement())
  reference   String    @db.VarChar(100)
  originCode  String    @db.VarChar(50)
  results     Json
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  
  @@unique([reference, originCode])
  @@index([expiresAt])
}
```

## 🔧 Core Architecture: Interface & Classes

### 1. Base Interface

```typescript
// src/lib/parsers/interfaces/IParser.ts
export interface IParser {
  /**
   * Unique origin code this parser handles
   */
  readonly originCode: string;

  /**
   * Parse HTML/JSON response into standardized format
   */
  parse(content: string | object, searchTerm: string): Promise<ParseResult>;

  /**
   * Validate if the content structure matches this origin
   */
  canParse(content: string | object): boolean;
}

// src/lib/parsers/types.ts
export interface ParseResult {
  originCode: string;
  originName: string;
  searchTerm: string;
  products: Product[];
  metadata?: {
    totalFound?: number;
    hasMore?: boolean;
    rawResponse?: any;
  };
}

export interface Product {
  reference: string;        // Part number / SKU
  description?: string;
  price?: number;           // Price in COP
  stock?: number;           // Available quantity
  hasStock: boolean;
  location?: string;        // Warehouse/location info
  imageUrl?: string;
  link?: string;           // Original product URL
  brand?: string;
  origin: string;          // Origin code
  rawData?: any;           // Original extracted data
}
```

### 2. Base Parser Class

```typescript
// src/lib/parsers/BaseParser.ts
import { IParser, ParseResult, Product } from './interfaces/IParser';
import * as cheerio from 'cheerio';

export abstract class BaseParser implements IParser {
  abstract readonly originCode: string;
  abstract readonly originName: string;

  /**
   * Parse method - implemented by each origin-specific parser
   */
  abstract parse(content: string | object, searchTerm: string): Promise<ParseResult>;

  /**
   * Default implementation - check if content contains origin markers
   */
  canParse(content: string | object): boolean {
    // Can be overridden by child classes
    return true;
  }

  /**
   * Helper: Load HTML into Cheerio
   */
  protected loadCheerio(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Helper: Extract text from selector
   */
  protected extractText($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).first().text().trim();
  }

  /**
   * Helper: Extract number from text (removes currency symbols, commas)
   */
  protected extractNumber(text: string): number {
    const cleaned = text.replace(/[^\d.,-]/g, '').replace(',', '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Helper: Normalize reference (uppercase, trim)
   */
  protected normalizeReference(ref: string): string {
    return ref.trim().toUpperCase();
  }
}
```

### 3. Origin-Specific Parser Examples

#### Partequipos Parser (HTML - Magento)

```typescript
// src/lib/parsers/PartequiposParser.ts
import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './interfaces/IParser';
import * as cheerio from 'cheerio';

export class PartequiposParser extends BaseParser {
  readonly originCode = 'PARTEQUIPOS';
  readonly originName = 'Partequipos';

  canParse(content: string | object): boolean {
    if (typeof content !== 'string') return false;
    // Check for Partequipos-specific markers
    return content.includes('tienda.partequipos.com') || 
           content.includes('porto-icon') ||
           content.includes('product-item-info');
  }

  async parse(html: string, searchTerm: string): Promise<ParseResult> {
    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    // Find all product items
    // Based on HTML structure: <li class="item product product-item">
    $('.products.list.items.product-items li.product-item').each((_, element) => {
      const $item = $(element);
      
      // Extract reference from product name
      const productName = this.extractText($item, '.product-item-name .product-item-link');
      const reference = this.extractReference(productName);
      
      // Extract description
      const description = productName || this.extractText($item, '.product-item-description');
      
      // Extract price
      const priceText = this.extractText($item, '.price-wrapper .price');
      const price = this.extractNumber(priceText);
      
      // Extract stock availability
      const stockElement = $item.find('.stock.available');
      const hasStock = stockElement.length > 0;
      const stockText = this.extractText($item, '.stock.available span');
      const stock = hasStock ? this.extractNumber(stockText) : 0;
      
      // Extract product link
      const link = $item.find('.product-item-link').attr('href') || '';
      
      // Extract image
      const imageUrl = $item.find('.product-image-photo').attr('src') || '';

      if (reference) {
        products.push({
          reference: this.normalizeReference(reference),
          description,
          price,
          stock,
          hasStock,
          imageUrl,
          link: link.startsWith('http') ? link : `https://tienda.partequipos.com${link}`,
          origin: this.originCode,
        });
      }
    });

    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products,
      metadata: {
        totalFound: products.length,
      },
    };
  }

  private extractReference(text: string): string {
    // Extract part number from product name
    // Example: "DIENTE BALDE (GENERAL) 1U3202" -> "1U3202"
    const match = text.match(/\b([A-Z0-9]{4,})\b/);
    return match ? match[1] : text.trim();
  }
}
```

#### JSON Parser (Generic)

```typescript
// src/lib/parsers/JsonParser.ts
import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './interfaces/IParser';

export class JsonParser extends BaseParser {
  readonly originCode: string;
  readonly originName: string;
  private config: JsonParserConfig;

  constructor(originCode: string, originName: string, config: JsonParserConfig) {
    super();
    this.originCode = originCode;
    this.originName = originName;
    this.config = config;
  }

  canParse(content: string | object): boolean {
    return typeof content === 'object' && !Array.isArray(content) && content !== null;
  }

  async parse(json: object, searchTerm: string): Promise<ParseResult> {
    const products: Product[] = [];
    
    // Navigate JSON using config paths
    const items = this.getNestedValue(json, this.config.productsPath);
    
    if (!Array.isArray(items)) {
      return this.emptyResult(searchTerm);
    }

    items.forEach((item: any) => {
      const reference = this.getNestedValue(item, this.config.referencePath);
      const price = this.getNestedValue(item, this.config.pricePath);
      const stock = this.getNestedValue(item, this.config.stockPath);
      
      if (reference) {
        products.push({
          reference: this.normalizeReference(String(reference)),
          description: this.getNestedValue(item, this.config.descriptionPath),
          price: typeof price === 'number' ? price : this.extractNumber(String(price || '0')),
          stock: typeof stock === 'number' ? stock : parseInt(String(stock || '0')),
          hasStock: (stock || 0) > 0,
          origin: this.originCode,
          rawData: item,
        });
      }
    });

    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products,
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private emptyResult(searchTerm: string): ParseResult {
    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products: [],
    };
  }
}

interface JsonParserConfig {
  productsPath: string;      // e.g., "data.products" or "items"
  referencePath: string;     // e.g., "partNumber" or "sku"
  pricePath: string;         // e.g., "price" or "cost"
  stockPath: string;         // e.g., "quantity" or "stock"
  descriptionPath?: string;  // e.g., "description" or "name"
}
```

## 🛠️ Tool Selection & Usage Strategy

### 1. Playwright (Primary Tool)

**Why Playwright for all requests:**
- Handles JavaScript-rendered content
- Can wait for dynamic elements
- Supports authentication flows
- Can handle cookies and sessions
- Better for sites that detect headless browsers

**Implementation Pattern:**
```typescript
// src/lib/scrapers/PlaywrightScraper.ts
import { chromium, Browser, Page } from 'playwright';

export class PlaywrightScraper {
  private browser: Browser | null = null;

  async initialize() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async scrape(config: ScrapeConfig): Promise<string> {
    if (!this.browser) await this.initialize();
    const page = await this.browser!.newPage();

    try {
      // Set headers
      if (config.headers) {
        await page.setExtraHTTPHeaders(config.headers);
      }

      // Navigate or POST
      if (config.method === 'GET') {
        await page.goto(config.url, { waitUntil: 'networkidle', timeout: config.timeout });
      } else {
        await page.route('**/*', (route) => {
          route.fulfill({
            status: 200,
            body: config.body,
            headers: { 'Content-Type': 'application/json' },
          });
        });
        await page.goto(config.url, { waitUntil: 'networkidle' });
      }

      // Wait for selector if specified
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: config.timeout });
      }

      // Get content
      const content = await page.content();
      return content;
    } finally {
      await page.close();
    }
  }

  async close() {
    await this.browser?.close();
  }
}
```

### 2. Cheerio (HTML Parsing)

**When to use:**
- After Playwright fetches HTML
- Fast server-side HTML parsing
- jQuery-like API
- No browser overhead

**Usage:**
```typescript
import * as cheerio from 'cheerio';

const $ = cheerio.load(htmlString);
const products = $('.product-item').map((i, el) => {
  return {
    name: $(el).find('.product-name').text(),
    price: $(el).find('.price').text(),
  };
}).get();
```

### 3. jsdom (Fallback/DOM Manipulation)

**When to use:**
- When Cheerio limitations are hit
- Need actual DOM API
- Complex JavaScript interactions needed
- Cookie/session manipulation

**Usage:**
```typescript
import { JSDOM } from 'jsdom';

const dom = new JSDOM(htmlString);
const document = dom.window.document;

// Use standard DOM APIs
const products = document.querySelectorAll('.product-item');
```

## 📁 Proposed File Structure

```
src/
├── app/
│   └── api/
│       ├── search/
│       │   └── deep-web/
│       │       └── route.ts              # Main API endpoint
│       └── admin/
│           └── deep-web-endpoints/
│               ├── route.ts              # CRUD operations
│               └── [id]/
│                   └── route.ts           # Single endpoint ops
│
├── lib/
│   ├── parsers/
│   │   ├── interfaces/
│   │   │   └── IParser.ts                # Base interface
│   │   ├── types.ts                       # Shared types
│   │   ├── BaseParser.ts                  # Abstract base class
│   │   ├── PartequiposParser.ts           # Partequipos HTML parser
│   │   ├── JsonParser.ts                  # Generic JSON parser
│   │   ├── ParserFactory.ts               # Factory pattern
│   │   └── index.ts                       # Exports
│   │
│   └── scrapers/
│       ├── PlaywrightScraper.ts           # Playwright wrapper
│       ├── ScrapeConfig.ts                 # Configuration types
│       └── index.ts
│
└── components/
    ├── forms/
    │   └── SearchForm.tsx                 # Add deep web button
    └── search/
        └── DeepWebResults.tsx             # Results display component

prisma/
└── schema.prisma                          # Add DeepWebEndpoint model

docs/
└── DEEP_WEB_SEARCH_ANALYSIS.md            # This document
```

## 🔄 Processing Flow

### 1. Search Request Flow

```
User Action
  ↓
[Frontend] SearchForm.tsx
  ├─→ User enters reference
  ├─→ Clicks "Deep Web Search" button
  └─→ POST /api/search/deep-web { reference, clientId?, clientType? }
         ↓
[Backend] route.ts
  ├─→ Fetch all active endpoints from DB
  ├─→ For each endpoint (parallel):
  │    ├─→ Initialize PlaywrightScraper
  │    ├─→ Build request (headers, body, URL)
  │    ├─→ Scrape content (Playwright)
  │    ├─→ Route to ParserFactory
  │    └─→ Parse with origin-specific parser
  │         ↓
  └─→ Collect all results
       ↓
  ├─→ Normalize results (unify format)
  ├─→ Merge duplicates (same reference)
  └─→ Return unified response
         ↓
[Frontend] DeepWebResults.tsx
  ├─→ Display results grouped by origin
  ├─→ Show origin badges
  └─→ Allow adding to quote
```

### 2. Parser Factory Pattern

```typescript
// src/lib/parsers/ParserFactory.ts
import { IParser } from './interfaces/IParser';
import { PartequiposParser } from './PartequiposParser';
import { JsonParser } from './JsonParser';
import { DeepWebEndpoint } from '@prisma/client';

export class ParserFactory {
  private static parsers = new Map<string, IParser>();

  static registerParser(parser: IParser) {
    this.parsers.set(parser.originCode, parser);
  }

  static getParser(endpoint: DeepWebEndpoint): IParser {
    // Check if custom parser exists
    const existing = this.parsers.get(endpoint.originCode);
    if (existing) return existing;

    // Auto-detect parser type based on config or content
    if (endpoint.parserConfig) {
      const config = endpoint.parserConfig as any;
      if (config.type === 'json') {
        return new JsonParser(
          endpoint.originCode,
          endpoint.name,
          config
        );
      }
    }

    // Default to Partequipos parser for HTML
    return new PartequiposParser();
  }

  static detectParser(content: string | object, originCode: string): IParser | null {
    // Try each parser to see which can handle it
    for (const parser of this.parsers.values()) {
      if (parser.canParse(content)) {
        return parser;
      }
    }
    return null;
  }
}

// Register parsers at startup
ParserFactory.registerParser(new PartequiposParser());
```

## 📦 Required Dependencies

### NPM Packages to Install

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "cheerio": "^1.0.0-rc.12",
    "jsdom": "^23.0.0"
  },
  "devDependencies": {
    "@types/jsdom": "^21.1.6"
  }
}
```

### Installation Commands

```bash
npm install playwright cheerio jsdom
npm install -D @types/jsdom

# Install Playwright browsers
npx playwright install chromium
```

## 🎯 Parser Implementation Strategy Per Origin

### Pattern for Each Origin

1. **Create Parser Class** extending `BaseParser`
2. **Implement `parse()` method** with origin-specific logic
3. **Register in Factory** at startup
4. **Test with sample HTML/JSON** from that origin

### Example Origin Configurations

#### Origin 1: Partequipos (HTML - Magento)
```typescript
{
  originCode: 'PARTEQUIPOS',
  url: 'https://tienda.partequipos.com/catalogsearch/result/?q={{reference}}',
  method: 'GET',
  waitForSelector: '.products.list.items.product-items',
  parserType: 'html',
  selectors: {
    products: '.product-item',
    reference: '.product-item-name .product-item-link',
    price: '.price-wrapper .price',
    stock: '.stock.available',
    link: '.product-item-link'
  }
}
```

#### Origin 2: JSON Service
```typescript
{
  originCode: 'SERVICE2',
  url: 'https://api.example.com/search',
  method: 'POST',
  tokenHeaderName: 'Authorization',
  tokenPlacement: 'header',
  requestBodyTemplate: '{"searchText":"{{reference}}","pageSize":12}',
  parserType: 'json',
  jsonPaths: {
    products: 'data.items',
    reference: 'partNumber',
    price: 'price',
    stock: 'quantity'
  }
}
```

## 🔐 Security Considerations

1. **Token Storage**: Store tokens encrypted in database
2. **Rate Limiting**: Implement per-origin rate limits
3. **Timeout Protection**: Always use timeouts to prevent hanging
4. **Error Isolation**: One endpoint failure shouldn't break others
5. **Input Sanitization**: Sanitize search terms before use in URLs
6. **CORS Handling**: Playwright handles CORS, but log issues

## 📊 Result Normalization

All parsers should return `ParseResult` with `Product[]` following this structure:

```typescript
{
  reference: string,      // REQUIRED - normalized (uppercase, trimmed)
  description?: string,
  price?: number,        // In COP
  stock?: number,
  hasStock: boolean,     // REQUIRED
  location?: string,
  imageUrl?: string,
  link?: string,
  brand?: string,
  origin: string,        // REQUIRED - origin code
  rawData?: any         // Original data for debugging
}
```

## 🧪 Testing Strategy

1. **Unit Tests**: Each parser class independently
2. **Integration Tests**: Full flow with mock Playwright
3. **Sample Data**: Store sample HTML/JSON per origin for testing
4. **Error Handling**: Test invalid responses, timeouts, malformed data

## 📝 Next Steps

1. ✅ **Review this analysis**
2. ⏳ **Provide sample responses** for each origin
3. ⏳ **Define origin codes** and names
4. ⏳ **Implement database schema**
5. ⏳ **Implement base classes and interfaces**
6. ⏳ **Implement PlaywrightScraper**
7. ⏳ **Implement parsers per origin** (as samples provided)
8. ⏳ **Create API endpoint**
9. ⏳ **Update frontend components**
10. ⏳ **Add admin UI** for managing endpoints

## ❓ Questions to Resolve

1. **Origin Codes**: What are the exact origin codes? (e.g., "PARTEQUIPOS", "SERVICE2")
2. **Admin UI**: Should endpoints be manageable via UI or just database?
3. **Caching**: Should we cache results? For how long?
4. **Rate Limits**: Any specific rate limits per origin?
5. **Error Handling**: How should partial failures be displayed to users?
6. **Priority**: Should results from certain origins be prioritized?

---

**Status**: ⏸️ Awaiting sample responses and origin codes before implementation

