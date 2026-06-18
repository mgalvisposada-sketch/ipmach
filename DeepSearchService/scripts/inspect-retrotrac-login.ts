/**
 * Browser inspection script to identify correct RETROTRAC login selectors
 * Usage: tsx scripts/inspect-retrotrac-login.ts
 * 
 * This script will:
 * 1. Open a browser (non-headless) so you can see what's happening
 * 2. Navigate to the login page
 * 3. Inspect and log all form elements and their selectors
 * 4. Test the login flow with the current steps
 * 5. Output recommended selectors for the steps file
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// RETROTRAC configuration
const RETROTRAC_CONFIG = {
  loginUrl: 'https://tiendab2b.retrotrac.com/login',
  loginUsername: 'comercial3@ciparcol.com',
  loginPassword: 'CIPARCOL4',
};

async function inspectLoginPage(page: any) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 INSPECTING LOGIN PAGE ELEMENTS');
  console.log('='.repeat(80));

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Get all input elements
  const inputs = await page.$$eval('input', (elements: any[]) => {
    return elements.map((el, index) => ({
      index,
      type: el.type || 'text',
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      className: el.className || '',
      value: el.value || '',
      selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : `input[type="${el.type}"]`,
      fullSelector: el.id 
        ? `#${el.id}` 
        : el.name 
          ? `input[name="${el.name}"]` 
          : el.className 
            ? `input.${el.className.split(' ').join('.')}`
            : `input[type="${el.type}"]:nth-of-type(${index + 1})`,
    }));
  });

  console.log('\n📝 INPUT ELEMENTS FOUND:');
  inputs.forEach((input, i) => {
    console.log(`\n  Input ${i + 1}:`);
    console.log(`    Type: ${input.type}`);
    console.log(`    Name: ${input.name || '(none)'}`);
    console.log(`    ID: ${input.id || '(none)'}`);
    console.log(`    Placeholder: ${input.placeholder || '(none)'}`);
    console.log(`    Class: ${input.className || '(none)'}`);
    console.log(`    Simple Selector: ${input.selector}`);
    console.log(`    Full Selector: ${input.fullSelector}`);
  });

  // Get all button elements
  const buttons = await page.$$eval('button, input[type="submit"]', (elements: any[]) => {
    return elements.map((el, index) => ({
      index,
      type: el.type || el.tagName.toLowerCase(),
      text: el.textContent?.trim() || el.value || '',
      id: el.id || '',
      name: el.name || '',
      className: el.className || '',
      selector: el.id 
        ? `#${el.id}` 
        : el.textContent?.trim() 
          ? `button:has-text("${el.textContent.trim()}")`
          : el.name
            ? `[name="${el.name}"]`
            : `button:nth-of-type(${index + 1})`,
    }));
  });

  console.log('\n🔘 BUTTON/SUBMIT ELEMENTS FOUND:');
  buttons.forEach((button, i) => {
    console.log(`\n  Button ${i + 1}:`);
    console.log(`    Type: ${button.type}`);
    console.log(`    Text: ${button.text || '(none)'}`);
    console.log(`    ID: ${button.id || '(none)'}`);
    console.log(`    Name: ${button.name || '(none)'}`);
    console.log(`    Class: ${button.className || '(none)'}`);
    console.log(`    Selector: ${button.selector}`);
  });

  // Find email/username input
  const emailInput = inputs.find(
    (input) =>
      input.type === 'email' ||
      input.name?.toLowerCase().includes('email') ||
      input.name?.toLowerCase().includes('correo') ||
      input.placeholder?.toLowerCase().includes('email') ||
      input.placeholder?.toLowerCase().includes('correo') ||
      input.id?.toLowerCase().includes('email') ||
      input.id?.toLowerCase().includes('correo')
  );

  // Find password input
  const passwordInput = inputs.find(
    (input) =>
      input.type === 'password' ||
      input.name?.toLowerCase().includes('password') ||
      input.name?.toLowerCase().includes('contraseña') ||
      input.placeholder?.toLowerCase().includes('password') ||
      input.placeholder?.toLowerCase().includes('contraseña')
  );

  // Find submit button (prioritize "Ingresar" button, exclude modal close buttons)
  const submitButton = buttons.find(
    (button) =>
      (button.text?.toLowerCase().includes('ingresar') && !button.className?.includes('modal')) ||
      (button.text?.toLowerCase().includes('login') && !button.className?.includes('modal')) ||
      (button.text?.toLowerCase().includes('entrar') && !button.className?.includes('modal'))
  ) || buttons.find(
    (button) =>
      button.type === 'submit' && 
      !button.text?.toLowerCase().includes('cerrar') &&
      !button.text?.toLowerCase().includes('suscribete') &&
      !button.className?.includes('modal')
  );

  console.log('\n' + '='.repeat(80));
  console.log('✅ RECOMMENDED SELECTORS:');
  console.log('='.repeat(80));

  if (emailInput) {
    console.log(`\n📧 Email/Username Input:`);
    console.log(`   Best Selector: ${emailInput.fullSelector}`);
    console.log(`   Alternative: ${emailInput.selector}`);
    if (emailInput.id) {
      console.log(`   ID Selector: #${emailInput.id}`);
    }
    if (emailInput.name) {
      console.log(`   Name Selector: [name="${emailInput.name}"]`);
    }
  } else {
    console.log(`\n⚠️ Email/Username Input: NOT FOUND`);
  }

  if (passwordInput) {
    console.log(`\n🔒 Password Input:`);
    console.log(`   Best Selector: ${passwordInput.fullSelector}`);
    console.log(`   Alternative: ${passwordInput.selector}`);
    if (passwordInput.id) {
      console.log(`   ID Selector: #${passwordInput.id}`);
    }
    if (passwordInput.name) {
      console.log(`   Name Selector: [name="${passwordInput.name}"]`);
    }
  } else {
    console.log(`\n⚠️ Password Input: NOT FOUND`);
  }

  if (submitButton) {
    console.log(`\n🔘 Submit Button:`);
    console.log(`   Best Selector: ${submitButton.selector}`);
    if (submitButton.id) {
      console.log(`   ID Selector: #${submitButton.id}`);
    }
    if (submitButton.text) {
      console.log(`   Text Selector: button:has-text("${submitButton.text}")`);
    }
  } else {
    console.log(`\n⚠️ Submit Button: NOT FOUND`);
  }

  // Save page HTML for inspection
  const html = await page.content();
  const debugDir = path.join(process.cwd(), 'debug-html');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = path.join(debugDir, `retrotrac-login-inspection-${timestamp}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`\n💾 Page HTML saved to: ${htmlPath}`);

  return {
    emailInput,
    passwordInput,
    submitButton,
    allInputs: inputs,
    allButtons: buttons,
  };
}

async function testLoginFlow(page: any, inspection: any) {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING LOGIN FLOW');
  console.log('='.repeat(80));

  try {
    // Test email input
    if (inspection.emailInput) {
      console.log(`\n📧 Testing email input with selector: ${inspection.emailInput.fullSelector}`);
      await page.waitForSelector(inspection.emailInput.fullSelector, { timeout: 10000 });
      await page.fill(inspection.emailInput.fullSelector, RETROTRAC_CONFIG.loginUsername);
      console.log('   ✅ Email filled successfully');
    } else {
      throw new Error('Email input not found');
    }

    await page.waitForTimeout(500);

    // Test password input
    if (inspection.passwordInput) {
      console.log(`\n🔒 Testing password input with selector: ${inspection.passwordInput.fullSelector}`);
      await page.waitForSelector(inspection.passwordInput.fullSelector, { timeout: 10000 });
      await page.fill(inspection.passwordInput.fullSelector, RETROTRAC_CONFIG.loginPassword);
      console.log('   ✅ Password filled successfully');
    } else {
      throw new Error('Password input not found');
    }

    await page.waitForTimeout(500);

    // Test submit button
    if (inspection.submitButton) {
      console.log(`\n🔘 Testing submit button with selector: ${inspection.submitButton.selector}`);
      await page.waitForSelector(inspection.submitButton.selector, { timeout: 10000 });
      await page.click(inspection.submitButton.selector);
      console.log('   ✅ Button clicked successfully');
    } else {
      throw new Error('Submit button not found');
    }

    // Wait for navigation
    console.log('\n⏳ Waiting for login to complete...');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const pageTitle = await page.title();

    console.log(`\n✅ Login test completed!`);
    console.log(`   Current URL: ${currentUrl}`);
    console.log(`   Page Title: ${pageTitle}`);

    // Check if login was successful (not on login page anymore)
    if (!currentUrl.includes('/login')) {
      console.log('   ✅ Login appears successful (redirected away from login page)');
    } else {
      console.log('   ⚠️ Still on login page - login may have failed');
    }

    // Save post-login HTML
    const html = await page.content();
    const debugDir = path.join(process.cwd(), 'debug-html');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlPath = path.join(debugDir, `retrotrac-after-login-test-${timestamp}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   💾 Post-login HTML saved to: ${htmlPath}`);

    return { success: !currentUrl.includes('/login'), url: currentUrl, title: pageTitle };
  } catch (error: any) {
    console.error(`\n❌ Login test failed: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting RETROTRAC Login Page Inspection');
  console.log(`📋 Login URL: ${RETROTRAC_CONFIG.loginUrl}`);
  console.log(`🔐 Username: ${RETROTRAC_CONFIG.loginUsername}`);
  console.log('');

  const browser = await chromium.launch({
    headless: false, // Run in headed mode so you can see what's happening
    slowMo: 300, // Slow down operations by 300ms for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log('🌐 Navigating to login page...');
    await page.goto(RETROTRAC_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Inspect the page
    const inspection = await inspectLoginPage(page);

    // Test the login flow
    const loginResult = await testLoginFlow(page, inspection);

    // Generate recommended steps
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECOMMENDED STEPS CONFIGURATION:');
    console.log('='.repeat(80));
    console.log('\nCopy this to retrotrac-steps.ts:\n');

    const emailSelector = inspection.emailInput?.fullSelector || inspection.emailInput?.selector || 'input[type="email"]';
    const passwordSelector = inspection.passwordInput?.fullSelector || inspection.passwordInput?.selector || 'input[type="password"]';
    const submitSelector = inspection.submitButton?.selector || 'button:has-text("Ingresar")';

    console.log(`export const retrotracLoginSteps = [
    {
        type: 'goto',
        url: 'https://tiendab2b.retrotrac.com/login',
        options: { waitUntil: 'domcontentloaded', timeout: 60000 }
    },
    {
        type: 'wait',
        options: { timeout: 3000 }
    },
    {
        type: 'wait',
        selector: '${emailSelector}',
        options: { timeout: 30000 }
    },
    {
        type: 'fill',
        selector: '${emailSelector}',
        value: '{{username}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 }
    },
    {
        type: 'wait',
        selector: '${passwordSelector}',
        options: { timeout: 30000 }
    },
    {
        type: 'fill',
        selector: '${passwordSelector}',
        value: '{{password}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 }
    },
    {
        type: 'click',
        selector: '${submitSelector}',
        options: { timeout: 30000, waitUntil: 'networkidle' }
    },
    {
        type: 'wait',
        options: { timeout: 5000 }
    },
    {
        type: 'log-html',
        options: { filename: 'retrotrac-after-login.html' }
    }
];`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Inspection completed successfully!');
    console.log('='.repeat(80));

    // Keep browser open for 10 seconds so you can see the result
    console.log('\n⏳ Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } catch (error: any) {
    console.error('\n❌ Inspection failed:', error.message);
    console.error(error.stack);

    // Save error state
    try {
      const html = await page.content();
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const htmlPath = path.join(debugDir, `retrotrac-inspection-ERROR-${timestamp}.html`);
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

