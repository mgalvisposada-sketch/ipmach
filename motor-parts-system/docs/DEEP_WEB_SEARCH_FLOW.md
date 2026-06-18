# Deep Web Search - Flow Diagrams

## Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SearchForm Component                      │  │
│  │                                                         │  │
│  │  [Reference Input]  [Client Select]                    │  │
│  │                                                         │  │
│  │  [🔍 Buscar]  [🌐 Deep Web Search]  ← NEW BUTTON      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ POST /api/search/deep-web
                            │ { reference, clientId?, clientType? }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route: /api/search/deep-web                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Fetch active endpoints from database             │  │
│  │     SELECT * FROM DeepWebEndpoint WHERE isActive=true │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2. Parallel processing (Promise.all)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐            │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │Endpoint 1│      │Endpoint 2│      │Endpoint N│          │
│  │PARTEQUIP │      │SERVICE2  │      │SERVICE3  │          │
│  └──────────┘      └──────────┘      └──────────┘          │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
```

## Scraping Flow per Endpoint

```
┌─────────────────────────────────────────────────────────────┐
│           For Each Endpoint (Parallel Execution)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 1: Initialize Playwright                        │  │
│  │    └─→ Launch browser (headless)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 2: Prepare Request                             │  │
│  │    ├─→ Replace {{reference}} in URL                  │  │
│  │    ├─→ Build headers (add token if needed)            │  │
│  │    └─→ Build body (for POST requests)                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 3: Execute Request (Playwright)                │  │
│  │    ├─→ GET: page.goto(url)                           │  │
│  │    ├─→ POST: page.route() + page.goto()              │  │
│  │    ├─→ Wait for selector (if specified)              │  │
│  │    └─→ Extract HTML content                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 4: Route to Parser                             │  │
│  │    └─→ ParserFactory.getParser(endpoint)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 5: Parse Content                               │  │
│  │    ├─→ HTML: Load into Cheerio                      │  │
│  │    ├─→ JSON: Parse directly                         │  │
│  │    └─→ Extract products using origin-specific logic │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 6: Normalize to Product[]                      │  │
│  │    └─→ Return ParseResult                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────┐
          │   Merge All Results                 │
          │   ├─→ Combine products              │
          │   ├─→ Group by origin               │
          │   ├─→ Deduplicate (optional)        │
          │   └─→ Sort by relevance/stock      │
          └─────────────────────────────────────┘
                             │
                             ▼
                    Return to Frontend
```

## Parser Selection Flow

```
                    Content Received
                            │
                            ▼
          ┌─────────────────────────────────┐
          │   Check Content Type            │
          └─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
        HTML String                  JSON Object
              │                           │
              ▼                           ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ Load Cheerio     │      │ Parse JSON       │
    │ const $ =        │      │ Direct access    │
    │   cheerio.load() │      │ to properties    │
    └──────────────────┘      └──────────────────┘
              │                           │
              ▼                           ▼
    ┌──────────────────────────────────────────┐
    │   ParserFactory.getParser(endpoint)      │
    └──────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ Origin Parser   │      │ Generic JSON      │
    │ (if registered)  │      │ Parser           │
    │                  │      │ (if config)      │
    │ e.g.,            │      │                  │
    │ PartequiposParser│      │ JsonParser       │
    └──────────────────┘      └──────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            │
                            ▼
                 Execute parser.parse()
                            │
                            ▼
                    ParseResult Returned
```

## Error Handling Flow

```
                    Request Starts
                            │
                            ▼
          ┌─────────────────────────────────┐
          │   For Each Endpoint              │
          └─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         Success                      Error Occurs
              │                           │
              ▼                           ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ Parse Content    │      │ Log Error        │
    │ Return Products  │      │ Continue with    │
    │                  │      │ Other Endpoints  │
    └──────────────────┘      └──────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            │
                            ▼
          ┌─────────────────────────────────┐
          │   Collect Results               │
          │   ├─→ Successful: Products     │
          │   └─→ Failed: Error Info       │
          └─────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────┐
          │   Return Response                │
          │   {                              │
          │     success: true,                │
          │     results: [                   │
          │       {                          │
          │         origin: 'PARTEQUIPOS',   │
          │         products: [...],         │
          │         status: 'success'        │
          │       },                         │
          │       {                          │
          │         origin: 'SERVICE2',      │
          │         products: [],            │
          │         status: 'error',         │
          │         error: 'Timeout'         │
          │       }                          │
          │     ]                            │
          │   }                              │
          └─────────────────────────────────┘
```

## Frontend Display Flow

```
                    Results Received
                            │
                            ▼
          ┌─────────────────────────────────┐
          │   DeepWebResults Component       │
          └─────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────┐
          │   Group by Origin                │
          │   └─→ Create sections per origin│
          └─────────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────────────┐
    │   Render Results                        │
    │                                         │
    │   ┌─────────────────────────────────┐  │
    │   │  PARTEQUIPOS (3 results)        │  │
    │   │  ┌───────────────────────────┐  │  │
    │   │  │ Reference | Price | Stock │  │  │
    │   │  │ [Add to Quote]            │  │  │
    │   │  └───────────────────────────┘  │  │
    │   └─────────────────────────────────┘  │
    │                                         │
    │   ┌─────────────────────────────────┐  │
    │   │  SERVICE2 (2 results)           │  │
    │   │  ┌───────────────────────────┐  │  │
    │   │  │ Reference | Price | Stock │  │  │
    │   │  │ [Add to Quote]            │  │  │
    │   │  └───────────────────────────┘  │  │
    │   └─────────────────────────────────┘  │
    │                                         │
    │   ┌─────────────────────────────────┐  │
    │   │  SERVICE3 (Error)               │  │
    │   │  ⚠️ Failed to fetch results      │  │
    │   └─────────────────────────────────┘  │
    └─────────────────────────────────────────┘
```

