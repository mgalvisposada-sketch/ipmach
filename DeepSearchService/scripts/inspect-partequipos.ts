import puppeteer from 'puppeteer';

const PARTEQUIPOS_CONFIG = {
  loginUrl: 'https://tienda.partequipos.com/customer/account',
  loginUsername: 'a.galvis@ciparcol.com',
  loginPassword: 'cip800145360*',
  reference: '1u3202',
  searchUrl: 'https://tienda.partequipos.com/catalogsearch/result/?q=1u3202',
};

async function inspectPartequipos() {
  console.log('🔍 Starting PARTEQUIPOS inspection...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for inspection
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate to login page
    console.log(`🌐 Navigating to login page: ${PARTEQUIPOS_CONFIG.loginUrl}`);
    await page.goto(PARTEQUIPOS_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page to load

    // Inspect login form
    console.log('\n🔍 Inspecting login form...');
    const loginForm = await page.evaluate(() => {
      const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="email"], input[id*="email"]')).map((input: any) => ({
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
      }));

      const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).map((input: any) => ({
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
      }));

      const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button')).map((btn: any) => ({
        tagName: btn.tagName,
        type: (btn as HTMLInputElement).type || 'button',
        text: btn.textContent?.trim() || '',
        value: (btn as HTMLInputElement).value || '',
        id: btn.id || '',
        className: btn.className || '',
        selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
      }));

      return { emailInputs, passwordInputs, submitButtons };
    });

    console.log(`  📧 Found ${loginForm.emailInputs.length} email inputs:`);
    loginForm.emailInputs.forEach((input, i) => {
      console.log(`     ${i + 1}. ID: "${input.id}", Name: "${input.name}"`);
      console.log(`        Selector: ${input.selector || 'N/A'}`);
    });

    console.log(`  🔒 Found ${loginForm.passwordInputs.length} password inputs:`);
    loginForm.passwordInputs.forEach((input, i) => {
      console.log(`     ${i + 1}. ID: "${input.id}", Name: "${input.name}"`);
      console.log(`        Selector: ${input.selector || 'N/A'}`);
    });

    console.log(`  🔘 Found ${loginForm.submitButtons.length} buttons:`);
    loginForm.submitButtons.slice(0, 10).forEach((btn, i) => {
      console.log(`     ${i + 1}. Tag: ${btn.tagName}, Text: "${btn.text || btn.value}"`);
      console.log(`        Selector: ${btn.selector || 'N/A'}`);
    });

    // Try to find and fill login form
    let emailSelector = '';
    let passwordSelector = '';
    let submitSelector = '';

    if (loginForm.emailInputs.length > 0) {
      // Prefer #email which is the main login form
      const mainEmailInput = loginForm.emailInputs.find(input => input.id === 'email') || loginForm.emailInputs[0];
      emailSelector = mainEmailInput.selector || `input[type="email"]`;
      console.log(`\n✅ Using email selector: ${emailSelector}`);
    } else {
      console.log('\n⚠️  No email input found, trying generic selectors...');
      emailSelector = 'input[type="email"]';
    }

    if (loginForm.passwordInputs.length > 0) {
      // Prefer #pass which is the main login form
      const mainPasswordInput = loginForm.passwordInputs.find(input => input.id === 'pass') || loginForm.passwordInputs[0];
      passwordSelector = mainPasswordInput.selector || `input[type="password"]`;
      console.log(`✅ Using password selector: ${passwordSelector}`);
    } else {
      console.log('⚠️  No password input found, trying generic selectors...');
      passwordSelector = 'input[type="password"]';
    }

    // Find submit button - prefer #send2 which is the login button
    const loginButton = loginForm.submitButtons.find((btn) =>
      btn.id === 'send2'
    );

    if (loginButton) {
      submitSelector = `#${loginButton.id}`;
      console.log(`✅ Using submit selector: ${submitSelector} (text: "${loginButton.text}")`);
    } else {
      // Fallback to button with type="submit" in the login form
      submitSelector = 'form#login-form button[type="submit"], .login-form button[type="submit"], button[type="submit"]';
      console.log(`⚠️  Using fallback submit selector: ${submitSelector}`);
    }

    // Wait for inputs to be visible
    console.log('\n⏳ Waiting for login inputs to be visible...');
    await page.waitForSelector(emailSelector, { visible: true, timeout: 30000 }).catch(() => {
      console.log('⚠️  Email input not found with first selector, trying alternatives...');
    });

    await page.waitForSelector(passwordSelector, { visible: true, timeout: 30000 }).catch(() => {
      console.log('⚠️  Password input not found with first selector, trying alternatives...');
    });

    // Fill login form
    console.log('\n📝 Filling login form...');
    const emailInput = await page.$(emailSelector);
    if (emailInput) {
      await emailInput.click({ clickCount: 3 }); // Select all
      await emailInput.type(PARTEQUIPOS_CONFIG.loginUsername);
      console.log(`  ✅ Filled email: ${PARTEQUIPOS_CONFIG.loginUsername}`);
    } else {
      throw new Error(`Email input not found: ${emailSelector}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const passwordInput = await page.$(passwordSelector);
    if (passwordInput) {
      await passwordInput.click({ clickCount: 3 }); // Select all
      await passwordInput.type(PARTEQUIPOS_CONFIG.loginPassword);
      console.log(`  ✅ Filled password: ***`);
    } else {
      throw new Error(`Password input not found: ${passwordSelector}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click submit
    console.log('\n🔘 Clicking login button...');
    const submitButton = await page.$(submitSelector);
    if (submitButton) {
      await submitButton.click();
      console.log(`  ✅ Clicked login button: ${submitSelector}`);
    } else {
      throw new Error(`Submit button not found: ${submitSelector}`);
    }
    console.log('  ✅ Clicked login button');

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {
      console.log('⚠️  Navigation timeout, but continuing...');
    });

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for login to complete

    const urlAfterLogin = page.url();
    console.log(`\n📍 URL after login: ${urlAfterLogin}`);

    // Check if login was successful
    const isLoggedIn = await page.evaluate(() => {
      // Look for indicators of successful login
      const allLinks = Array.from(document.querySelectorAll('a'));
      const hasLogoutLink = allLinks.some(link => 
        link.href.includes('logout') || 
        link.textContent?.includes('Cerrar') || 
        link.textContent?.includes('Salir')
      );
      const hasAccountLink = allLinks.some(link => 
        link.href.includes('account') || 
        link.textContent?.includes('Mi cuenta')
      );
      const hasWelcomeMessage = document.body.textContent?.includes('Bienvenido') || 
                                document.body.textContent?.includes('Welcome');
      return !!(hasLogoutLink || hasAccountLink || hasWelcomeMessage);
    });

    if (isLoggedIn) {
      console.log('✅ Login appears successful');
    } else {
      console.log('⚠️  Login status unclear, but continuing...');
    }

    // Navigate to search page
    console.log(`\n🌐 Navigating to search page: ${PARTEQUIPOS_CONFIG.searchUrl}`);
    await page.goto(PARTEQUIPOS_CONFIG.searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for search results to load

    const urlAfterSearch = page.url();
    console.log(`📍 URL after search: ${urlAfterSearch}`);

    // Inspect search results
    console.log('\n🔍 Inspecting search results...');
    const searchResults = await page.evaluate(() => {
      // Look for product containers
      const productContainers = Array.from(document.querySelectorAll('.product-item, .product, [class*="product"], .item, [class*="item"]')).slice(0, 5);
      
      const products = productContainers.map((container: any, index: number) => {
        const title = container.querySelector('h2, h3, .product-name, [class*="name"], a.product-item-link')?.textContent?.trim() || '';
        const price = container.querySelector('.price, [class*="price"], .price-box')?.textContent?.trim() || '';
        const sku = container.querySelector('.sku, [class*="sku"]')?.textContent?.trim() || '';
        const link = container.querySelector('a')?.href || '';
        
        return {
          index: index + 1,
          title: title.substring(0, 50),
          price: price.substring(0, 30),
          sku: sku.substring(0, 30),
          link: link.substring(0, 100),
          html: container.outerHTML.substring(0, 200),
        };
      });

      // Look for common selectors
      const selectors = {
        productList: document.querySelector('.products-grid, .products-list, [class*="products"], .search-results'),
        productItem: document.querySelector('.product-item, .product, [class*="product-item"]'),
        price: document.querySelector('.price, [class*="price"]'),
        productName: document.querySelector('.product-name, [class*="product-name"]'),
      };

      return { products, selectors };
    });

    console.log(`  📦 Found ${searchResults.products.length} product containers`);
    searchResults.products.forEach((product) => {
      console.log(`     Product ${product.index}:`);
      console.log(`       Title: ${product.title}`);
      console.log(`       Price: ${product.price}`);
      console.log(`       SKU: ${product.sku}`);
    });

    // Save HTML for inspection
    const html = await page.content();
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(process.cwd(), 'debug-html');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const filename = `partequipos-search-results-${PARTEQUIPOS_CONFIG.reference}-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
    const filepath = path.join(debugDir, filename);
    fs.writeFileSync(filepath, html);
    console.log(`\n💾 Saved HTML to: ${filepath}`);

    console.log('\n✅ Inspection complete!');
    console.log('\n📋 Summary:');
    console.log(`   Email selector: ${emailSelector}`);
    console.log(`   Password selector: ${passwordSelector}`);
    console.log(`   Submit selector: ${submitSelector}`);
    console.log(`   Search URL pattern: https://tienda.partequipos.com/catalogsearch/result/?q={{reference}}`);

  } catch (error: any) {
    console.error('❌ Error during inspection:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await browser.close();
  }
}

inspectPartequipos().catch(console.error);

