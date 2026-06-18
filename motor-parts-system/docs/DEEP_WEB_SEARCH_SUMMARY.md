# Deep Web Search - Quick Reference Summary

## 🎯 Core Concept

**Single button** in search form that triggers searches across **multiple external endpoints** (HTML or JSON), with each origin having its **own dedicated parser class**.

## 📊 Key Components

### 1. Database Table
```prisma
DeepWebEndpoint {
  originCode (unique identifier)
  url (with {{reference}} placeholder)
  method (GET/POST)
  token + tokenHeaderName + tokenPlacement
  requestBodyTemplate (for POST)
  parserConfig (JSON - origin-specific settings)
}
```

### 2. Architecture Pattern
```
Interface (IParser)
    ↓
BaseParser (abstract class)
    ↓
Origin-Specific Parsers (PartequiposParser, Service2Parser, etc.)
```

### 3. Tool Stack
- **Playwright**: Primary tool for ALL requests (handles JS-rendered content)
- **Cheerio**: HTML parsing after Playwright fetches content
- **jsdom**: Fallback for complex DOM manipulation

## 🔄 Processing Steps

1. User clicks "Deep Web Search" button
2. API fetches active endpoints from database
3. **Parallel execution** for each endpoint:
   - Playwright fetches content (HTML/JSON)
   - Route to origin-specific parser
   - Parse and extract products
4. Merge and normalize results
5. Return unified response

## 📝 Implementation Checklist

### Phase 1: Foundation
- [ ] Add `DeepWebEndpoint` model to Prisma schema
- [ ] Install dependencies: `playwright`, `cheerio`, `jsdom`
- [ ] Create base interface `IParser`
- [ ] Create abstract `BaseParser` class
- [ ] Create `ParserFactory` class

### Phase 2: Scraping Infrastructure
- [ ] Create `PlaywrightScraper` wrapper class
- [ ] Implement request building (headers, tokens, body)
- [ ] Add error handling and timeout logic

### Phase 3: Parser Implementation
- [ ] Create `PartequiposParser` (based on provided HTML sample)
- [ ] Create `JsonParser` generic class
- [ ] Register parsers in factory
- [ ] **Wait for additional origin samples** to create more parsers

### Phase 4: API Endpoint
- [ ] Create `/api/search/deep-web` route
- [ ] Implement parallel endpoint processing
- [ ] Add result normalization and merging
- [ ] Error handling per endpoint

### Phase 5: Frontend
- [ ] Add "Deep Web Search" button to `SearchForm`
- [ ] Create `DeepWebResults` component
- [ ] Integrate with existing quote system

### Phase 6: Admin (Optional)
- [ ] Create admin UI for managing endpoints
- [ ] Or use Prisma Studio / direct DB access

## 🛠️ Dependencies to Install

```bash
npm install playwright cheerio jsdom
npm install -D @types/jsdom
npx playwright install chromium
```

## 📋 File Structure

```
src/lib/
├── parsers/
│   ├── interfaces/IParser.ts       ← Base interface
│   ├── BaseParser.ts               ← Abstract base class
│   ├── PartequiposParser.ts        ← Origin 1 parser
│   ├── JsonParser.ts               ← Generic JSON parser
│   └── ParserFactory.ts            ← Factory pattern
└── scrapers/
    └── PlaywrightScraper.ts        ← Playwright wrapper

src/app/api/search/deep-web/
└── route.ts                        ← Main API endpoint

src/components/
├── forms/SearchForm.tsx            ← Add button here
└── search/DeepWebResults.tsx       ← Results display
```

## 🔑 Key Design Decisions

1. **Playwright for ALL**: Every request uses Playwright (not just JS-heavy sites)
2. **Class per Origin**: Each origin has dedicated parser class
3. **Interface Pattern**: All parsers implement `IParser` interface
4. **Factory Pattern**: ParserFactory routes to correct parser
5. **Parallel Execution**: All endpoints queried simultaneously
6. **Error Isolation**: One endpoint failure doesn't break others

## 📥 Next Steps

**Waiting for:**
1. ✅ Analysis review
2. ⏳ Sample HTML/JSON responses for each origin
3. ⏳ Origin codes list (e.g., "PARTEQUIPOS", "SERVICE2")
4. ⏳ Confirmation of approach

**Then implement:**
- Database schema
- Base classes
- Playwright scraper
- Parsers per origin (as samples provided)
- API endpoint
- Frontend components

## ❓ Open Questions

1. Origin codes naming convention?
2. Admin UI needed or DB-only management?
3. Caching strategy?
4. Rate limiting requirements?
5. Error display preferences?

---

**Status**: ⏸️ Analysis complete - awaiting sample responses for implementation

