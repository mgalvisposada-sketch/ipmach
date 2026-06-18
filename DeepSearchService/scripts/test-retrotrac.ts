/**
 * Test script to manually run RETROTRAC login and search steps
 * Usage: tsx scripts/test-retrotrac.ts
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// RETROTRAC configuration from seed file
const RETROTRAC_CONFIG = {
  loginUrl: 'https://tiendab2b.retrotrac.com/login',
  loginUsername: 'comercial3@ciparcol.com',
  loginPassword: 'CIPARCOL4',
  searchUrl: 'https://tiendab2b.retrotrac.com/landing',
  reference: '1R0750',
};

// Login steps
const loginSteps = [
  {
    type: 'goto',
    url: RETROTRAC_CONFIG.loginUrl,
    options: { waitUntil: 'domcontentloaded', timeout: 60000 },
  },
  {
    type: 'wait',
    options: { timeout: 3000 },
  },
  {
    type: 'fill',
    selector: 'input[type="email"], input[placeholder*="Email" i], input[placeholder*="correo" i]',
    value: RETROTRAC_CONFIG.loginUsername,
    options: { timeout: 30000 },
  },
  {
    type: 'fill',
    selector: 'input[type="password"], input[placeholder*="contraseña" i]',
    value: RETROTRAC_CONFIG.loginPassword,
    options: { timeout: 30000 },
  },
  {
    type: 'click',
    selector: 'button:has-text("Ingresar")',
    options: { timeout: 30000, waitUntil: 'networkidle' },
  },
  {
    type: 'wait',
    options: { timeout: 5000 },
  },
];

// Search steps
const searchSteps = [
  {
    type: 'goto',
    url: RETROTRAC_CONFIG.searchUrl,
    options: { waitUntil: 'domcontentloaded', timeout: 60000 },
  },
  {
    type: 'wait',
    options: { timeout: 5000 },
  },
  {
    type: 'wait',
    selector: '#globalSearchTextHome',
    options: { timeout: 30000 },
  },
  {
    type: 'fill',
    selector: '#globalSearchTextHome',
    value: RETROTRAC_CONFIG.reference,
    options: { timeout: 30000 },
  },
  {
    type: 'wait',
    options: { timeout: 2000 },
  },
  {
    type: 'press',
    selector: '#globalSearchTextHome',
    options: { key: 'Enter', timeout: 30000 },
  },
  {
    type: 'wait',
    options: { timeout: 10000 },
  },
];

// Helper function to save HTML
function saveHtml(html: string, filename: string): string {
  const outputDir = path.join(process.cwd(), 'html-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`✅ HTML saved to: ${filePath}`);
  return filePath;
}

// Execute steps helper
async function executeStep(page: any, step: any, stepNum: number, totalSteps: number) {
  console.log(`\n[Step ${stepNum}/${totalSteps}] ${step.type}${step.selector ? ` on ${step.selector}` : ''}${step.url ? ` to ${step.url}` : ''}`);
  
  try {
    switch (step.type) {
      case 'goto':
      case 'navigate':
        const url = step.url || step.selector || '';
        console.log(`  → Navigating to: ${url}`);
        await page.goto(url, {
          waitUntil: step.options?.waitUntil || 'domcontentloaded',
          timeout: step.options?.timeout || 60000,
        });
        console.log(`  ✅ Navigation complete. Current URL: ${page.url()}`);
        break;

      case 'wait':
        if (step.selector) {
          console.log(`  → Waiting for selector: ${step.selector}`);
          await page.waitForSelector(step.selector, {
            timeout: step.options?.timeout || 30000,
            state: 'visible',
          });
          console.log(`  ✅ Selector "${step.selector}" is visible`);
        } else {
          const waitTime = step.options?.timeout || 1000;
          console.log(`  → Waiting ${waitTime}ms...`);
          await page.waitForTimeout(waitTime);
          console.log(`  ✅ Wait complete`);
        }
        break;

      case 'fill':
        if (!step.selector) {
          throw new Error('Fill step requires selector');
        }
        console.log(`  → Filling selector "${step.selector}" with value: ${step.value}`);
        await page.fill(step.selector, step.value, { timeout: step.options?.timeout || 30000 });
        console.log(`  ✅ Fill complete`);
        break;

      case 'click':
        if (!step.selector) {
          throw new Error('Click step requires selector');
        }
        console.log(`  → Clicking selector: ${step.selector}`);
        await page.click(step.selector, { timeout: step.options?.timeout || 30000 });
        if (step.options?.waitUntil) {
          await page.waitForLoadState(step.options.waitUntil);
        }
        console.log(`  ✅ Click complete. Current URL: ${page.url()}`);
        break;

      case 'press':
        if (!step.selector) {
          throw new Error('Press step requires selector');
        }
        const key = step.options?.key || 'Enter';
        console.log(`  → Pressing ${key} on selector: ${step.selector}`);
        await page.press(step.selector, key, { timeout: step.options?.timeout || 30000 });
        console.log(`  ✅ Press complete. Current URL: ${page.url()}`);
        break;

      default:
        console.warn(`  ⚠️ Unknown step type: ${step.type}`);
    }

    // Save HTML after each step for debugging
    try {
      const html = await page.content();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `retrotrac-test-step-${stepNum}-${step.type}-${timestamp}.html`;
      saveHtml(html, filename);
    } catch (e) {
      console.warn(`  ⚠️ Could not save HTML: ${(e as Error).message}`);
    }
  } catch (error: any) {
    console.error(`  ❌ Error in step ${stepNum}: ${error.message}`);
    
    // Save HTML on error
    try {
      const html = await page.content();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `retrotrac-test-step-${stepNum}-ERROR-${timestamp}.html`;
      saveHtml(html, filename);
      console.log(`  📄 Error HTML saved for debugging`);
    } catch (e) {
      console.warn(`  ⚠️ Could not save error HTML: ${(e as Error).message}`);
    }
    
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting RETROTRAC test automation');
  console.log(`📋 Reference to search: ${RETROTRAC_CONFIG.reference}`);
  console.log(`🔐 Login: ${RETROTRAC_CONFIG.loginUsername}`);
  console.log('');

  const browser = await chromium.launch({
    headless: false, // Run in headed mode so you can see what's happening
    slowMo: 500, // Slow down operations by 500ms for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Execute login steps
    console.log('='.repeat(60));
    console.log('🔐 LOGIN STEPS');
    console.log('='.repeat(60));
    
    for (let i = 0; i < loginSteps.length; i++) {
      await executeStep(page, loginSteps[i], i + 1, loginSteps.length);
    }

    console.log('\n✅ Login complete!');
    console.log(`Current URL: ${page.url()}`);
    console.log(`Page title: ${await page.title()}`);

    // Save final state after login
    const loginHtml = await page.content();
    saveHtml(loginHtml, 'retrotrac-test-after-login.html');

    // Execute search steps
    console.log('\n' + '='.repeat(60));
    console.log('🔍 SEARCH STEPS');
    console.log('='.repeat(60));

    for (let i = 0; i < searchSteps.length; i++) {
      await executeStep(page, searchSteps[i], i + 1, searchSteps.length);
    }

    console.log('\n✅ Search complete!');
    console.log(`Current URL: ${page.url()}`);
    console.log(`Page title: ${await page.title()}`);

    // Save final state after search
    const searchHtml = await page.content();
    saveHtml(searchHtml, 'retrotrac-test-after-search.html');

    // Wait a bit so you can see the results
    console.log('\n⏳ Waiting 10 seconds so you can see the results...');
    await page.waitForTimeout(10000);

    console.log('\n✅ Test completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    
    // Save error state
    try {
      const html = await page.content();
      saveHtml(html, 'retrotrac-test-ERROR-FINAL.html');
    } catch (e) {
      console.error('Could not save error HTML:', e);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

