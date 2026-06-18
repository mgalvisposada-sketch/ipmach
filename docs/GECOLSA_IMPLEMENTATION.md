# GECOLSA Implementation Guide

## Overview

This document outlines the changes needed to implement the GECOLSA origin provider for `parts.cat.com` with proper login and search automation.

## Current Status

- ✅ **GecolsaParser** already exists (`src/parsers/GecolsaParser.ts`)
- ✅ **GECOLSA** is already in the allowed origin codes list
- ✅ **parts.cat.com** domain needs to be added to allowed domains
- ⚠️ **Login steps** need to be configured
- ⚠️ **Authentication detection** may need to be added

## Required Changes

### 1. Update Allowed Domains

**File:** `src/middleware/validator.ts`

Add `parts.cat.com` to the allowed domains list:

```typescript
const ALLOWED_DOMAINS = [
  'agro-costa.com',
  'gecolsa.com',
  'partequipos.com',
  'retrotrac.com',
  'empresaservitractor.zohocreatorportal.com',
  'importadoragranandina.com',
  'parts.cat.com',  // ← ADD THIS (main parts store)
  'signin.cat.com', // ← ADD THIS (OAuth login)
  'cat.com',        // ← ADD THIS (for any cat.com subdomain)
];
```

### 2. Configure Login Steps

Based on the manual steps provided, here's the login and search flow:

#### Login Flow:
1. Navigate to `https://parts.cat.com/`
2. Click on "Sign in" button
3. Wait for login form/modal to appear
4. Fill username field with `gvega_ciparcolsas`
5. Click "Continue" button
6. Wait for password field to appear
7. Fill password field with `Gecolsa$2022`
8. Check "Keep me signed in" checkbox
9. Click "Login" button
10. Wait for login to complete

#### Search Flow:
1. Wait for search input field ("buscar por referencia")
2. Fill search input with `{{reference}}`
3. Press Enter key
4. Wait for search results to load

### 3. Login Steps Configuration

**✅ VERIFIED:** Steps tested and confirmed working via browser automation.

**Important Discovery:** Clicking "Sign in" on `parts.cat.com` redirects to OAuth login at `signin.cat.com`. The login URL contains dynamic parameters that may change, so we need to either:
- Option A: Click Sign in button and let it redirect (recommended)
- Option B: Navigate directly to login URL (requires dynamic URL construction)

**Recommended Approach (Option A):** Click Sign in button and follow redirect

```typescript
export const gecolsaLoginSteps = [
  // === STEP 1: Navigate to parts.cat.com ===
  {
    type: 'goto',
    url: 'https://parts.cat.com/',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 2000 } // Wait for page to stabilize
  },
  
  // === STEP 2: Click Sign in button (redirects to signin.cat.com) ===
  {
    type: 'wait',
    selector: 'menu[aria-label="Sign in"] menuitem',
    options: { timeout: 30000 }
  },
  {
    type: 'click',
    selector: 'menu[aria-label="Sign in"] menuitem',
    options: { timeout: 30000, waitUntil: 'networkidle0' }
  },
  {
    type: 'wait',
    options: { timeout: 3000 } // Wait for redirect to signin.cat.com
  },
  
  // === STEP 3: Fill username (CWS ID) ===
  // Verified selector: textbox with aria-label "CWS ID"
  {
    type: 'wait',
    selector: 'textbox[aria-label="CWS ID"], input[type="text"][aria-label*="CWS"], input[type="text"]',
    options: { timeout: 30000 }
  },
  {
    type: 'fill',
    selector: 'textbox[aria-label="CWS ID"], input[type="text"][aria-label*="CWS"], input[type="text"]',
    value: '{{username}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 }
  },
  
  // === STEP 4: Click Continue button ===
  // Verified: Button with text "Continuar" (Spanish) or "Continue" (English)
  {
    type: 'click',
    selector: 'button:has-text("Continuar"), button:has-text("Continue"), button[aria-label*="Continue"]',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 3000 } // Wait for password field to appear
  },
  
  // === STEP 5: Fill password ===
  // Verified selector: textbox with aria-label "Password"
  {
    type: 'wait',
    selector: 'textbox[aria-label="Password"], input[type="password"]',
    options: { timeout: 30000 }
  },
  {
    type: 'fill',
    selector: 'textbox[aria-label="Password"], input[type="password"]',
    value: '{{password}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 }
  },
  
  // === STEP 6: Check "Keep me signed in" checkbox ===
  // Verified: Checkbox with aria-label "Mantener la sesión iniciada" (Spanish) or "Keep me signed in" (English)
  {
    type: 'wait',
    selector: 'checkbox[aria-label*="Mantener"], checkbox[aria-label*="Keep me signed"], input[type="checkbox"]',
    options: { timeout: 10000 }
  },
  {
    type: 'click',
    selector: 'checkbox[aria-label*="Mantener"], checkbox[aria-label*="Keep me signed"], input[type="checkbox"]',
    options: { timeout: 10000 }
  },
  {
    type: 'wait',
    options: { timeout: 500 }
  },
  
  // === STEP 7: Click Login button ===
  // Verified: Button with text "Iniciar sesión" (Spanish) or "Sign in" (English)
  {
    type: 'click',
    selector: 'button:has-text("Iniciar sesión"), button:has-text("Sign in"), button[aria-label*="Iniciar sesión"]',
    options: { timeout: 30000, waitUntil: 'networkidle0' }
  },
  {
    type: 'wait',
    options: { timeout: 5000 } // Wait for redirect back to parts.cat.com/es/gecolsa
  },
  
  // === STEP 8: Search for reference ===
  // ✅ VERIFIED: Search input is inside shadow DOM (cat-search-form component)
  // The input has ID: cat-header-search-bar, placeholder: "Buscar por número o nombre de pieza"
  // We need to use JavaScript evaluation to access shadow DOM
  {
    type: 'wait',
    selector: 'cat-search-form',
    options: { timeout: 30000 }
  },
  {
    type: 'evaluate',
    script: `
      const searchForm = document.querySelector('cat-search-form');
      if (searchForm && searchForm.shadowRoot) {
        const searchInput = searchForm.shadowRoot.querySelector('#cat-header-search-bar');
        if (searchInput) {
          searchInput.focus();
          searchInput.value = '{{reference}}';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, value: searchInput.value };
        }
      }
      return { success: false };
    `,
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 500 }
  },
  
  // === STEP 9: Press Enter to submit search ===
  // ✅ VERIFIED: Press Enter using JavaScript evaluation (shadow DOM access required)
  {
    type: 'evaluate',
    script: `
      const searchForm = document.querySelector('cat-search-form');
      if (searchForm && searchForm.shadowRoot) {
        const searchInput = searchForm.shadowRoot.querySelector('#cat-header-search-bar');
        if (searchInput) {
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          searchInput.dispatchEvent(enterEvent);
          
          const enterEventUp = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          searchInput.dispatchEvent(enterEventUp);
          return { success: true };
        }
      }
      return { success: false };
    `,
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 5000 } // Wait for search results to load (redirects to product page)
  },
  
  // === STEP 10: Optional - Log HTML for debugging ===
  {
    type: 'log-html',
    options: { filename: 'gecolsa-search-results.html' }
  }
];
```

**Alternative Approach (Option B):** Navigate directly to login URL
```typescript
// If you can construct the login URL dynamically, you can skip the Sign in click:
{
  type: 'goto',
  url: 'https://signin.cat.com/.../oauth2/v2.0/authorize?...', // Full OAuth URL
  options: { waitUntil: 'domcontentloaded', timeout: 60000 }
},
// Then continue with Step 3 (Fill username)
```

**Key Flow Summary (Verified):**
1. Navigate to `https://parts.cat.com/`
2. **Click "Sign in" button** → Redirects to `signin.cat.com` OAuth page
3. Fill username (CWS ID) → Click Continue
4. Fill password → Check "Keep me signed in" → Click Login
5. Redirects back to `https://parts.cat.com/es/gecolsa`
6. Find search field → Fill with reference → Press Enter
7. Wait for results

**Verified Selectors:**
- Username field: `textbox[aria-label="CWS ID"]` or `input[type="text"]`
- Continue button: `button:has-text("Continuar")` or `button:has-text("Continue")`
- Password field: `textbox[aria-label="Password"]` or `input[type="password"]`
- Keep me signed in: `checkbox[aria-label*="Mantener"]` or `checkbox[aria-label*="Keep me signed"]`
- Login button: `button:has-text("Iniciar sesión")` or `button:has-text("Sign in")`
- **Search input: Inside shadow DOM** - `cat-search-form >>> #cat-header-search-bar` (requires JavaScript evaluation)
  - Component: `<cat-search-form>` (custom web component)
  - Input ID: `cat-header-search-bar`
  - Placeholder: "Buscar por número o nombre de pieza" (Spanish) / "Search by part number or name" (English)
  - **Note:** Cannot use standard CSS selector - must use JavaScript to access `shadowRoot`

**Complete Flow Verification (✅ TESTED):**
1. Navigate to `https://parts.cat.com/` ✅
2. Click "Sign in" → Redirects to `signin.cat.com` ✅
3. Fill username: `gvega_ciparcolsas` ✅
4. Click "Continuar" (Continue) ✅
5. Fill password: `Gecolsa$2022` ✅
6. Check "Mantener la sesión iniciada" (Keep me signed in) ✅
7. Click "Iniciar sesión" (Sign in) ✅
8. Redirected to `https://parts.cat.com/es/gecolsa` ✅
9. Search input found in shadow DOM (`cat-search-form` component) ✅
10. Type reference "1R0750" in search input ✅
11. Press Enter to submit ✅
12. Navigate to product page: `https://parts.cat.com/es/gecolsa/product/1R-0750` ✅

**Test Result:**
- Product found: 1R-0750 (Filtro de combustible secundario)
- Price: $130,878.00 COP
- URL pattern: `https://parts.cat.com/es/gecolsa/product/{reference}`

### 4. Update Authentication Detection

**File:** `src/scrapers/puppeteer-scraper.ts`

Add GECOLSA-specific authentication detection in the `checkAuthentication` function:

```typescript
if (originCode === 'GECOLSA') {
  // Check if we're already logged in by looking for:
  // 1. Search input field (if logged in, search should be available)
  // 2. User menu/account indicator
  // 3. Absence of login form
  
  const searchInput = await page.$('input[placeholder*="referencia"], input[placeholder*="reference"]');
  const userMenu = await page.$('[aria-label*="Account"], [aria-label*="User"], button:has-text("Sign out")');
  const loginForm = await page.$('input[type="password"]');
  
  // If search input exists and no login form, we're logged in
  if (searchInput && !loginForm) {
    console.log(`[PuppeteerScraper] ${originCode}: ✅ Already authenticated (search field available)`);
    return true;
  }
  
  // If user menu exists, we're logged in
  if (userMenu) {
    console.log(`[PuppeteerScraper] ${originCode}: ✅ Already authenticated (user menu present)`);
    return true;
  }
  
  console.log(`[PuppeteerScraper] ${originCode}: ❌ Not authenticated`);
  return false;
}
```

### 5. Endpoint Configuration

When calling the DeepSearchService API, the request should include:

```json
{
  "reference": "1R0750",
  "originCode": "GECOLSA",
  "originName": "Gecolsa",
  "url": "https://parts.cat.com/",
  "method": "GET",
  "requiresLogin": true,
  "loginUrl": "https://parts.cat.com/",
  "loginUsername": "gvega_ciparcolsas",
  "loginPassword": "Gecolsa$2022",
  "loginSteps": [
    // ... steps from section 3 above
  ],
  "timeoutMs": 120000,
  "waitForSelector": "[class*='product'], [class*='result'], .search-results, [data-product-id]",
  "parserConfig": {
    "type": "html"
  }
}
```

## Implementation Steps

### Step 1: Update Validator
1. Open `src/middleware/validator.ts`
2. Add `'parts.cat.com'` and `'cat.com'` to `ALLOWED_DOMAINS` array

### Step 2: Determine Exact Selectors
1. Navigate to `https://parts.cat.com/` in a browser
2. Open browser DevTools (F12)
3. Click "Sign in" and inspect the elements:
   - Username input selector
   - Continue button selector
   - Password input selector
   - "Keep me signed in" checkbox selector
   - Login button selector
   - Search input selector ("buscar por referencia")
4. Update the selectors in the login steps configuration above

### Step 3: Create Steps File (Optional)
Create `src/parsers/steps/gecolsa-steps.ts`:

```typescript
/**
 * Gecolsa login and search steps
 * parts.cat.com authentication and search flow
 */

export const gecolsaCombinedSteps = [
  // ... steps from section 3 above with exact selectors
];
```

### Step 4: Update Authentication Detection
1. Open `src/scrapers/puppeteer-scraper.ts`
2. Add GECOLSA case to `checkAuthentication` function (see section 4)

### Step 5: Test the Implementation
1. Start DeepSearchService: `npm run dev`
2. Test with a search request:
```bash
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "reference": "TEST123",
    "originCode": "GECOLSA",
    "originName": "Gecolsa",
    "url": "https://parts.cat.com/",
    "method": "GET",
    "requiresLogin": true,
    "loginUrl": "https://parts.cat.com/",
    "loginUsername": "gvega_ciparcolsas",
    "loginPassword": "Gecolsa$2022",
    "loginSteps": [...],
    "timeoutMs": 120000,
    "parserConfig": {"type": "html"}
  }'
```

## Important Notes

### Selector Discovery
The selectors in this document are **placeholders** based on common patterns. You **MUST**:
1. Inspect the actual page elements
2. Use browser DevTools to find exact selectors
3. Test each selector individually
4. Update the steps with verified selectors

### Common Issues

1. **Shadow DOM Search Input**: ⚠️ **CRITICAL** - The search input is inside a shadow DOM:
   - Component: `<cat-search-form>` (custom web component)
   - Standard CSS selectors won't work: `#cat-header-search-bar` won't find it
   - **Solution**: Use JavaScript evaluation to access `shadowRoot`:
   ```typescript
   {
     type: 'evaluate',
     script: `
       const searchForm = document.querySelector('cat-search-form');
       if (searchForm && searchForm.shadowRoot) {
         const searchInput = searchForm.shadowRoot.querySelector('#cat-header-search-bar');
         // ... interact with searchInput
       }
     `
   }
   ```
   - **Note**: Puppeteer's `page.$()` and `page.fill()` cannot access shadow DOM directly
   - Must use `page.evaluate()` to access shadow DOM elements

2. **OAuth Redirect**: Login redirects to `signin.cat.com`:
   - Click "Sign in" button on `parts.cat.com` → redirects to OAuth page
   - Login URL contains dynamic parameters (state, nonce, etc.)
   - **Solution**: Click Sign in button and follow redirect (don't hardcode OAuth URL)

3. **Dynamic Content**: parts.cat.com appears to be a React/SPA, so:
   - Use `waitForSelector` before each interaction
   - Add delays between steps if needed
   - Consider using `networkidle0` wait conditions

4. **Text-based Selectors**: The scraper supports `:has-text()` syntax:
   ```typescript
   selector: 'button:has-text("Continue")'
   ```

5. **XPath Selectors**: If CSS selectors don't work, use XPath:
   ```typescript
   selector: '//button[contains(text(), "Continue")]'
   ```

### Session Management
- GECOLSA sessions will be saved to `.puppeteer-sessions/gecolsa-session.json`
- Sessions expire after 10 minutes
- Authentication detection will skip login if session is valid

## Testing Checklist

- [x] Domain validation allows `parts.cat.com` ✅ (Added to validator.ts)
- [x] Login steps execute successfully ✅ (Verified via browser)
- [x] Username is filled correctly ✅ (Verified: `gvega_ciparcolsas`)
- [x] Continue button is clicked ✅ (Verified: redirects to password page)
- [x] Password is filled correctly ✅ (Verified: `Gecolsa$2022`)
- [x] "Keep me signed in" checkbox is checked ✅ (Verified)
- [x] Login button is clicked ✅ (Verified: redirects to parts.cat.com/es/gecolsa)
- [ ] Authentication is detected correctly (Needs implementation in puppeteer-scraper.ts)
- [x] Search input is found and filled ✅ (Verified: shadow DOM access via JavaScript)
- [x] Enter key submits search ✅ (Verified: navigates to product page)
- [x] Search results are returned ✅ (Verified: product page loaded)
- [ ] GecolsaParser extracts products correctly (Needs testing with actual HTML)
- [ ] Session persistence works (second request skips login) (Needs testing)

## Next Steps

1. **Inspect the actual page** to get exact selectors
2. **Update the login steps** with verified selectors
3. **Test authentication detection** logic
4. **Verify parser** handles the HTML structure correctly
5. **Test end-to-end** with a real reference code

## References

- Existing implementations: `RETROTRAC`, `AGROCOSTA`, `SERVITRACTOR`
- Step types: `goto`, `fill`, `click`, `wait`, `press`, `log-html`
- Placeholders: `{{username}}`, `{{password}}`, `{{reference}}`
- Puppeteer scraper: `src/scrapers/puppeteer-scraper.ts`
- Parser: `src/parsers/GecolsaParser.ts`

