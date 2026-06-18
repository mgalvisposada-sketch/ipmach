# Search Steps Configuration Examples

This document provides examples of how to configure `searchSteps` for different sources that require multi-step search flows.

## Overview

The `searchSteps` field in the `DeepWebEndpoint` table allows you to define step-by-step instructions for searching references. This is useful when:
- The search requires navigating to a search page first
- You need to fill a search form
- You need to click multiple buttons
- The search URL doesn't directly accept the reference as a parameter

## Step Types

- **`goto`** / **`navigate`**: Navigate to a URL
- **`fill`**: Fill an input field (supports `{{reference}}` placeholder)
- **`click`**: Click a button or element
- **`wait`**: Wait for a selector or timeout
- **`select`**: Select an option from a dropdown
- **`press`**: Press a key on an element

## Placeholders

- `{{reference}}`: Replaced with the actual reference being searched
- `{{username}}`: Replaced with login username (if available)
- `{{password}}`: Replaced with login password (if available)

## Example 1: Simple Search Form

**Scenario**: Navigate to search page, fill search field, click search button

```json
[
  {
    "type": "goto",
    "url": "https://example.com/search",
    "options": {
      "waitUntil": "domcontentloaded",
      "timeout": 40000
    }
  },
  {
    "type": "wait",
    "selector": "input[name='search']",
    "options": {
      "timeout": 10000
    }
  },
  {
    "type": "fill",
    "selector": "input[name='search']",
    "value": "{{reference}}",
    "options": {
      "delay": 50
    }
  },
  {
    "type": "click",
    "selector": "button[type='submit']",
    "options": {
      "waitUntil": "networkidle"
    }
  },
  {
    "type": "wait",
    "selector": ".results-container",
    "options": {
      "timeout": 15000
    }
  }
]
```

## Example 2: Multi-Page Search Flow

**Scenario**: Navigate to dashboard, then to search, then search

```json
[
  {
    "type": "goto",
    "url": "https://example.com/dashboard",
    "options": {
      "waitUntil": "networkidle"
    }
  },
  {
    "type": "click",
    "selector": "a[href='/search']",
    "options": {
      "waitUntil": "domcontentloaded"
    }
  },
  {
    "type": "wait",
    "selector": "#search-input",
    "options": {
      "timeout": 10000
    }
  },
  {
    "type": "fill",
    "selector": "#search-input",
    "value": "{{reference}}"
  },
  {
    "type": "press",
    "selector": "#search-input",
    "options": {
      "key": "Enter"
    }
  },
  {
    "type": "wait",
    "selector": ".product-list",
    "options": {
      "timeout": 20000
    }
  }
]
```

## Example 3: Search with Dropdown Selection

**Scenario**: Select category, then search

```json
[
  {
    "type": "goto",
    "url": "https://example.com/search"
  },
  {
    "type": "select",
    "selector": "select[name='category']",
    "value": "parts"
  },
  {
    "type": "fill",
    "selector": "input[name='partNumber']",
    "value": "{{reference}}"
  },
  {
    "type": "click",
    "selector": "#search-btn"
  },
  {
    "type": "wait",
    "selector": ".results",
    "options": {
      "timeout": 15000
    }
  }
]
```

## Example 4: Search with URL Template

**Scenario**: Navigate to URL with reference in path

```json
[
  {
    "type": "goto",
    "url": "https://example.com/search/{{reference}}",
    "options": {
      "waitUntil": "networkidle",
      "timeout": 40000
    }
  },
  {
    "type": "wait",
    "selector": ".search-results",
    "options": {
      "timeout": 15000
    }
  }
]
```

## Example 5: Partequipos (Example)

```json
[
  {
    "type": "goto",
    "url": "https://partequipos.com/buscar",
    "options": {
      "waitUntil": "domcontentloaded"
    }
  },
  {
    "type": "wait",
    "selector": "input#busqueda",
    "options": {
      "timeout": 10000
    }
  },
  {
    "type": "fill",
    "selector": "input#busqueda",
    "value": "{{reference}}",
    "options": {
      "delay": 100
    }
  },
  {
    "type": "click",
    "selector": "button.buscar",
    "options": {
      "waitUntil": "networkidle"
    }
  },
  {
    "type": "wait",
    "selector": ".resultados",
    "options": {
      "timeout": 20000
    }
  }
]
```

## Example 6: Servitractor (Example)

```json
[
  {
    "type": "goto",
    "url": "https://empresaservitractor.zohocreatorportal.com/digital_servitractor/modulo-empresarial-servitracotr/report/Art_culos_Report",
    "options": {
      "waitUntil": "domcontentloaded"
    }
  },
  {
    "type": "wait",
    "selector": "input[placeholder*='buscar']",
    "options": {
      "timeout": 10000
    }
  },
  {
    "type": "fill",
    "selector": "input[placeholder*='buscar']",
    "value": "{{reference}}"
  },
  {
    "type": "press",
    "selector": "input[placeholder*='buscar']",
    "options": {
      "key": "Enter"
    }
  },
  {
    "type": "wait",
    "timeout": 3000
  }
]
```

## Database Update Example

To update an endpoint with search steps:

```sql
UPDATE "DeepWebEndpoint"
SET "searchSteps" = '[
  {
    "type": "goto",
    "url": "https://example.com/search",
    "options": {
      "waitUntil": "domcontentloaded"
    }
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

Or using Prisma:

```typescript
await prisma.deepWebEndpoint.update({
  where: { originCode: 'PARTEQUIPOS' },
  data: {
    searchSteps: [
      {
        type: 'goto',
        url: 'https://example.com/search',
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

## Tips

1. **Always wait for elements** before interacting with them
2. **Use `{{reference}}` placeholder** in fill steps for the reference value
3. **Add delays** between steps to simulate human behavior
4. **Wait for results** after search to ensure content is loaded
5. **Test steps manually first** using Playwright codegen
6. **Use specific selectors** (IDs, data attributes) when possible
7. **Handle dynamic content** with appropriate wait strategies

## Recording Steps with Playwright Codegen

Use the provided script to record steps:

```bash
npm run codegen:record PARTEQUIPOS https://partequipos.com/search
```

This will:
1. Open a browser window
2. Record your actions
3. Generate step instructions
4. Save to `scripts/recorded-steps/partequipos.json`

Then copy the JSON to your database.


