# DONSSON Steps Analysis and Corrections

## Current Issues

### Issue 1: Login Link Click Not Detected as Login Step
**Problem**: The click step on the login link (`a[href="/web/login"]`) is not detected as a login step to skip because:
- The selector doesn't include keywords like 'submit', 'login', or 'Iniciar'
- The scraper's `isLoginStep` check only looks for these keywords in the selector

**Location**: Step 3 (click login link)

**Impact**: When `shouldSkipLogin: true`, the click step will still execute and fail with timeout, causing errors.

### Issue 2: Wait Step After Login Click Not Skipped
**Problem**: The wait step after clicking the login link (step 4) doesn't have a selector, so it won't be detected as a login step to skip.

**Location**: Step 4 (wait after login click)

**Impact**: This step will execute even when already logged in, which is harmless but inefficient.

### Issue 3: Search Boundary Detection
**Problem**: The `findLoginSearchBoundary` function finds the search boundary at step 7 (shop page navigation). However, if we're already logged in, we still need to navigate to the shop page, so this is correct.

**Location**: Step 7 (navigate to shop)

**Impact**: This is actually correct behavior - we always need to navigate to the shop page.

### Issue 4: Login Step Detection Logic
**Problem**: The scraper's `isLoginStep` detection doesn't check for:
- Click steps with selectors containing `/web/login`
- Wait steps without selectors that come after login clicks
- Steps between the evaluate step and the search boundary

**Impact**: Some login steps might not be skipped correctly.

## Corrections Needed

### Correction 1: Improve Login Step Detection
Update the `isLoginStep` check in the scraper to also detect:
- Click steps with selectors containing `/web/login` or `/login`
- Wait steps that come after login-related clicks (within login section)

### Correction 2: Add Explicit Skip Logic for Login Link Click
Add a check in the click step handler to skip if `dynamicSkipLogin` is true and the selector matches login link patterns.

### Correction 3: Make Wait Steps After Login Click Conditional
The wait step after login click should be skipped if we're already logged in.

### Correction 4: Improve Evaluate Step Result
The evaluate step should return more information to help the scraper identify which steps to skip.

## Recommended Step Structure

The steps should be structured to make it easier for the scraper to identify login vs search steps:

1. **Initial Navigation** (Step 1-2): Navigate to shop page
2. **Authentication Check** (Step 3): Evaluate step to check for login link
3. **Login Steps** (Steps 4-9): Only execute if login link exists
   - Click login link
   - Wait for login page
   - Fill username
   - Fill password
   - Click login button
   - Wait for redirect
4. **Shop Navigation** (Step 10): Navigate to shop page (always execute)
5. **Search Steps** (Steps 11+): Search for reference

## Implementation Fixes

### Fix 1: Update Scraper Login Step Detection
Add to `isLoginStep` check:
```typescript
(step.type === 'click' && step.selector && (
  step.selector.includes('submit') || 
  step.selector.includes('login') || 
  step.selector.includes('Iniciar') ||
  step.selector.includes('/web/login') ||  // NEW
  step.selector.includes('/login')         // NEW
))
```

### Fix 2: Skip Click Steps for Login Links
In the click handler, add:
```typescript
if (dynamicSkipLogin && step.selector && (
  step.selector.includes('/web/login') || 
  step.selector.includes('/login')
)) {
  console.log(`[PuppeteerScraper] ${prefix} Step ${stepIndex}: ⏭️  Skipping login link click - already authenticated`);
  continue;
}
```

### Fix 3: Update DONSSON Steps
Add comments to make it clear which steps are login steps:
- Mark login steps clearly
- Ensure wait steps after login clicks are also marked as login steps

### Fix 4: Improve Error Handling
Make the click step on login link have better error handling - if it fails and `shouldSkipLogin` is true, treat it as expected and continue.

