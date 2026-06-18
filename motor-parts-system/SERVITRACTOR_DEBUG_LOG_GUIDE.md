# Servitractor Debug Logging Guide

## Overview
This document explains the comprehensive logging added to debug the Servitractor automation timeout issue. The logs track the entire flow from endpoint configuration through HTML extraction and parsing.

## Log Flow

### 1. **Single Source Processor** (`src/lib/scrapers/single-source-processor.ts`)
**Purpose**: Verify endpoint timeout configuration is being read correctly

```
[SingleSourceProcessor] SERVITRACTOR has X search steps configured
[SingleSourceProcessor] SERVITRACTOR endpoint.timeoutMs: 90000
[SingleSourceProcessor] SERVITRACTOR passing timeout to scraper: 90000
```

### 2. **ScraperWorker** (`src/lib/scrapers/ScraperWorker.ts`)
**Purpose**: Confirm timeout is received and applied to worker request

```
[ScraperWorker] scrape() received config.timeout: 90000
[ScraperWorker] Request config timeout: 90000
[ScraperWorker] Using config timeout 90000ms + 30s buffer = 120000ms
[ScraperWorker] Final request timeout set to: 120000ms
```

### 3. **Playwright Worker** (`src/lib/workers/playwright-worker.ts`)
**Purpose**: Track entire automation execution and content extraction

#### 3.1 Initial Request
```
[PlaywrightWorker] Starting scrape: https://...
[PlaywrightWorker] Received config.timeout: 90000
[PlaywrightWorker] Will use timeout: 90000
```

#### 3.2 Login Steps (if needed)
```
[PlaywrightWorker] Using step-based login flow
[PlaywrightWorker] Already logged in - skipping login steps
```

#### 3.3 Search Steps Execution
```
[PlaywrightWorker] Using step-based search flow
[PlaywrightWorker] Executing step X of Y...
```

#### 3.4 **CRITICAL: Immediate HTML Check**
```
[PlaywrightWorker] ========== AFTER SEARCH STEPS ==========
[PlaywrightWorker] Current URL: https://empresaservitractor.zohocreatorportal.com/#Page:result1?busqueda=...
[PlaywrightWorker] Page title: Resultados
[PlaywrightWorker] Immediate HTML length: 350000 characters
[PlaywrightWorker] ✅✅✅ TILE STRUCTURE DETECTED - Content is ready!
[PlaywrightWorker] Setting content and will skip additional waits
[PlaywrightWorker] ✅ Final HTML saved (350000 chars) to: /path/to/file.html
[PlaywrightWorker] ✅ RETURNING CONTENT IMMEDIATELY - No need to wait for selectors
```

**OR** (if tile structure not detected):
```
[PlaywrightWorker] ⚠️ No tile structure found in immediate HTML
[PlaywrightWorker] ⚠️ No immediate content with tiles, waiting for selectors...
[PlaywrightWorker] Waiting for selector: main
```

#### 3.5 Content Skipping Logic
```
[PlaywrightWorker] ✅✅✅ Using immediate content with tile structure - SKIPPED all additional waits
[PlaywrightWorker] Content length: 350000 characters
```

#### 3.6 Final Content Confirmation
```
[PlaywrightWorker] ==========================================
[PlaywrightWorker] ✅ FINAL: Extracted 350000 characters from search results page
[PlaywrightWorker] ✅ FINAL: Current URL: https://...
[PlaywrightWorker] ✅ FINAL: Ready to return content to parser
[PlaywrightWorker] ==========================================
```

#### 3.7 **CRITICAL: Return Response**
```
[PlaywrightWorker] ==========================================
[PlaywrightWorker] ✅✅✅ RETURNING SUCCESS RESPONSE
[PlaywrightWorker] Content length: 350000
[PlaywrightWorker] Request ID: abc-123
[PlaywrightWorker] ==========================================
```

#### 3.8 Page Cleanup
```
[PlaywrightWorker] Closing page in finally block...
[PlaywrightWorker] Page closed successfully
```

#### 3.9 **CRITICAL: Message Sending**
```
[PlaywrightWorker] ==========================================
[PlaywrightWorker] Sending response to parent for request abc-123
[PlaywrightWorker] Response type: scrape, success: true
[PlaywrightWorker] Response content length: 350000
[PlaywrightWorker] ==========================================
[PlaywrightWorker] ✅ Response sent successfully to parent
```

### 4. **Servitractor Parser** (`src/lib/parsers/ServitractorParser.ts`)
**Purpose**: Verify HTML tile parsing logic

```
🔍 [SERVITRACTOR] Detected HTML tile structure, parsing tiles directly
🔍 [SERVITRACTOR] Parsing HTML tiles structure
🔍 [SERVITRACTOR] Found 1 tile cards
🔍 [SERVITRACTOR] Processing tile card 1/1
🔍 [SERVITRACTOR] Tile 1 - Found label: "Código"
🔍 [SERVITRACTOR] Tile 1 - Found 1 value spans for label "Código"
🔍 [SERVITRACTOR] Tile 1 - Label "Código" => Value: "9X1439ITR"
🔍 [SERVITRACTOR] Tile 1 - Reference: 9X1439ITR
🔍 [SERVITRACTOR] Tile 1 - Description: LAMPARA CUADRADA 24V
🔍 [SERVITRACTOR] Tile 1 - Stock: 4
🔍 [SERVITRACTOR] Tile 1 - Price (sin IVA): 78908.51
✅ [SERVITRACTOR] Tile 1 - Product created: { reference: 9X1439ITR, price: 78908.51, stock: 4, hasStock: true }
✅ [SERVITRACTOR] HTML tiles parse complete. Total products: 1
```

## Expected Flow (Success)

1. **Config Loading**: Timeout (90000ms) is loaded from database
2. **Worker Setup**: Timeout + 30s buffer = 120000ms total
3. **Login**: Already logged in, skips login steps
4. **Search**: Executes 9 search steps
5. **Immediate Check**: ✅ Detects tile structure immediately
6. **Skip Waits**: Skips all `waitForSelector` calls (saves ~15 seconds)
7. **Return**: Sends HTML content back to parent
8. **Parse**: Extracts product data from HTML tiles
9. **Success**: Returns product with price without IVA

## Common Failure Points

### Issue 1: Timeout Configuration Not Passed
**Symptoms**:
```
[ScraperWorker] Request config timeout: undefined
[ScraperWorker] No config timeout, using default 120000ms
```
**Solution**: Check database seed, ensure `timeoutMs: 90000` is set

### Issue 2: Tile Structure Not Detected
**Symptoms**:
```
[PlaywrightWorker] ⚠️ No tile structure found in immediate HTML
[PlaywrightWorker] Waiting for selector: main
```
**Solution**: Check HTML file saved, verify it contains `zc-pb-tile-container` and `zc-pb-tile-card`

### Issue 3: Worker Timeout Before Return
**Symptoms**:
```
[PlaywrightWorker] ✅✅✅ RETURNING SUCCESS RESPONSE
[PlaywrightWorker] Content length: 350000
❌ [SERVITRACTOR] Error processing endpoint: Request timeout
[ScraperWorker] Worker stopped with exit code 1
```
**Solution**: Increase timeout or check if `parentPort.postMessage` is failing

### Issue 4: Page Close Timeout
**Symptoms**:
```
[PlaywrightWorker] Closing page in finally block...
[PlaywrightWorker] Error waiting for selector: page.waitForTimeout: Target page, context or browser has been closed
```
**Solution**: This is normal during cleanup, can be ignored if content was returned

## HTML Files Saved

For debugging, the following HTML files are saved in `html-results/` directory:

1. **`servitractor-form-{reference}-search-form-{timestamp}.html`**
   - Search form HTML before filling
   
2. **`servitractor-page-{reference}-before-fill-{timestamp}.html`**
   - Full page HTML before search
   
3. **`servitractor-{reference}-immediate-after-search-{timestamp}.html`**
   - HTML immediately after search steps (MOST IMPORTANT)
   
4. **`servitractor-final-{reference}-{timestamp}.html`**
   - Final HTML used for parsing (when tile structure detected immediately)
   
5. **`servitractor-final-after-wait-{reference}-{timestamp}.html`**
   - Final HTML after additional waits (if tile structure not detected)

## Next Steps

When running a test:

1. Search for "✅✅✅ TILE STRUCTURE DETECTED" in logs
   - If found: Automation is working correctly
   - If not found: Check immediate HTML file for tile structure

2. Search for "✅✅✅ RETURNING SUCCESS RESPONSE" in logs
   - If found: Worker prepared response successfully
   - If not found: Check for errors in try-catch blocks

3. Search for "✅ Response sent successfully to parent" in logs
   - If found: Worker sent response to parent successfully
   - If not found: Check for `postMessage` errors

4. Check parser logs for "✅ [SERVITRACTOR] HTML tiles parse complete"
   - If found: Parsing succeeded
   - If not found: Check parser for errors

## Summary

The goal is simple:
1. ✅ Get HTML with tile structure immediately after search
2. ✅ Skip all unnecessary waits
3. ✅ Return HTML to parser
4. ✅ Extract price without IVA from `<span>` with label "Precio antes de IVA"
5. ✅ Return product data

Current implementation does all of this - logs will show exactly where it fails if timeout occurs.

