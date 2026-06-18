/**
 * Browser inspection script to identify SERVITRACTOR login and search selectors
 * Usage: tsx scripts/inspect-servitractor.ts
 */

import { chromium } from 'playwright';

const SERVITRACTOR_CONFIG = {
  loginUrl: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio',
  loginUsername: 'comercial2@ciparcol.com',
  loginPassword: 'Ciparcol2025*',
  reference: '2099886', // Test reference
};

async function inspectServitractor() {
  console.log('🚀 Starting SERVITRACTOR Inspection');
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
    console.log('🌐 Navigating to:', SERVITRACTOR_CONFIG.loginUrl);
    await page.goto(SERVITRACTOR_CONFIG.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(5000); // Wait for Zoho page to load

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

      // Check for iframes (Zoho often uses iframes)
      const iframes = Array.from(document.querySelectorAll('iframe')).map((iframe) => ({
        id: iframe.id || '',
        name: iframe.name || '',
        src: iframe.src || '',
        className: iframe.className || '',
      }));

      return { inputs, buttons, forms, iframes };
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

    console.log(`\n🖼️  Found ${loginForm.iframes.length} iframes:`);
    loginForm.iframes.forEach((iframe, i) => {
      console.log(`  ${i + 1}. ID: ${iframe.id || 'N/A'}, Name: ${iframe.name || 'N/A'}`);
      console.log(`     Src: ${iframe.src || 'N/A'}`);
    });

    // Check if login is in an iframe
    let targetPage = page;
    let iframeFrame = null;
    if (loginForm.iframes.length > 0) {
      console.log('\n🔍 Checking if login form is inside an iframe...');
      for (const iframe of loginForm.iframes) {
        try {
          const frame = iframe.name 
            ? page.frame({ name: iframe.name })
            : iframe.id
            ? page.frame({ url: iframe.src })
            : null;
          
          if (frame) {
            console.log(`  ✅ Found iframe: ${iframe.name || iframe.id || 'unnamed'}`);
            const iframeInputs = await frame.evaluate(() => {
              return Array.from(document.querySelectorAll('input')).map((input) => ({
                type: input.type,
                name: input.name || '',
                id: input.id || '',
                placeholder: input.placeholder || '',
                className: input.className || '',
                selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
              }));
            });
            
            if (iframeInputs.length > 0) {
              console.log(`  📝 Found ${iframeInputs.length} inputs in iframe:`);
              iframeInputs.forEach((input, i) => {
                console.log(`    ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}`);
                console.log(`       Placeholder: "${input.placeholder}"`);
                console.log(`       Selector: ${input.selector || 'N/A'}`);
              });
              
              // Update loginForm.inputs with iframe inputs
              loginForm.inputs = iframeInputs;
              targetPage = frame as any;
              iframeFrame = frame;
              break;
            }
          }
        } catch (e) {
          console.log(`  ⚠️  Could not access iframe: ${iframe.name || iframe.id || 'unnamed'}`);
        }
      }
    }

    // Identify username and password inputs
    const usernameInput = loginForm.inputs.find(
      (input) =>
        (input.type === 'text' || input.type === 'email') &&
        (input.name?.toLowerCase().includes('email') ||
         input.name?.toLowerCase().includes('usuario') ||
         input.name?.toLowerCase().includes('user') ||
         input.name?.toLowerCase().includes('login') ||
         input.placeholder?.toLowerCase().includes('email') ||
         input.placeholder?.toLowerCase().includes('usuario') ||
         input.id?.toLowerCase().includes('email') ||
         input.id?.toLowerCase().includes('user') ||
         input.id?.toLowerCase().includes('login'))
    );

    const passwordInput = loginForm.inputs.find(
      (input) =>
        input.type === 'password' ||
        (input.name?.toLowerCase().includes('password') ||
         input.name?.toLowerCase().includes('contraseña') ||
         input.placeholder?.toLowerCase().includes('password') ||
         input.placeholder?.toLowerCase().includes('contraseña') ||
         input.id?.toLowerCase().includes('password'))
    );

    const loginButton = loginForm.buttons.find(
      (btn) =>
        btn.text?.toLowerCase().includes('iniciar') ||
        btn.text?.toLowerCase().includes('login') ||
        btn.text?.toLowerCase().includes('entrar') ||
        btn.text?.toLowerCase().includes('sign in') ||
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
    if (usernameInput && passwordInput) {
      console.log('\n🔐 Attempting login...');
      
      const usernameSelector = usernameInput.selector || `input[name="${usernameInput.name}"]`;
      const passwordSelector = passwordInput.selector || `input[name="${passwordInput.name}"]`;

      // Wait for username field and fill it
      await targetPage.waitForSelector(usernameSelector, { timeout: 30000 });
      await targetPage.fill(usernameSelector, SERVITRACTOR_CONFIG.loginUsername);
      console.log(`  ✅ Filled username: ${SERVITRACTOR_CONFIG.loginUsername}`);

      await page.waitForTimeout(1000);

      // Find and click "Siguiente" button to proceed to password step
      if (iframeFrame) {
        const siguienteButton = await iframeFrame.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
          const found = buttons.find((btn: any) => {
            const text = btn.textContent?.trim() || btn.value || '';
            return text.toLowerCase().includes('siguiente') || 
                   text.toLowerCase().includes('next') ||
                   text.toLowerCase().includes('continuar');
          });
          if (found) {
            return {
              tagName: found.tagName,
              text: found.textContent?.trim() || (found as HTMLInputElement).value || '',
              id: found.id || '',
              className: found.className || '',
              selector: found.id ? `#${found.id}` : found.className ? `.${found.className.split(' ')[0]}` : '',
            };
          }
          return null;
        });

        if (siguienteButton) {
          console.log(`  ✅ Found "Siguiente" button: ${siguienteButton.selector || siguienteButton.text}`);
          try {
            if (siguienteButton.selector) {
              await iframeFrame.click(siguienteButton.selector);
            } else {
              await iframeFrame.click(`button:has-text("${siguienteButton.text}")`);
            }
            console.log('  ✅ Clicked "Siguiente" button');
            await page.waitForTimeout(2000); // Wait for password field to appear
          } catch (e) {
            console.log('  ⚠️  Could not click "Siguiente" button, trying Enter key');
            await targetPage.press(usernameSelector, 'Enter');
            await page.waitForTimeout(2000);
          }
        } else {
          console.log('  ⚠️  "Siguiente" button not found, trying Enter key');
          await targetPage.press(usernameSelector, 'Enter');
          await page.waitForTimeout(2000);
        }
      }

      // Wait for password field to be visible
      await targetPage.waitForSelector(passwordSelector, { state: 'visible', timeout: 30000 });
      await targetPage.fill(passwordSelector, SERVITRACTOR_CONFIG.loginPassword);
      console.log('  ✅ Filled password: ******');

      await page.waitForTimeout(1000);

      // Find login button in iframe
      if (iframeFrame) {
        const iframeButtons = await iframeFrame.evaluate(() => {
          return Array.from(document.querySelectorAll('button, input[type="submit"]')).map((btn) => ({
            tagName: btn.tagName,
            type: (btn as HTMLInputElement).type || 'button',
            text: btn.textContent?.trim() || '',
            value: (btn as HTMLInputElement).value || '',
            id: btn.id || '',
            className: btn.className || '',
            selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
          }));
        });

        console.log(`\n🔘 Found ${iframeButtons.length} buttons in iframe:`);
        iframeButtons.forEach((btn, i) => {
          console.log(`  ${i + 1}. Tag: ${btn.tagName}, Type: ${btn.type}`);
          console.log(`     Text/Value: "${btn.text || btn.value}"`);
          console.log(`     Selector: ${btn.selector || 'N/A'}`);
        });

        const submitButton = iframeButtons.find((btn) =>
          btn.text?.toLowerCase().includes('iniciar') ||
          btn.text?.toLowerCase().includes('login') ||
          btn.text?.toLowerCase().includes('entrar') ||
          btn.text?.toLowerCase().includes('sign in') ||
          btn.type === 'submit'
        );

        if (submitButton) {
          console.log(`  ✅ Found login button: ${submitButton.selector || submitButton.text}`);
          try {
            if (submitButton.selector) {
              await iframeFrame.click(submitButton.selector);
            } else {
              await iframeFrame.click(`button:has-text("${submitButton.text}")`);
            }
            console.log('  ✅ Clicked login button');
          } catch (e) {
            console.log('  ⚠️  Could not click button, trying Enter key');
            await targetPage.keyboard.press('Enter');
          }
        } else {
          console.log('  ⚠️  No login button found, trying Enter key');
          await targetPage.keyboard.press('Enter');
        }
      } else {
        console.log('  ⚠️  No iframe frame found, trying Enter key');
        await targetPage.keyboard.press('Enter');
      }

      await page.waitForTimeout(5000);
      const urlAfterLogin = page.url();
      console.log(`  📍 URL after login: ${urlAfterLogin}`);
    }

    // Now inspect the search form - wait longer for page to fully load
    console.log('\n🔍 Inspecting search form after login...');
    await page.waitForTimeout(5000); // Wait for page to fully load after login

    // Try multiple times to find search input (page might load dynamically)
    let searchInputFound = false;
    let searchSelector = '';
    let searchInputInfo: any = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`\n  Attempt ${attempt}/5: Looking for search input...`);
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
          input.placeholder?.toLowerCase().includes('reference') ||
          input.id?.toLowerCase().includes('referencia') ||
          input.id?.toLowerCase().includes('search')
      );

      // Find submit buttons
      const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button')).map((btn) => ({
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

      console.log(`  📝 Found ${searchForm.inputs.length} total input fields`);
      if (searchForm.inputs.length > 0) {
        searchForm.inputs.slice(0, 5).forEach((input, i) => {
          console.log(`     ${i + 1}. Type: ${input.type}, Name: "${input.name}", ID: "${input.id}"`);
        });
      }

      if (searchForm.searchInputs.length > 0) {
        console.log(`  ✅ Found ${searchForm.searchInputs.length} search-related inputs!`);
        searchForm.searchInputs.forEach((input, i) => {
          console.log(`     ${i + 1}. Name: "${input.name}", ID: "${input.id}"`);
          console.log(`        Selector: ${input.selector}`);
        });
        searchInputInfo = searchForm.searchInputs[0];
        searchSelector = searchForm.searchInputs[0].selector;
        searchInputFound = true;
        break;
      } else {
        console.log(`  ⚠️  No search inputs found yet (${searchForm.inputs.length} total inputs)`);
        // Check all text inputs as fallback
        const textInputs = searchForm.inputs.filter((input) => 
          (input.type === 'text' || input.type === 'search' || input.type === 'textarea') &&
          !input.id.includes('hidden') &&
          !input.className.includes('hidden')
        );
        if (textInputs.length > 0 && attempt === 5) {
          console.log(`  📋 Using first text input as fallback: ${textInputs[0].id || textInputs[0].name}`);
          searchInputInfo = textInputs[0];
          searchSelector = textInputs[0].selector;
          searchInputFound = true;
        }
      }
    }

    if (!searchInputFound) {
      console.log('\n❌ Could not find search input after 5 attempts');
      console.log('   Saving page HTML for manual inspection...');
    } else {
      console.log(`\n✅ Found search input: ${searchSelector}`);
      console.log(`   ID: ${searchInputInfo.id}, Name: ${searchInputInfo.name}`);
    }

    // Get all buttons and forms for reference
    const allElements = await page.evaluate(() => {
      const submitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]')).map((btn) => ({
        tagName: btn.tagName,
        type: (btn as HTMLInputElement).type || 'button',
        text: btn.textContent?.trim() || '',
        value: (btn as HTMLInputElement).value || '',
        id: btn.id || '',
        className: btn.className || '',
        selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
      }));

      const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
        id: form.id || '',
        name: form.name || '',
        action: form.action || '',
        method: form.method || '',
      }));

      return { submitButtons, forms };
    });

    console.log(`\n🔘 Found ${allElements.submitButtons.length} buttons on page`);
    allElements.submitButtons.slice(0, 5).forEach((btn, i) => {
      console.log(`  ${i + 1}. Tag: ${btn.tagName}, Text: "${btn.text || btn.value}"`);
      console.log(`     Selector: ${btn.selector || 'N/A'}`);
    });

    console.log(`\n📋 Found ${allElements.forms.length} forms on page`);
    allElements.forms.forEach((form, i) => {
      console.log(`  ${i + 1}. Name: "${form.name}", ID: "${form.id}"`);
      console.log(`     Method: ${form.method}, Action: ${form.action || 'N/A'}`);
    });

    // Try to fill and submit search if we found the input
    // For Select2, we need to click the container first, then fill the search input
    if (searchInputFound && searchSelector) {
      console.log('\n🧪 Testing search input...');
      
      try {
        // If it's a Select2 input, click the container first to open it
        if (searchSelector.includes('s2id_autogen') && searchSelector.includes('_search')) {
          // Get the base ID (without _search)
          const baseId = searchSelector.replace('_search', '').replace('#', '');
          const containerSelector = `#${baseId}`;
          
          console.log(`  🔍 Clicking Select2 container: ${containerSelector}`);
          try {
            await page.click(containerSelector);
            await page.waitForTimeout(1000);
            console.log('  ✅ Opened Select2 dropdown');
          } catch (e) {
            console.log('  ⚠️  Could not click container, trying direct input');
          }
        }
        
        // Wait for the search input to be enabled/visible
        await page.waitForSelector(searchSelector, { state: 'visible', timeout: 30000 }).catch(async () => {
          // If still not visible, try clicking the container again
          if (searchSelector.includes('s2id_autogen')) {
            const baseId = searchSelector.replace('_search', '').replace('#', '');
            await page.click(`#${baseId}`);
            await page.waitForTimeout(1000);
          }
        });
        
        console.log(`  ✅ Search input is available: ${searchSelector}`);
        
        // Clear and fill the input
        await page.fill(searchSelector, '');
        await page.fill(searchSelector, SERVITRACTOR_CONFIG.reference);
        console.log(`  ✅ Filled search input with: ${SERVITRACTOR_CONFIG.reference}`);
        
        await page.waitForTimeout(2000); // Wait for Select2 to process
        
        // Try to find and click the "Buscar" button
        const searchButton = allElements.submitButtons.find((btn) => 
          btn.text?.toLowerCase().includes('buscar') ||
          btn.text?.toLowerCase().includes('search')
        );

        if (searchButton) {
          console.log(`  🔘 Found search button: "${searchButton.text}"`);
          // Try to click using text selector since we don't have a reliable ID
          try {
            await page.click(`a:has-text("${searchButton.text.split('\n')[0]}")`);
            console.log('  ✅ Clicked search button');
          } catch (e) {
            console.log('  ⚠️  Could not click button by text, trying Enter key');
            await page.keyboard.press('Enter');
          }
        } else {
          console.log('  ⌨️  No search button found, pressing Enter key...');
          await page.keyboard.press('Enter');
        }
        
        await page.waitForTimeout(5000); // Wait for search results
        
        const urlAfterSearch = page.url();
        console.log(`  📍 URL after search: ${urlAfterSearch}`);
        
        // Check if we got results
        const hasResults = await page.evaluate(() => {
          // Look for common result indicators
          const resultIndicators = [
            document.querySelector('table'),
            document.querySelector('.results'),
            document.querySelector('[class*="result"]'),
            document.querySelector('[id*="result"]'),
            document.querySelector('main'),
            document.querySelector('.content'),
            document.querySelector('[class*="table"]'),
            document.querySelector('tbody'),
          ];
          return resultIndicators.some(el => el !== null);
        });
        
        if (hasResults) {
          console.log('  ✅ Search results detected on page');
          
          // Try to count results
          const resultCount = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            const rows = Array.from(tables).flatMap(table => 
              Array.from(table.querySelectorAll('tbody tr, tr'))
            );
            return rows.length;
          });
          console.log(`  📊 Found approximately ${resultCount} result rows`);
        } else {
          console.log('  ⚠️  No obvious search results detected, but page loaded');
        }
        
      } catch (e: any) {
        console.log(`  ❌ Error during search: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
      }
    }

    // Also check for Select2 inputs (common in Zoho) as alternative
    console.log('\n🔍 Checking for Select2 inputs...');
    const select2Inputs = await page.evaluate(() => {
      // Find Select2 containers
      const select2Containers = Array.from(document.querySelectorAll('.select2-container, [class*="select2"]'));
      const inputs = [];
      
      select2Containers.forEach((container) => {
        const input = container.querySelector('input[type="text"], input[type="search"]');
        if (input) {
          inputs.push({
            id: input.id || '',
            name: (input as HTMLInputElement).name || '',
            placeholder: input.placeholder || '',
            className: input.className || '',
            containerClass: container.className || '',
            selector: input.id ? `#${input.id}` : '',
          });
        }
      });
      
      // Also check for regular search inputs
      const regularInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"]')).map((input) => ({
        id: input.id || '',
        name: (input as HTMLInputElement).name || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : '',
      }));
      
      return { select2Inputs: inputs, regularInputs };
    });

    console.log(`\n🔍 Found ${select2Inputs.select2Inputs.length} Select2 inputs:`);
    select2Inputs.select2Inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. ID: "${input.id}", Placeholder: "${input.placeholder}"`);
      console.log(`     Selector: ${input.selector || 'N/A'}`);
    });

    console.log(`\n🔍 Found ${select2Inputs.regularInputs.length} regular inputs:`);
    select2Inputs.regularInputs.forEach((input, i) => {
      console.log(`  ${i + 1}. ID: "${input.id}", Name: "${input.name}"`);
      console.log(`     Placeholder: "${input.placeholder}"`);
      console.log(`     Selector: ${input.selector || 'N/A'}`);
    });

    if (select2Inputs.select2Inputs.length > 0) {
      console.log(`  ✅ Found ${select2Inputs.select2Inputs.length} Select2 inputs`);
      select2Inputs.select2Inputs.forEach((input, i) => {
        console.log(`     ${i + 1}. ID: "${input.id}", Placeholder: "${input.placeholder}"`);
      });
    } else {
      console.log('  ℹ️  No Select2 inputs found');
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
    const htmlPath = path.join(debugDir, `servitractor-inspection-${timestamp}.html`);
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

inspectServitractor().catch(console.error);

