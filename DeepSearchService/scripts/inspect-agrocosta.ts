/**
 * Browser inspection script to identify AGROCOSTA login and search selectors
 * Usage: tsx scripts/inspect-agrocosta.ts
 */

import { chromium } from 'playwright';

const AGROCOSTA_CONFIG = {
  loginUrl: 'https://agro-costa.com/consulta/consulta_inventario.php',
  searchUrl: 'https://agro-costa.com/consulta/consulta_inventario.php',
  loginUsername: 'ciparc',
  loginPassword: 'COL25',
  reference: '2099886', // Test reference
};

async function inspectAgrocosta() {
  console.log('🚀 Starting AGROCOSTA Inspection');
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
    // Step 1: Navigate to the page
    console.log('🌐 Navigating to:', AGROCOSTA_CONFIG.loginUrl);
    await page.goto(AGROCOSTA_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // Check if we need to login
    console.log('\n📋 Inspecting page for login form...');
    
    const loginForm = await page.evaluate(() => {
      // Find all input fields
      const inputs = Array.from(document.querySelectorAll('input')).map((input) => ({
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
      }));

      // Find all buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map((btn) => ({
        tagName: btn.tagName,
        type: (btn as HTMLInputElement).type || 'button',
        text: btn.textContent?.trim() || '',
        value: (btn as HTMLInputElement).value || '',
        id: btn.id || '',
        className: btn.className || '',
        selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
      }));

      // Find forms
      const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
        action: form.action || '',
        method: form.method || '',
        id: form.id || '',
        className: form.className || '',
      }));

      return { inputs, buttons, forms };
    });

    console.log(`\n📝 Found ${loginForm.inputs.length} input fields:`);
    loginForm.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}`);
      console.log(`     Placeholder: "${input.placeholder}"`);
      console.log(`     Selector: ${input.selector || 'N/A'}`);
    });

    console.log(`\n🔘 Found ${loginForm.buttons.length} buttons:`);
    loginForm.buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. Tag: ${btn.tagName}, Type: ${btn.type}`);
      console.log(`     Text: "${btn.text || btn.value}"`);
      console.log(`     ID: ${btn.id || 'N/A'}, Class: ${btn.className || 'N/A'}`);
      console.log(`     Selector: ${btn.selector || 'N/A'}`);
    });

    console.log(`\n📋 Found ${loginForm.forms.length} forms:`);
    loginForm.forms.forEach((form, i) => {
      console.log(`  ${i + 1}. Method: ${form.method}, Action: ${form.action}`);
      console.log(`     ID: ${form.id || 'N/A'}, Class: ${form.className || 'N/A'}`);
    });

    // Identify username and password inputs
    const usernameInput = loginForm.inputs.find(
      (input) =>
        input.type === 'text' &&
        (input.name?.toLowerCase().includes('usuario') ||
         input.name?.toLowerCase().includes('user') ||
         input.placeholder?.toLowerCase().includes('usuario') ||
         input.placeholder?.toLowerCase().includes('user'))
    );

    const passwordInput = loginForm.inputs.find(
      (input) =>
        input.type === 'password' ||
        (input.name?.toLowerCase().includes('password') ||
         input.name?.toLowerCase().includes('contraseña') ||
         input.placeholder?.toLowerCase().includes('password') ||
         input.placeholder?.toLowerCase().includes('contraseña'))
    );

    const loginButton = loginForm.buttons.find(
      (btn) =>
        btn.text?.toLowerCase().includes('iniciar') ||
        btn.text?.toLowerCase().includes('login') ||
        btn.text?.toLowerCase().includes('entrar') ||
        btn.value?.toLowerCase().includes('iniciar')
    );

    console.log('\n🔍 Identified Elements:');
    if (usernameInput) {
      console.log(`  ✅ Username input: ${usernameInput.selector || `input[name="${usernameInput.name}"]`}`);
    } else {
      console.log('  ❌ Username input not found');
    }

    if (passwordInput) {
      console.log(`  ✅ Password input: ${passwordInput.selector || `input[name="${passwordInput.name}"]`}`);
    } else {
      console.log('  ❌ Password input not found');
    }

    if (loginButton) {
      console.log(`  ✅ Login button: ${loginButton.selector || loginButton.text}`);
    } else {
      console.log('  ❌ Login button not found');
    }

    // Try to login if form is found
    if (usernameInput && passwordInput && loginButton) {
      console.log('\n🔐 Attempting login...');
      
      const usernameSelector = usernameInput.selector || `input[name="${usernameInput.name}"]`;
      const passwordSelector = passwordInput.selector || `input[name="${passwordInput.name}"]`;
      const buttonSelector = loginButton.selector || `button:has-text("${loginButton.text}")`;

      await page.waitForSelector(usernameSelector, { timeout: 30000 });
      await page.fill(usernameSelector, AGROCOSTA_CONFIG.loginUsername);
      console.log(`  ✅ Filled username: ${AGROCOSTA_CONFIG.loginUsername}`);

      await page.waitForSelector(passwordSelector, { timeout: 30000 });
      await page.fill(passwordSelector, AGROCOSTA_CONFIG.loginPassword);
      console.log('  ✅ Filled password: ******');

      await page.waitForTimeout(1000);

      // Try to click the button
      try {
        if (loginButton.selector) {
          await page.click(loginButton.selector);
        } else {
          await page.click(`button:has-text("${loginButton.text}")`);
        }
        console.log('  ✅ Clicked login button');
      } catch (e) {
        console.log('  ⚠️  Could not click button, trying submit on form');
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(3000);
      const urlAfterLogin = page.url();
      console.log(`  📍 URL after login: ${urlAfterLogin}`);
    }

    // Now inspect the search form
    console.log('\n🔍 Inspecting search form...');
    await page.waitForTimeout(2000);

    const searchForm = await page.evaluate(() => {
      // Find all input fields
      const inputs = Array.from(document.querySelectorAll('input')).map((input) => ({
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        value: (input as HTMLInputElement).value || '',
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
      }));

      // Find search-related inputs
      const searchInputs = inputs.filter(
        (input) =>
          input.name?.toLowerCase().includes('referencia') ||
          input.name?.toLowerCase().includes('reference') ||
          input.name?.toLowerCase().includes('buscar') ||
          input.name?.toLowerCase().includes('search') ||
          input.placeholder?.toLowerCase().includes('referencia') ||
          input.placeholder?.toLowerCase().includes('reference')
      );

      // Find submit buttons
      const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]')).map((btn) => ({
        tagName: btn.tagName,
        type: (btn as HTMLInputElement).type || 'button',
        text: btn.textContent?.trim() || '',
        value: (btn as HTMLInputElement).value || '',
        id: btn.id || '',
        className: btn.className || '',
        selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
      }));

      return { inputs, searchInputs, submitButtons };
    });

    console.log(`\n📝 Found ${searchForm.inputs.length} total input fields:`);
    searchForm.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: "${input.name}", ID: "${input.id}"`);
      console.log(`     Placeholder: "${input.placeholder}"`);
      console.log(`     Selector: ${input.selector || 'N/A'}`);
    });

    if (searchForm.searchInputs.length > 0) {
      console.log(`\n🔍 Found ${searchForm.searchInputs.length} search-related inputs:`);
      searchForm.searchInputs.forEach((input, i) => {
        console.log(`  ${i + 1}. Name: "${input.name}", ID: "${input.id}"`);
        console.log(`     Selector: ${input.selector}`);
      });
    } else {
      console.log('\n⚠️  No search inputs found with "referencia" or "reference" in name');
      console.log('   Checking all text inputs...');
      const textInputs = searchForm.inputs.filter((input) => input.type === 'text');
      textInputs.forEach((input, i) => {
        console.log(`  ${i + 1}. Name: "${input.name}", ID: "${input.id}"`);
        console.log(`     Selector: ${input.selector}`);
      });
    }

    console.log(`\n🔘 Found ${searchForm.submitButtons.length} submit buttons:`);
    searchForm.submitButtons.forEach((btn, i) => {
      console.log(`  ${i + 1}. Tag: ${btn.tagName}, Type: ${btn.type}`);
      console.log(`     Text/Value: "${btn.text || btn.value}"`);
      console.log(`     Selector: ${btn.selector || 'N/A'}`);
    });

    // Try to fill and submit search
    if (searchForm.searchInputs.length > 0 || searchForm.inputs.length > 0) {
      console.log('\n🧪 Testing search input...');
      
      // Use the first search input, or first text input if no search input found
      // Make sure we get the text input, not the radio button
      const searchInput = searchForm.searchInputs.find((input) => input.type === 'text') || 
                         searchForm.inputs.find((input) => input.type === 'text' && input.name?.toLowerCase().includes('referencia'));
      
      if (searchInput) {
        // Use a more specific selector to avoid radio buttons
        const searchSelector = `input[type="text"][name="${searchInput.name}"]` || 
                              `input[type="text"]#${searchInput.id}` ||
                              searchInput.selector;
        console.log(`  Using selector: ${searchSelector}`);
        
        await page.waitForSelector(searchSelector, { timeout: 30000 });
        await page.fill(searchSelector, '');
        await page.fill(searchSelector, AGROCOSTA_CONFIG.reference);
        console.log(`  ✅ Filled search input with: ${AGROCOSTA_CONFIG.reference}`);
        
        await page.waitForTimeout(1000);
        
        // Try to submit
        const submitButton = searchForm.submitButtons[0];
        if (submitButton) {
          console.log(`  Clicking submit button: ${submitButton.selector || submitButton.text}`);
          if (submitButton.selector) {
            await page.click(submitButton.selector);
          } else {
            await page.keyboard.press('Enter');
          }
        } else {
          console.log('  Pressing Enter key...');
          await page.keyboard.press('Enter');
        }
        
        await page.waitForTimeout(3000);
        const urlAfterSearch = page.url();
        console.log(`  📍 URL after search: ${urlAfterSearch}`);
      }
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
    const htmlPath = path.join(debugDir, `agrocosta-inspection-${timestamp}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`\n💾 Page HTML saved to: ${htmlPath}`);

    console.log('\n⏳ Keeping browser open for 15 seconds so you can inspect...');
    await page.waitForTimeout(15000);
  } catch (error: any) {
    console.error('\n❌ Inspection failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

inspectAgrocosta().catch(console.error);

