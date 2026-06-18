# Deep Web Search - Class Diagram & Relationships

## 📐 Class Hierarchy

```
┌─────────────────────────────────────────┐
│         IParser (Interface)             │
├─────────────────────────────────────────┤
│ + originCode: string                    │
│ + parse(content, searchTerm):           │
│   Promise<ParseResult>                   │
│ + canParse(content): boolean            │
└─────────────────────────────────────────┘
                    ▲
                    │ implements
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────────────┐     ┌─────────────────┐
│ BaseParser    │     │ JsonParser      │
│ (Abstract)    │     │ (Generic)        │
├───────────────┤     ├─────────────────┤
│ + originCode  │     │ + originCode    │
│ + originName  │     │ + originName    │
│               │     │ + config        │
│ # loadCheerio │     │                 │
│ # extractText  │     │ + parse()      │
│ # extractNumber│    │ + canParse()    │
│ # normalizeRef │    └─────────────────┘
└───────────────┘
        ▲
        │ extends
        │
┌───────────────────────┐
│ PartequiposParser     │
├───────────────────────┤
│ + originCode          │
│ + originName          │
│                       │
│ + parse()             │
│ + canParse()          │
│ - extractReference()   │
└───────────────────────┘
```

## 🔗 Component Relationships

```
┌──────────────────────────────────────────────────────────┐
│              API Route (/api/search/deep-web)            │
├──────────────────────────────────────────────────────────┤
│  - Fetches endpoints from DB                             │
│  - Coordinates parallel execution                        │
│  - Merges results                                        │
└──────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌──────────────────────┐     ┌──────────────────────┐
│  PlaywrightScraper   │     │   ParserFactory      │
├──────────────────────┤     ├──────────────────────┤
│  - browser: Browser  │     │  - parsers: Map      │
│                      │     │                      │
│  + initialize()      │     │  + registerParser()  │
│  + scrape(config)    │     │  + getParser()       │
│  + close()           │     │  + detectParser()    │
└──────────────────────┘     └──────────────────────┘
              │                           │
              │                           │ uses
              │                           ▼
              │              ┌──────────────────────┐
              │              │    IParser            │
              │              │    (Interface)        │
              │              └──────────────────────┘
              │                           ▲
              │                           │ implements
              │                           │
              └───────────────────────────┼─────────────┐
                                          │             │
                              ┌───────────┴─────┐      │
                              │                 │      │
                    ┌──────────────────┐  ┌──────────────┐
                    │ PartequiposParser│  │ JsonParser   │
                    │                  │  │              │
                    │ Uses: Cheerio    │  │ Uses: JSON   │
                    │ for HTML parsing │  │ parsing      │
                    └──────────────────┘  └──────────────┘
```

## 📦 Data Flow

```
┌──────────────────┐
│ DeepWebEndpoint  │
│ (Database)       │
│                  │
│ - originCode     │
│ - url            │
│ - method         │
│ - token          │
│ - parserConfig   │
└──────────────────┘
         │
         │ fetched by
         ▼
┌──────────────────┐
│ API Route        │
└──────────────────┘
         │
         │ for each endpoint
         ▼
┌──────────────────┐
│ PlaywrightScraper│ ───┐
│                  │    │
│ Fetches:        │    │
│ - HTML content  │    │
│ - JSON response │    │
└──────────────────┘    │
         │              │
         │ returns      │
         ▼              │
┌──────────────────┐    │
│ Content (string) │────┘
│ or               │
│ Content (object) │
└──────────────────┘
         │
         │ routes to
         ▼
┌──────────────────┐
│ ParserFactory    │
│                  │
│ Selects parser   │
│ based on origin  │
└──────────────────┘
         │
         │ returns
         ▼
┌──────────────────┐
│ IParser instance │
│ (Parser subclass)│
└──────────────────┘
         │
         │ calls parse()
         ▼
┌──────────────────┐
│ ParseResult      │
│                  │
│ - originCode     │
│ - products[]      │
│ - metadata       │
└──────────────────┘
         │
         │ collected from all endpoints
         ▼
┌──────────────────┐
│ Unified Response │
│                  │
│ - results[]      │
│   - origin       │
│   - products     │
│   - status       │
└──────────────────┘
```

## 🔄 Parser Selection Logic

```
Start: Need to parse content for endpoint
         │
         ▼
┌────────────────────────┐
│ Check if custom parser │
│ registered for origin   │
└────────────────────────┘
         │
         ├─── Yes ──→ Use registered parser
         │
         └─── No ──→ Check parserConfig
                     │
                     ├─── type: "json" ──→ Use JsonParser with config
                     │
                     └─── type: "html" or null ──→ Use default (PartequiposParser)
```

## 🎨 Type Definitions

```typescript
// Core Types
interface IParser {
  originCode: string;
  parse(content: string | object, searchTerm: string): Promise<ParseResult>;
  canParse(content: string | object): boolean;
}

interface ParseResult {
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

interface Product {
  reference: string;
  description?: string;
  price?: number;
  stock?: number;
  hasStock: boolean;
  location?: string;
  imageUrl?: string;
  link?: string;
  brand?: string;
  origin: string;
  rawData?: any;
}

// Scraper Types
interface ScrapeConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeout: number;
  waitForSelector?: string;
}

// Factory Types
interface ParserConfig {
  type: 'html' | 'json';
  selectors?: {
    products: string;
    reference: string;
    price: string;
    stock: string;
    [key: string]: string;
  };
  jsonPaths?: {
    products: string;
    reference: string;
    price: string;
    stock: string;
    [key: string]: string;
  };
}
```

## 🏭 Factory Pattern Implementation

```typescript
ParserFactory
├── Static Map<originCode, IParser>
├── registerParser(parser: IParser)
│   └── Stores parser in map
│
├── getParser(endpoint: DeepWebEndpoint): IParser
│   ├── Check if registered → return it
│   ├── Check parserConfig.type === 'json' → new JsonParser()
│   └── Default → new PartequiposParser()
│
└── detectParser(content, originCode): IParser | null
    ├── Try each registered parser.canParse()
    └── Return first match or null
```

## 🔀 Execution Flow Summary

```
1. API receives request
   ↓
2. Fetch endpoints (DB)
   ↓
3. For each endpoint (parallel):
   ├─→ PlaywrightScraper.scrape()
   │   └─→ Returns HTML/JSON
   │
   ├─→ ParserFactory.getParser()
   │   └─→ Returns IParser instance
   │
   ├─→ parser.parse(content)
   │   └─→ Returns ParseResult
   │
   └─→ Collect all results
   ↓
4. Normalize & merge results
   ↓
5. Return unified response
```

---

This diagram shows the clean separation of concerns:
- **Scraping**: PlaywrightScraper handles fetching
- **Parsing**: Parser classes handle extraction
- **Routing**: Factory handles parser selection
- **Coordination**: API route handles orchestration

