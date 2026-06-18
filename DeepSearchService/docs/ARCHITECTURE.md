# DeepSearchService Architecture

## Overview

The DeepSearchService uses a **Strategy Pattern** architecture to handle different web scraping sources. Each source (website) can have its own custom handler with specialized logic for authentication, navigation, and scraping.

## Architecture Components

### 1. Source Handlers (`src/scrapers/handlers/`)

Each source has its own handler that implements the `ISourceHandler` interface:

- **`ISourceHandler`**: Interface defining the contract for all handlers
- **`BaseSourceHandler`**: Base class with common functionality
- **`DonssonHandler`**: Custom handler for DONSSON website
- **`AgroCostaHandler`**: Custom handler for AGROCOSTA website
- **`DefaultSourceHandler`**: Fallback handler for sources without custom logic

### 2. Handler Factory (`SourceHandlerFactory`)

Manages registration and retrieval of handlers:

```typescript
// Initialize on startup
SourceHandlerFactory.initialize();

// Get handler for a source
const handler = SourceHandlerFactory.getHandler('DONSSON');
```

### 3. Main Scraper (`puppeteer-scraper.ts`)

The main scraper now delegates to source handlers:

```typescript
// Get handler for source
const handler = SourceHandlerFactory.getHandler(originCode);

// Use handler to scrape
const content = await handler.scrape(page, config, reference);
```

## Benefits

1. **Separation of Concerns**: Each source's logic is isolated in its own handler
2. **Easy to Extend**: Add new sources by creating a new handler class
3. **Maintainable**: No more giant if/else chains in the main scraper
4. **Testable**: Each handler can be tested independently
5. **Flexible**: Each source can have completely custom logic

## Adding a New Source Handler

1. Create a new handler class extending `BaseSourceHandler`:

```typescript
// src/scrapers/handlers/NewSourceHandler.ts
import { BaseSourceHandler } from './BaseSourceHandler';
import { Page } from 'puppeteer';
import { EndpointConfig } from '../puppeteer-scraper';

export class NewSourceHandler extends BaseSourceHandler {
  readonly originCode = 'NEWSOURCE';

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    // Custom authentication check logic
  }

  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    // Custom scraping logic
  }
}
```

2. Register it in `SourceHandlerFactory`:

```typescript
// src/scrapers/handlers/SourceHandlerFactory.ts
import { NewSourceHandler } from './NewSourceHandler';

static initialize(): void {
  // ... existing handlers
  this.registerHandler(new NewSourceHandler());
}
```

3. Export it in `index.ts`:

```typescript
// src/scrapers/handlers/index.ts
export { NewSourceHandler } from './NewSourceHandler';
```

## Handler Interface

All handlers must implement:

- `checkAuthentication(page, loginUrl)`: Check if user is authenticated
- `scrape(page, config, reference)`: Execute the full scraping flow
- `postLoginNavigation?(page, config)`: Optional post-login navigation
- `getBrowserOptions?()`: Optional custom browser options

## Migration from Old Architecture

The old `checkAuthentication` function is still available but marked as `@deprecated`. It's kept for backward compatibility but new sources should use handlers.

Old code with if/else:
```typescript
if (originCode === 'DONSSON') {
  // DONSSON logic
} else if (originCode === 'AGROCOSTA') {
  // AGROCOSTA logic
}
```

New code with handlers:
```typescript
const handler = SourceHandlerFactory.getHandler(originCode);
await handler.scrape(page, config, reference);
```

## Current Handlers

All handlers implement `ISourceHandler` and return HTML content that parsers convert to standardized `Product` structure:

- **DONSSON**: Custom authentication check, shop page navigation, Select2 handling
- **AGROCOSTA**: Custom authentication check, search page navigation
- **GECOLSA**: Custom authentication check, Caterpillar parts store navigation
- **RETROTRAC**: Simple email input check for authentication
- **SERVITRACTOR**: Iframe-based login detection
- **MONTECARLO**: Portal navigation and shop page verification
- **PARTEQUIPOS**: Uses default handler (can be customized)
- **IMPORTADORAGRANANDINA**: Uses default handler (uses direct HTTP fetch in route)
- **Default**: Generic handler for sources without custom logic

## Product Structure

All handlers return HTML content that parsers convert to this standardized structure:

```typescript
interface Product {
  reference: string;        // Part number / SKU (required)
  description?: string;
  price?: number;          // Price in COP
  stock?: number;          // Available quantity
  hasStock: boolean;       // Required
  location?: string;       // Warehouse/location info
  imageUrl?: string;
  link?: string;           // Original product URL
  brand?: string;
  origin: string;          // Origin code (required)
  rawData?: any;          // Original extracted data
}
```

This ensures consistency across all sources regardless of their website's internal format.

## Future Enhancements

- ✅ All source handlers created (DONSSON, AGROCOSTA, GECOLSA, RETROTRAC, SERVITRACTOR, MONTECARLO, PARTEQUIPOS, IMPORTADORAGRANANDINA)
- Add handler-specific retry logic
- Add handler-specific error handling
- Add handler-specific session management
- Add handler-specific browser options (user agents, viewport sizes, etc.)

