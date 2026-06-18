/**
 * Browser script to find the correct SERVITRACTOR search input selector
 * Usage: tsx scripts/find-servitractor-search.ts
 */

import { chromium } from 'playwright';

const SERVITRACTOR_CONFIG = {
  loginUrl: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio',
  loginUsername: 'comercial2@ciparcol.com',
  loginPassword: 'Ciparcol2025*',
  reference: '1U3202',
};

async function findSearchInput() {
  console.log('🚀 Finding SERVITRACTOR Search Input');
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

    // Now find the search input
    console.log('\n🔍 Searching for search input field...');
    await page.waitForTimeout(5000); // Wait for page to fully load

    // Try multiple approaches to find the search input
    const searchInputs = await page.evaluate(() => {
      const inputs: any[] = [];

      // Method 1: Find by class
      const byClass = Array.from(document.querySelectorAll('input.zc-pb-search-inputfld'));
      byClass.forEach((el: any) => {
        inputs.push({
          method: 'class',
          selector: 'input.zc-pb-search-inputfld',
          element: {
            type: el.type,
            id: el.id || '',
            name: el.name || '',
            className: el.className || '',
            placeholder: el.placeholder || '',
            'at-name': el.getAttribute('at-name') || '',
            visible: el.offsetParent !== null,
            disabled: el.disabled,
          },
        });
      });

      // Method 2: Find by at-name attribute
      const byAtName = Array.from(document.querySelectorAll('input[at-name="searchbar"]'));
      byAtName.forEach((el: any) => {
        inputs.push({
          method: 'at-name',
          selector: 'input[at-name="searchbar"]',
          element: {
            type: el.type,
            id: el.id || '',
            name: el.name || '',
            className: el.className || '',
            placeholder: el.placeholder || '',
            'at-name': el.getAttribute('at-name') || '',
            visible: el.offsetParent !== null,
            disabled: el.disabled,
          },
        });
      });

      // Method 3: Find by placeholder
      const byPlaceholder = Array.from(document.querySelectorAll('input[placeholder="Enter value"]'));
      byPlaceholder.forEach((el: any) => {
        inputs.push({
          method: 'placeholder',
          selector: 'input[placeholder="Enter value"]',
          element: {
            type: el.type,
            id: el.id || '',
            name: el.name || '',
            className: el.className || '',
            placeholder: el.placeholder || '',
            'at-name': el.getAttribute('at-name') || '',
            visible: el.offsetParent !== null,
            disabled: el.disabled,
          },
        });
      });

      // Method 4: Find all inputs with zc-pb in class
      const byZcPb = Array.from(document.querySelectorAll('input[class*="zc-pb"]'));
      byZcPb.forEach((el: any) => {
        inputs.push({
          method: 'zc-pb-class',
          selector: `input.${el.className.split(' ').join('.')}`,
          element: {
            type: el.type,
            id: el.id || '',
            name: el.name || '',
            className: el.className || '',
            placeholder: el.placeholder || '',
            'at-name': el.getAttribute('at-name') || '',
            visible: el.offsetParent !== null,
            disabled: el.disabled,
          },
        });
      });

      // Method 5: Find all text inputs on the page
      const allTextInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      allTextInputs.forEach((el: any) => {
        const className = el.className || '';
        if (className.includes('search') || className.includes('zc-pb') || el.getAttribute('at-name') === 'searchbar') {
          inputs.push({
            method: 'all-text-inputs',
            selector: el.id ? `#${el.id}` : el.name ? `input[name="${el.name}"]` : `input[class="${className}"]`,
            element: {
              type: el.type,
              id: el.id || '',
              name: el.name || '',
              className: el.className || '',
              placeholder: el.placeholder || '',
              'at-name': el.getAttribute('at-name') || '',
              visible: el.offsetParent !== null,
              disabled: el.disabled,
            },
          });
        }
      });

      return inputs;
    });

    console.log(`\n📋 Found ${searchInputs.length} potential search inputs:`);
    searchInputs.forEach((input, i) => {
      console.log(`\n  ${i + 1}. Method: ${input.method}`);
      console.log(`     Selector: ${input.selector}`);
      console.log(`     Type: ${input.element.type}`);
      console.log(`     ID: "${input.element.id}"`);
      console.log(`     Name: "${input.element.name}"`);
      console.log(`     Class: "${input.element.className}"`);
      console.log(`     Placeholder: "${input.element.placeholder}"`);
      console.log(`     at-name: "${input.element['at-name']}"`);
      console.log(`     Visible: ${input.element.visible}`);
      console.log(`     Disabled: ${input.element.disabled}`);
    });

    // Find the best selector
    const bestInput = searchInputs.find(
      (input) =>
        input.element.visible &&
        !input.element.disabled &&
        (input.element['at-name'] === 'searchbar' ||
         input.element.className.includes('zc-pb-search') ||
         input.element.placeholder === 'Enter value')
    ) || searchInputs.find((input) => input.element.visible && !input.element.disabled);

    if (bestInput) {
      console.log(`\n✅ Best selector found: ${bestInput.selector}`);
      console.log(`   Method: ${bestInput.method}`);
      console.log(`   Element details:`, bestInput.element);

      // Try to use it
      console.log(`\n🧪 Testing the selector...`);
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
        console.log(`  📍 URL after search: ${page.url()}`);
      } catch (e: any) {
        console.log(`  ❌ Error testing selector: ${e.message}`);
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
    const htmlPath = path.join(debugDir, `servitractor-search-input-${timestamp}.html`);
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

findSearchInput().catch(console.error);

