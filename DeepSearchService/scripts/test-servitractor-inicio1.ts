/**
 * Browser script to test SERVITRACTOR search on Inicio1 page
 * Usage: tsx scripts/test-servitractor-inicio1.ts
 */

import { chromium } from 'playwright';

const SERVITRACTOR_CONFIG = {
  loginUrl: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio',
  searchUrl: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1',
  loginUsername: 'comercial2@ciparcol.com',
  loginPassword: 'Ciparcol2025*',
  reference: '1U3202',
};

async function testInicio1Search() {
  console.log('🚀 Testing SERVITRACTOR Search on Inicio1 Page');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Login first
    console.log('🌐 Navigating to:', SERVITRACTOR_CONFIG.loginUrl);
    await page.goto(SERVITRACTOR_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    // Find and interact with login iframe
    const iframe = page.frame({ name: 'zohoiam' });
    if (!iframe) {
      throw new Error('Login iframe not found');
    }

    console.log('🔐 Logging in...');
    await iframe.waitForSelector('#login_id', { timeout: 30000 });
    await iframe.fill('#login_id', SERVITRACTOR_CONFIG.loginUsername);
    console.log('  ✅ Filled username');

    await page.waitForTimeout(1000);

    // Click Siguiente
    await iframe.click('#nextbtn');
    await page.waitForTimeout(2000);

    // Fill password
    await iframe.waitForSelector('#password', { state: 'visible', timeout: 30000 });
    await iframe.fill('#password', SERVITRACTOR_CONFIG.loginPassword);
    console.log('  ✅ Filled password');

    await page.waitForTimeout(1000);

    // Click login
    await iframe.click('#nextbtn');
    await page.waitForTimeout(5000);

    console.log('✅ Logged in successfully');
    console.log(`📍 Current URL: ${page.url()}`);

    // Navigate to Inicio1 page
    console.log(`\n🌐 Navigating to search page: ${SERVITRACTOR_CONFIG.searchUrl}`);
    await page.goto(SERVITRACTOR_CONFIG.searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait longer for Zoho page to fully load - it loads dynamically
    console.log('⏳ Waiting for page to fully load...');
    await page.waitForTimeout(10000);

    console.log(`📍 URL after navigation: ${page.url()}`);

    // Try multiple times to find the search input (page loads dynamically)
    let searchInputs: any[] = [];
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`\n🔍 Attempt ${attempt}/5: Looking for search input on Inicio1 page...`);
      await page.waitForTimeout(3000);
      
      searchInputs = await page.evaluate(() => {
        const inputs: any[] = [];

        // Get ALL text inputs first
        const allInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
        allInputs.forEach((el: any) => {
          inputs.push({
            selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : `input[type="${el.type || 'text'}"]`,
            type: el.type || 'text',
            id: el.id || '',
            name: el.name || '',
            className: el.className || '',
            placeholder: el.placeholder || '',
            'at-name': el.getAttribute('at-name') || '',
            visible: el.offsetParent !== null,
            disabled: el.disabled,
            value: el.value || '',
          });
        });

        return inputs;
      });

      console.log(`  📝 Found ${searchInputs.length} text inputs on page`);
      
      // Filter for search-related inputs
      const searchRelated = searchInputs.filter((input) =>
        input.className.includes('search') ||
        input['at-name'] === 'searchbar' ||
        input.placeholder?.toLowerCase().includes('enter value') ||
        input.placeholder?.toLowerCase().includes('buscar') ||
        input.className.includes('zc-pb')
      );

      if (searchRelated.length > 0) {
        console.log(`  ✅ Found ${searchRelated.length} search-related inputs!`);
        searchInputs = searchRelated;
        break;
      } else if (attempt === 5) {
        // On last attempt, show all inputs
        console.log(`  ⚠️  No search inputs found, showing all ${searchInputs.length} inputs:`);
        searchInputs.slice(0, 10).forEach((input, i) => {
          console.log(`     ${i + 1}. ${input.selector} - Class: "${input.className}", Placeholder: "${input.placeholder}"`);
        });
      }
    }

    console.log(`\n📋 Found ${searchInputs.length} potential search inputs:`);
    searchInputs.forEach((input, i) => {
      console.log(`\n  ${i + 1}. Selector: ${input.selector}`);
      console.log(`     Type: ${input.type}`);
      console.log(`     Class: "${input.className}"`);
      console.log(`     Placeholder: "${input.placeholder}"`);
      console.log(`     at-name: "${input['at-name']}"`);
      console.log(`     Visible: ${input.visible}`);
      console.log(`     Disabled: ${input.disabled}`);
    });

    // Find the best input
    const bestInput = searchInputs.find(
      (input) =>
        input.visible &&
        !input.disabled &&
        (input['at-name'] === 'searchbar' ||
         input.className.includes('zc-pb-search') ||
         input.placeholder === 'Enter value')
    ) || searchInputs.find((input) => input.visible && !input.disabled);

    if (bestInput) {
      console.log(`\n✅ Best selector found: ${bestInput.selector}`);
      
      // Test the search
      console.log(`\n🧪 Testing search with reference: ${SERVITRACTOR_CONFIG.reference}`);
      try {
        await page.waitForSelector(bestInput.selector, { state: 'visible', timeout: 30000 });
        console.log(`  ✅ Selector is accessible`);

        await page.fill(bestInput.selector, '');
        await page.fill(bestInput.selector, SERVITRACTOR_CONFIG.reference);
        console.log(`  ✅ Filled with reference: ${SERVITRACTOR_CONFIG.reference}`);

        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        console.log(`  ✅ Pressed Enter`);

        await page.waitForTimeout(5000);
        const urlAfterSearch = page.url();
        console.log(`  📍 URL after search: ${urlAfterSearch}`);
        
        // Check for results
        const hasResults = await page.evaluate(() => {
          const indicators = [
            document.querySelector('table'),
            document.querySelector('tbody'),
            document.querySelector('[class*="result"]'),
            document.querySelector('[id*="result"]'),
          ];
          return indicators.some(el => el !== null);
        });
        
        if (hasResults) {
          console.log(`  ✅ Search results detected on page`);
        } else {
          console.log(`  ⚠️  No obvious results detected`);
        }
      } catch (e: any) {
        console.log(`  ❌ Error during search: ${e.message}`);
      }
    } else {
      console.log(`\n❌ No suitable search input found`);
    }

    // Save HTML for inspection
    const html = await page.content();
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(process.cwd(), 'debug-html');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlPath = path.join(debugDir, `servitractor-inicio1-${timestamp}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`\n💾 Page HTML saved to: ${htmlPath}`);

    console.log('\n⏳ Keeping browser open for 15 seconds so you can inspect...');
    await page.waitForTimeout(15000);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

testInicio1Search().catch(console.error);

