/**
 * Browser inspection script to find the correct selector for RETROTRAC login button
 * Usage: tsx scripts/inspect-retrotrac-button.ts
 */

import { chromium } from 'playwright';

const RETROTRAC_CONFIG = {
  loginUrl: 'https://tiendab2b.retrotrac.com/login',
  loginUsername: 'comercial3@ciparcol.com',
  loginPassword: 'CIPARCOL4',
};

async function inspectLoginButton() {
  console.log('🚀 Starting RETROTRAC Login Button Inspection');
  console.log('');

  const browser = await chromium.launch({
    headless: false, // Run in headed mode so you can see what's happening
    slowMo: 500, // Slow down operations for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to login page...');
    await page.goto(RETROTRAC_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    console.log('\n📋 Finding all buttons on the page...');
    
    // Get all buttons
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"]'));
      return allButtons.map((btn, index) => {
        const element = btn as HTMLElement;
        return {
          index,
          tagName: element.tagName,
          type: (element as HTMLInputElement).type || 'button',
          text: element.textContent?.trim() || '',
          innerText: element.innerText?.trim() || '',
          id: element.id || '',
          className: element.className || '',
          name: (element as HTMLInputElement).name || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          selector: element.id 
            ? `#${element.id}` 
            : element.className 
              ? `.${element.className.split(' ').filter(c => c).join('.')}`
              : `${element.tagName.toLowerCase()}[type="${(element as HTMLInputElement).type || ''}"]`,
        };
      });
    });

    console.log(`\n✅ Found ${buttons.length} buttons:\n`);
    buttons.forEach((btn, i) => {
      console.log(`Button ${i + 1}:`);
      console.log(`  Tag: ${btn.tagName}`);
      console.log(`  Type: ${btn.type}`);
      console.log(`  Text: "${btn.text}"`);
      console.log(`  InnerText: "${btn.innerText}"`);
      console.log(`  ID: ${btn.id || '(none)'}`);
      console.log(`  Class: ${btn.className || '(none)'}`);
      console.log(`  Name: ${btn.name || '(none)'}`);
      console.log(`  Aria Label: ${btn.ariaLabel || '(none)'}`);
      console.log(`  Suggested Selector: ${btn.selector}`);
      console.log('');
    });

    // Find the login button specifically
    console.log('\n🔍 Looking for login button (Ingresar/Login/Entrar)...\n');
    
    const loginButton = buttons.find(
      (btn) =>
        (btn.text.toLowerCase().includes('ingresar') ||
         btn.text.toLowerCase().includes('login') ||
         btn.text.toLowerCase().includes('entrar') ||
         btn.innerText.toLowerCase().includes('ingresar') ||
         btn.innerText.toLowerCase().includes('login') ||
         btn.innerText.toLowerCase().includes('entrar')) &&
        !btn.className.toLowerCase().includes('modal') &&
        !btn.className.toLowerCase().includes('close')
    );

    if (loginButton) {
      console.log('✅ Found login button:');
      console.log(`  Text: "${loginButton.text}"`);
      console.log(`  ID: ${loginButton.id || '(none)'}`);
      console.log(`  Class: ${loginButton.className || '(none)'}`);
      console.log(`  Suggested Selector: ${loginButton.selector}`);
      
      // Test the selector
      console.log('\n🧪 Testing selector...');
      const testResult = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return {
          found: !!element,
          tagName: element?.tagName || '',
          text: element?.textContent?.trim() || '',
        };
      }, loginButton.selector);

      if (testResult.found) {
        console.log(`✅ Selector "${loginButton.selector}" works!`);
        console.log(`   Element text: "${testResult.text}"`);
      } else {
        console.log(`❌ Selector "${loginButton.selector}" did not work`);
      }

      // Try alternative selectors
      console.log('\n🔍 Trying alternative selectors...');
      const alternatives = [
        loginButton.id ? `#${loginButton.id}` : null,
        loginButton.className ? `.${loginButton.className.split(' ')[0]}` : null,
        `button:contains("${loginButton.text}")`,
        `button[type="submit"]`,
        `input[type="submit"]`,
      ].filter(Boolean);

      for (const altSelector of alternatives) {
        if (!altSelector) continue;
        try {
          const element = await page.$(altSelector);
          if (element) {
            const text = await element.textContent();
            console.log(`✅ Alternative selector "${altSelector}" works - text: "${text?.trim()}"`);
          }
        } catch (e) {
          // Ignore errors for selectors that don't work
        }
      }

      // Try Puppeteer-compatible selectors (no :has-text or :contains)
      console.log('\n🔍 Testing Puppeteer-compatible selectors...');
      
      // Get all buttons and check their text content
      const puppeteerSelectors = await page.evaluate(() => {
        const allBtns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const results: Array<{ selector: string; text: string; works: boolean }> = [];
        
        allBtns.forEach((btn, idx) => {
          const text = btn.textContent?.trim() || '';
          if (text.toLowerCase().includes('ingresar') || 
              text.toLowerCase().includes('login') ||
              text.toLowerCase().includes('entrar')) {
            const element = btn as HTMLElement;
            let selector = '';
            
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.className) {
              const firstClass = element.className.split(' ').filter(c => c)[0];
              selector = `.${firstClass}`;
            } else {
              selector = `${element.tagName.toLowerCase()}[type="${(element as HTMLInputElement).type || ''}"]`;
            }
            
            results.push({
              selector,
              text,
              works: true,
            });
          }
        });
        
        return results;
      });

      console.log('\n✅ Puppeteer-compatible selectors:');
      puppeteerSelectors.forEach((sel, idx) => {
        console.log(`  ${idx + 1}. "${sel.selector}" - text: "${sel.text}"`);
      });

      if (puppeteerSelectors.length > 0) {
        console.log(`\n💡 Recommended selector: "${puppeteerSelectors[0].selector}"`);
      }

    } else {
      console.log('❌ Could not find login button with expected text');
      console.log('\n📋 All button texts found:');
      buttons.forEach((btn, i) => {
        if (btn.text || btn.innerText) {
          console.log(`  ${i + 1}. "${btn.text || btn.innerText}"`);
        }
      });
    }

    // Save page HTML for inspection
    const html = await page.content();
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(process.cwd(), 'debug-html');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlPath = path.join(debugDir, `retrotrac-button-inspection-${timestamp}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`\n💾 Page HTML saved to: ${htmlPath}`);

    console.log('\n⏳ Keeping browser open for 10 seconds so you can inspect...');
    await page.waitForTimeout(10000);
  } catch (error: any) {
    console.error('\n❌ Inspection failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

inspectLoginButton().catch(console.error);

