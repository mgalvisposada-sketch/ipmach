import puppeteer from 'puppeteer';

const AGROCOSTA_CONFIG = {
  loginUrl: 'https://agro-costa.com/consulta/consulta_inventario.php',
  loginUsername: 'ciparc',
  loginPassword: 'COL25',
  reference: '1R0750',
};

async function inspectAgrocosta() {
  console.log('🔍 Starting AGROCOSTA inspection...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for inspection
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate to login page
    console.log(`🌐 Navigating to login page: ${AGROCOSTA_CONFIG.loginUrl}`);
    await page.goto(AGROCOSTA_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for page to fully load

    const urlAfterLoad = page.url();
    console.log(`📍 URL after load: ${urlAfterLoad}`);

    // Inspect login form
    console.log('\n🔍 Inspecting login form...');
    const loginForm = await page.evaluate(() => {
      // Find all input fields
      const inputs = Array.from(document.querySelectorAll('input')).map((input: any) => ({
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        value: (input as HTMLInputElement).value || '',
        visible: input.offsetParent !== null,
        disabled: input.disabled,
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
      }));

      // Find all buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map((btn: any) => ({
        tagName: btn.tagName,
        type: (btn as HTMLInputElement).type || 'button',
        text: btn.textContent?.trim() || '',
        value: (btn as HTMLInputElement).value || '',
        id: btn.id || '',
        className: btn.className || '',
        selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
      }));

      // Find all forms
      const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
        id: form.id || '',
        name: form.name || '',
        action: form.action || '',
        method: form.method || '',
        html: form.outerHTML.substring(0, 500),
      }));

      return { inputs, buttons, forms };
    });

    console.log(`  📝 Found ${loginForm.inputs.length} input fields:`);
    loginForm.inputs.forEach((input, i) => {
      console.log(`     ${i + 1}. Type: ${input.type}, Name: "${input.name}", ID: "${input.id}"`);
      console.log(`        Visible: ${input.visible}, Disabled: ${input.disabled}`);
      console.log(`        Selector: ${input.selector || 'N/A'}`);
    });

    console.log(`  🔘 Found ${loginForm.buttons.length} buttons:`);
    loginForm.buttons.slice(0, 10).forEach((btn, i) => {
      console.log(`     ${i + 1}. Tag: ${btn.tagName}, Text: "${btn.text || btn.value}"`);
      console.log(`        Selector: ${btn.selector || 'N/A'}`);
    });

    console.log(`  📋 Found ${loginForm.forms.length} forms:`);
    loginForm.forms.forEach((form, i) => {
      console.log(`     ${i + 1}. Name: "${form.name}", ID: "${form.id}"`);
      console.log(`        Method: ${form.method}, Action: ${form.action || 'N/A'}`);
    });

    // Try to identify username and password fields
    let usernameSelector = '';
    let passwordSelector = '';
    let submitSelector = '';

    // Look for username field - try multiple patterns
    const usernameInput = loginForm.inputs.find((input) =>
      input.name?.toLowerCase().includes('usuario') ||
      input.name?.toLowerCase().includes('user') ||
      input.name?.toLowerCase().includes('email') ||
      input.id?.toLowerCase().includes('usuario') ||
      input.id?.toLowerCase().includes('user') ||
      (input.type === 'text' && !input.name?.toLowerCase().includes('referencia'))
    );

    if (usernameInput) {
      usernameSelector = usernameInput.selector || `input[name="${usernameInput.name}"]`;
      console.log(`\n✅ Using username selector: ${usernameSelector}`);
    } else {
      console.log('\n⚠️  No username input found, trying generic selectors...');
      usernameSelector = 'input[type="text"]:not([name*="referencia"])';
    }

    // Look for password field
    const passwordInput = loginForm.inputs.find((input) =>
      input.type === 'password' ||
      input.name?.toLowerCase().includes('password') ||
      input.name?.toLowerCase().includes('contraseña') ||
      input.name?.toLowerCase().includes('pass') ||
      input.id?.toLowerCase().includes('password') ||
      input.id?.toLowerCase().includes('pass')
    );

    if (passwordInput) {
      passwordSelector = passwordInput.selector || `input[name="${passwordInput.name}"]`;
      console.log(`✅ Using password selector: ${passwordSelector}`);
    } else {
      console.log('⚠️  No password input found, trying generic selectors...');
      passwordSelector = 'input[type="password"]';
    }

    // Find submit button
    const submitButton = loginForm.buttons.find((btn) =>
      btn.type === 'submit' ||
      btn.text?.toLowerCase().includes('iniciar') ||
      btn.text?.toLowerCase().includes('login') ||
      btn.text?.toLowerCase().includes('entrar') ||
      btn.text?.toLowerCase().includes('enviar')
    );

    if (submitButton) {
      submitSelector = submitButton.selector || 'button[type="submit"], input[type="submit"]';
      console.log(`✅ Using submit selector: ${submitSelector} (text: "${submitButton.text}")`);
    } else {
      submitSelector = 'button[type="submit"], input[type="submit"], .btn';
      console.log(`⚠️  Using default submit selector: ${submitSelector}`);
    }

    // Wait for inputs to be visible
    console.log('\n⏳ Waiting for login inputs to be visible...');
    try {
      await page.waitForSelector(usernameSelector, { visible: true, timeout: 30000 });
      console.log(`  ✅ Username input found: ${usernameSelector}`);
    } catch (e: any) {
      console.log(`  ⚠️  Username input not found with selector: ${usernameSelector}`);
      console.log(`  Error: ${e.message}`);
      
      // Try alternative selectors
      const altSelectors = [
        'input[name="usuario"]',
        'input[type="text"]',
        'input:not([type="hidden"])',
      ];
      
      for (const altSelector of altSelectors) {
        try {
          await page.waitForSelector(altSelector, { visible: true, timeout: 5000 });
          usernameSelector = altSelector;
          console.log(`  ✅ Found username with alternative selector: ${altSelector}`);
          break;
        } catch {
          // Continue to next
        }
      }
    }

    try {
      await page.waitForSelector(passwordSelector, { visible: true, timeout: 30000 });
      console.log(`  ✅ Password input found: ${passwordSelector}`);
    } catch (e: any) {
      console.log(`  ⚠️  Password input not found with selector: ${passwordSelector}`);
      console.log(`  Error: ${e.message}`);
    }

    // Try to fill login form
    console.log('\n📝 Attempting to fill login form...');
    try {
      const usernameInput = await page.$(usernameSelector);
      if (usernameInput) {
        await usernameInput.click({ clickCount: 3 }); // Select all
        await usernameInput.type(AGROCOSTA_CONFIG.loginUsername);
        console.log(`  ✅ Filled username: ${AGROCOSTA_CONFIG.loginUsername}`);
      } else {
        throw new Error(`Username input not found: ${usernameSelector}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const passwordInput = await page.$(passwordSelector);
      if (passwordInput) {
        await passwordInput.click({ clickCount: 3 }); // Select all
        await passwordInput.type(AGROCOSTA_CONFIG.loginPassword);
        console.log(`  ✅ Filled password: ***`);
      } else {
        throw new Error(`Password input not found: ${passwordSelector}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click submit
      console.log('\n🔘 Clicking submit button...');
      const submitButton = await page.$(submitSelector);
      if (submitButton) {
        await submitButton.click();
        console.log(`  ✅ Clicked submit button: ${submitSelector}`);
      } else {
        throw new Error(`Submit button not found: ${submitSelector}`);
      }

      // Wait for navigation or form submission
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {
        console.log('⚠️  Navigation timeout, but continuing...');
      });

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for login to complete

      const urlAfterLogin = page.url();
      console.log(`\n📍 URL after login: ${urlAfterLogin}`);

      // Check if we're still on login page or if login was successful
      const isStillOnLogin = urlAfterLogin.includes('login') || urlAfterLogin.includes('inicio');
      if (isStillOnLogin) {
        console.log('⚠️  Still on login page, login may have failed');
      } else {
        console.log('✅ Navigated away from login page, login may have succeeded');
      }

      // Now check for search input
      console.log('\n🔍 Inspecting search input after login...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const searchInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]')).map((input: any) => ({
          type: input.type,
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          className: input.className || '',
          value: (input as HTMLInputElement).value || '',
          visible: input.offsetParent !== null,
          disabled: input.disabled,
          selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
        }));
        return inputs;
      });

      console.log(`  📝 Found ${searchInputs.length} text inputs after login:`);
      searchInputs.forEach((input, i) => {
        console.log(`     ${i + 1}. Name: "${input.name}", ID: "${input.id}"`);
        console.log(`        Visible: ${input.visible}, Selector: ${input.selector}`);
      });

      // Find search input for reference
      const searchInput = searchInputs.find((input) =>
        input.name?.toLowerCase().includes('referencia') ||
        input.id?.toLowerCase().includes('referencia') ||
        input.placeholder?.toLowerCase().includes('referencia')
      );

      if (searchInput) {
        console.log(`\n✅ Found search input: ${searchInput.selector}`);
      } else {
        console.log('\n⚠️  Search input not found, but continuing...');
      }

    } catch (error: any) {
      console.error(`❌ Error during login attempt: ${error.message}`);
    }

    // Save HTML for inspection
    const html = await page.content();
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(process.cwd(), 'debug-html');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const filename = `agrocosta-inspection-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
    const filepath = path.join(debugDir, filename);
    fs.writeFileSync(filepath, html);
    console.log(`\n💾 Saved HTML to: ${filepath}`);

    console.log('\n✅ Inspection complete!');
    console.log('\n📋 Summary:');
    console.log(`   Username selector: ${usernameSelector}`);
    console.log(`   Password selector: ${passwordSelector}`);
    console.log(`   Submit selector: ${submitSelector}`);

  } catch (error: any) {
    console.error('❌ Error during inspection:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await browser.close();
  }
}

inspectAgrocosta().catch(console.error);

