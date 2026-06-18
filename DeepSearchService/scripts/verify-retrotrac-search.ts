/**
 * Browser verification script to verify RETROTRAC search input is being filled correctly
 * Usage: tsx scripts/verify-retrotrac-search.ts
 * 
 * This script will:
 * 1. Login to RETROTRAC
 * 2. Navigate to search page
 * 3. Fill the search input with a test reference
 * 4. Verify the value is actually in the input field
 * 5. Show what's in the input before and after typing
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// RETROTRAC configuration
const RETROTRAC_CONFIG = {
  loginUrl: 'https://tiendab2b.retrotrac.com/login',
  loginUsername: 'comercial3@ciparcol.com',
  loginPassword: 'CIPARCOL4',
  searchUrl: 'https://tiendab2b.retrotrac.com/home',
  reference: '1R0750', // Test reference
};

async function login(page: any) {
  console.log('\n' + '='.repeat(80));
  console.log('🔐 LOGGING IN');
  console.log('='.repeat(80));

  await page.goto(RETROTRAC_CONFIG.loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForTimeout(3000);

  // Wait for and fill email
  console.log('\n📧 Filling email...');
  await page.waitForSelector('#email', { timeout: 30000 });
  await page.fill('#email', RETROTRAC_CONFIG.loginUsername);
  console.log(`   ✅ Email filled: ${RETROTRAC_CONFIG.loginUsername}`);

  await page.waitForTimeout(1000);

  // Wait for and fill password
  console.log('\n🔒 Filling password...');
  await page.waitForSelector('#password', { timeout: 30000 });
  await page.fill('#password', RETROTRAC_CONFIG.loginPassword);
  console.log('   ✅ Password filled: ******');

  await page.waitForTimeout(1000);

  // Click login button
  console.log('\n🔘 Clicking login button...');
  await page.click('button:has-text("Ingresar")', { timeout: 30000 });
  console.log('   ✅ Login button clicked');

  // Wait for navigation
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`\n✅ Login complete! Current URL: ${currentUrl}`);
  
  return currentUrl;
}

async function verifySearchInput(page: any, reference: string) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 VERIFYING SEARCH INPUT');
  console.log('='.repeat(80));

  // Navigate to search page
  console.log(`\n🌐 Navigating to search page: ${RETROTRAC_CONFIG.searchUrl}`);
  await page.goto(RETROTRAC_CONFIG.searchUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForTimeout(2000);

  // Wait for search input
  console.log('\n⏳ Waiting for search input #globalSearchTextHome...');
  await page.waitForSelector('#globalSearchTextHome', { timeout: 60000 });
  console.log('   ✅ Search input found');

  // Check initial value
  const initialValue = await page.inputValue('#globalSearchTextHome');
  console.log(`\n📝 Initial value in input: "${initialValue}"`);

  // Clear the input first (in case there's something in it)
  console.log('\n🧹 Clearing input...');
  await page.fill('#globalSearchTextHome', '');
  await page.waitForTimeout(500);
  const clearedValue = await page.inputValue('#globalSearchTextHome');
  console.log(`   ✅ Input cleared. Value now: "${clearedValue}"`);

  // Type the reference
  console.log(`\n⌨️  Typing reference: "${reference}"`);
  await page.fill('#globalSearchTextHome', reference);
  await page.waitForTimeout(1000); // Wait a bit for any Angular updates

  // Verify the value is actually in the input
  const actualValue = await page.inputValue('#globalSearchTextHome');
  console.log(`\n✅ Value in input after typing: "${actualValue}"`);

  // Also check via JavaScript evaluation
  const jsValue = await page.evaluate((selector: string) => {
    const input = document.querySelector(selector) as HTMLInputElement;
    return input ? input.value : null;
  }, '#globalSearchTextHome');

  console.log(`   JavaScript evaluation result: "${jsValue}"`);

  // Check if values match
  const valuesMatch = actualValue === reference && jsValue === reference;
  console.log(`\n${valuesMatch ? '✅' : '❌'} Values match: ${valuesMatch}`);
  
  if (!valuesMatch) {
    console.log(`   Expected: "${reference}"`);
    console.log(`   Actual (inputValue): "${actualValue}"`);
    console.log(`   Actual (JS eval): "${jsValue}"`);
  }

  // Get input element details
  const inputDetails = await page.evaluate((selector: string) => {
    const input = document.querySelector(selector) as HTMLInputElement;
    if (!input) return null;
    return {
      value: input.value,
      defaultValue: input.defaultValue,
      placeholder: input.placeholder,
      type: input.type,
      disabled: input.disabled,
      readonly: input.readOnly,
      className: input.className,
      id: input.id,
      name: input.name,
    };
  }, '#globalSearchTextHome');

  console.log('\n📋 Input Element Details:');
  console.log(JSON.stringify(inputDetails, null, 2));

  // Try typing character by character (simulating real typing)
  console.log('\n' + '='.repeat(80));
  console.log('⌨️  TESTING CHARACTER-BY-CHARACTER TYPING');
  console.log('='.repeat(80));

  // Clear again
  await page.fill('#globalSearchTextHome', '');
  await page.waitForTimeout(500);

  console.log(`\n⌨️  Typing "${reference}" character by character...`);
  for (let i = 0; i < reference.length; i++) {
    const char = reference[i];
    await page.type('#globalSearchTextHome', char, { delay: 100 });
    const currentValue = await page.inputValue('#globalSearchTextHome');
    console.log(`   After typing "${char}": "${currentValue}"`);
  }

  const finalValue = await page.inputValue('#globalSearchTextHome');
  console.log(`\n✅ Final value after character-by-character typing: "${finalValue}"`);

  // Press Enter key
  console.log('\n' + '='.repeat(80));
  console.log('⌨️  PRESSING ENTER KEY');
  console.log('='.repeat(80));

  const urlBeforeEnter = page.url();
  console.log(`\n📍 URL before pressing Enter: ${urlBeforeEnter}`);

  console.log(`\n⌨️  Pressing Enter key on #globalSearchTextHome...`);
  await page.press('#globalSearchTextHome', 'Enter');
  console.log('   ✅ Enter key pressed');

  // Wait a bit for any navigation or search results to appear
  await page.waitForTimeout(2000);

  const urlAfterEnter = page.url();
  console.log(`\n📍 URL after pressing Enter: ${urlAfterEnter}`);

  // Check if URL changed (indicating navigation occurred)
  const urlChanged = urlBeforeEnter !== urlAfterEnter;
  console.log(`\n${urlChanged ? '✅' : 'ℹ️ '} URL ${urlChanged ? 'changed' : 'remained the same'} after pressing Enter`);

  // Wait for search results or dropdown to appear
  console.log('\n⏳ Waiting for search results to appear...');
  try {
    // Wait for common search result selectors
    await page.waitForSelector(
      '[role="listbox"], [role="option"], .box-product__info, .box-product, .product-item, [ng-repeat*="product"], [ng-repeat*="item"], .search-results, main .container, [class*="product"], product-detail',
      { timeout: 10000 }
    );
    console.log('   ✅ Search results appeared');
  } catch (error) {
    console.log('   ⚠️  Search results did not appear within timeout (this might be normal if no results)');
  }

  // Check if there are any visible search results
  const searchResultsCount = await page.evaluate(() => {
    const selectors = [
      '[role="listbox"] [role="option"]',
      '.box-product',
      '.product-item',
      '[ng-repeat*="product"]',
      '.search-results .product',
      '[class*="product"]:not(script):not(style)',
    ];
    
    let count = 0;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        count += elements.length;
        break; // Count from first matching selector
      }
    }
    return count;
  });

  console.log(`\n📊 Search results found: ${searchResultsCount > 0 ? searchResultsCount : 'None detected'}`);

  // Save page HTML for inspection
  const html = await page.content();
  const debugDir = path.join(process.cwd(), 'debug-html');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = path.join(debugDir, `retrotrac-search-verification-${timestamp}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`\n💾 Page HTML saved to: ${htmlPath}`);

  return {
    success: finalValue === reference,
    expected: reference,
    actual: finalValue,
    inputDetails,
    enterPressed: true,
    urlChanged,
    searchResultsCount,
  };
}

async function main() {
  console.log('🚀 Starting RETROTRAC Search Input Verification');
  console.log(`📋 Test Reference: ${RETROTRAC_CONFIG.reference}`);
  console.log(`🔐 Login: ${RETROTRAC_CONFIG.loginUsername}`);
  console.log('');

  const browser = await chromium.launch({
    headless: false, // Run in headed mode so you can see what's happening
    slowMo: 200, // Slow down operations by 200ms for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Login
    await login(page);

    // Verify search input
    const result = await verifySearchInput(page, RETROTRAC_CONFIG.reference);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nExpected Reference: "${result.expected}"`);
    console.log(`Actual Value: "${result.actual}"`);
    console.log(`Enter Key Pressed: ${result.enterPressed ? '✅ Yes' : '❌ No'}`);
    console.log(`URL Changed After Enter: ${result.urlChanged ? '✅ Yes' : 'ℹ️  No'}`);
    console.log(`Search Results Found: ${result.searchResultsCount > 0 ? `✅ ${result.searchResultsCount}` : '⚠️  None'}`);
    console.log(`\n${result.success ? '✅ SUCCESS' : '❌ FAILED'}: Reference ${result.success ? 'was' : 'was NOT'} correctly typed into search input`);
    console.log(`${result.enterPressed ? '✅ SUCCESS' : '❌ FAILED'}: Enter key ${result.enterPressed ? 'was' : 'was NOT'} pressed`);

    if (!result.success) {
      console.log('\n⚠️  TYPING ISSUE DETECTED:');
      console.log('   The reference value is not matching what was typed.');
      console.log('   This could indicate:');
      console.log('   - Input field has validation that modifies the value');
      console.log('   - Angular is interfering with the input');
      console.log('   - The selector is targeting the wrong element');
      console.log('   - There are multiple elements with the same selector');
    }

    if (!result.enterPressed) {
      console.log('\n⚠️  ENTER KEY ISSUE DETECTED:');
      console.log('   The Enter key was not pressed successfully.');
    }

    if (result.searchResultsCount === 0 && result.enterPressed) {
      console.log('\nℹ️  NOTE:');
      console.log('   Enter key was pressed, but no search results were detected.');
      console.log('   This could mean:');
      console.log('   - The search returned no results');
      console.log('   - The search results use different selectors');
      console.log('   - The page needs more time to load results');
      console.log('   - The search triggers a different action (e.g., navigation)');
    }

    // Keep browser open for 15 seconds so you can see the result
    console.log('\n⏳ Keeping browser open for 15 seconds so you can inspect...');
    await page.waitForTimeout(15000);
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);

    // Save error state
    try {
      const html = await page.content();
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const htmlPath = path.join(debugDir, `retrotrac-search-verification-ERROR-${timestamp}.html`);
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log(`💾 Error HTML saved to: ${htmlPath}`);
    } catch (e) {
      console.error('Could not save error HTML:', e);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

