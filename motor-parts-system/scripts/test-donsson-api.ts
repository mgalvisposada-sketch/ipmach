import 'dotenv/config';

/**
 * Test script to verify DONSSON API endpoint
 * Tests the /api/search/deep-web/DONSSON endpoint with two different references
 */

const DEEP_SEARCH_SERVICE_URL = process.env.DEEP_SEARCH_SERVICE_URL || 'http://localhost:3001';
const DEEP_SEARCH_SERVICE_API_KEY = process.env.DEEP_SEARCH_SERVICE_API_KEY || 'test-api-key-12345';

// Test references - can be modified
const TEST_REFERENCES = ['GX2518', 'GS782'];

async function performSearch(reference: string, searchNumber: number, totalSearches: number) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 SEARCH ${searchNumber} of ${totalSearches}: ${reference}`);
    console.log(`${'='.repeat(60)}\n`);

    const payload = {
        reference: reference,
        originCode: 'DONSSON',
        url: 'https://www.donsson.com/web#menu_id=114',
        method: 'GET',
        requiresLogin: true,
        loginUrl: 'https://www.donsson.com/web#menu_id=114',
        loginUsername: 'a.galvis@ciparcol.com',
        loginPassword: '8001453601',
        loginSteps: [
            // === STEP 1: Navigate to auth check URL ===
            {
                type: 'goto',
                url: 'https://www.donsson.com/web#menu_id=114',
                options: { waitUntil: 'domcontentloaded', timeout: 60000 }
            },
            {
                type: 'wait',
                options: { timeout: 3000 }
            },
            // Log HTML after initial navigation
            {
                type: 'log-html',
                options: { filename: 'donsson-step1-initial-navigation.html' }
            },
            
            // === STEP 2: Check if already logged in ===
            {
                type: 'evaluate',
                script: `
                  (function() {
                    const currentUrl = window.location.href;
                    const pageTitle = document.title;
                    const bodyText = document.body ? document.body.innerText.substring(0, 500) : '';
                    
                    // Check if we're on login page
                    const isLoginPage = currentUrl.includes('/web/login') || currentUrl.includes('/login');
                    
                    // Check for login form elements - try multiple selectors
                    const usernameSelectors = [
                      'input[type="text"][name*="login"]',
                      'input[type="email"]',
                      'input[name*="user"]',
                      'input[id*="login"]',
                      'textbox[aria-label*="Correo"]',
                      'textbox[aria-label*="email"]',
                      'input[placeholder*="correo"]',
                      'input[placeholder*="email"]',
                      'input[placeholder*="usuario"]'
                    ];
                    
                    const passwordSelectors = [
                      'input[type="password"]',
                      'textbox[aria-label*="Contraseña"]',
                      'textbox[aria-label*="password"]',
                      'input[placeholder*="contraseña"]',
                      'input[placeholder*="password"]'
                    ];
                    
                    let usernameField = null;
                    let passwordField = null;
                    
                    for (const selector of usernameSelectors) {
                      usernameField = document.querySelector(selector);
                      if (usernameField) break;
                    }
                    
                    for (const selector of passwordSelectors) {
                      passwordField = document.querySelector(selector);
                      if (passwordField) break;
                    }
                    
                    // Check for login button
                    const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'));
                    const loginButton = allButtons.find(btn => {
                      const text = (btn.textContent || btn.innerText || '').toLowerCase();
                      return text.includes('iniciar sesión') || 
                             text.includes('iniciar sesion') || 
                             text.includes('sign in') || 
                             text.includes('login') ||
                             text.includes('ingresar') ||
                             text.includes('entrar');
                    });
                    
                    // Check for Odoo portal indicators
                    const hasOdooMenu = document.querySelector('nav, [class*="menu"], [id*="menu"]');
                    const hasOdooContent = currentUrl.includes('/web#') || bodyText.includes('Odoo') || pageTitle.includes('Odoo');
                    
                    // Check for shop page access (if we navigate there)
                    const canAccessShop = !isLoginPage && !usernameField && !passwordField;
                    
                    // Capture HTML for debugging (first 5000 characters)
                    const htmlPreview = document.documentElement ? document.documentElement.outerHTML.substring(0, 5000) : '';
                    const bodyHTML = document.body ? document.body.innerHTML.substring(0, 3000) : '';
                    
                    // Detailed authentication result
                    const authResult = {
                      isAuthenticated: false,
                      reason: 'unknown',
                      url: currentUrl,
                      pageTitle: pageTitle,
                      html: {
                        preview: htmlPreview,
                        bodyPreview: bodyHTML,
                        fullLength: document.documentElement ? document.documentElement.outerHTML.length : 0
                      },
                      details: {
                        isLoginPage: isLoginPage,
                        hasUsernameField: !!usernameField,
                        hasPasswordField: !!passwordField,
                        hasLoginButton: !!loginButton,
                        hasOdooMenu: !!hasOdooMenu,
                        hasOdooContent: hasOdooContent,
                        canAccessShop: canAccessShop,
                        usernameFieldSelector: usernameField ? (usernameField.id ? '#' + usernameField.id : usernameField.className ? '.' + usernameField.className.split(' ')[0] : usernameField.tagName) : null,
                        passwordFieldSelector: passwordField ? (passwordField.id ? '#' + passwordField.id : passwordField.className ? '.' + passwordField.className.split(' ')[0] : passwordField.tagName) : null,
                        loginButtonText: loginButton ? (loginButton.textContent || loginButton.innerText || '').trim().substring(0, 50) : null,
                        bodyTextPreview: bodyText.substring(0, 200)
                      }
                    };
                    
                    // Determine authentication status
                    if (isLoginPage) {
                      authResult.isAuthenticated = false;
                      authResult.reason = 'on_login_page';
                    } else if (usernameField || passwordField || loginButton) {
                      authResult.isAuthenticated = false;
                      authResult.reason = 'login_form_found';
                    } else if (hasOdooContent && canAccessShop) {
                      authResult.isAuthenticated = true;
                      authResult.reason = 'on_odoo_portal_no_login_form';
                    } else {
                      authResult.isAuthenticated = false;
                      authResult.reason = 'unknown_status';
                    }
                    
                    return authResult;
                  })();
                `
            },
            // Log HTML after authentication check
            {
                type: 'log-html',
                options: { filename: 'donsson-step2-auth-check.html' }
            },
            
            // === STEP 3: Check if login elements exist ===
            // If email input is not found, skip all login steps and go to search
            {
                type: 'evaluate',
                script: `
                  (function() {
                    // Check for email/username input field
                    const emailInput = document.querySelector('textbox[aria-label="Correo electrónico"], input[type="email"], input[name*="login"], input[id*="login"]');
                    const passwordInput = document.querySelector('textbox[aria-label="Contraseña"], input[type="password"]');
                    const loginButton = document.querySelector('button[type="submit"]');
                    
                    const hasLoginForm = !!(emailInput || passwordInput || loginButton);
                    
                    return {
                      hasLoginForm: hasLoginForm,
                      hasEmailInput: !!emailInput,
                      hasPasswordInput: !!passwordInput,
                      hasLoginButton: !!loginButton,
                      emailSelector: emailInput ? (emailInput.id ? '#' + emailInput.id : 'textbox[aria-label="Correo electrónico"], input[type="email"]') : null,
                      shouldSkipLogin: !hasLoginForm
                    };
                  })();
                `
            },
            
            // === STEP 4: Fill username/email ===
            // ⚠️ This step will be skipped if email input is not found (already logged in)
            {
                type: 'wait',
                selector: 'textbox[aria-label="Correo electrónico"], input[type="email"]',
                options: { timeout: 5000 } // Short timeout - if not found, skip login
            },
            {
                type: 'fill',
                selector: 'textbox[aria-label="Correo electrónico"], input[type="email"]',
                value: '{{username}}',
                options: { timeout: 30000 }
            },
            {
                type: 'wait',
                options: { timeout: 1000 }
            },
            
            // === STEP 5: Fill password ===
            {
                type: 'wait',
                selector: 'textbox[aria-label="Contraseña"], input[type="password"]',
                options: { timeout: 30000 }
            },
            {
                type: 'fill',
                selector: 'textbox[aria-label="Contraseña"], input[type="password"]',
                value: '{{password}}',
                options: { timeout: 30000 }
            },
            {
                type: 'wait',
                options: { timeout: 1000 }
            },
            
            // === STEP 6: Click Login button ===
            {
                type: 'click',
                selector: 'button[type="submit"]',
                options: { timeout: 30000 }
            },
            {
                type: 'wait',
                options: { timeout: 5000 }
            },
            // Log HTML after login
            {
                type: 'log-html',
                options: { filename: 'donsson-step6-after-login.html' }
            },
            
            // === STEP 7: Navigate to shop page ===
            {
                type: 'goto',
                url: 'https://www.donsson.com/shop',
                options: { waitUntil: 'domcontentloaded', timeout: 60000 }
            },
            {
                type: 'wait',
                options: { timeout: 3000 }
            },
            // Log HTML after navigating to shop page
            {
                type: 'log-html',
                options: { filename: 'donsson-step7-shop-page.html' }
            },
            
            // === STEP 8: Wait for search input ===
            {
                type: 'wait',
                selector: '#s2id_autogen1_search, input.select2-input, combobox[expanded] input, input[role="combobox"]',
                options: { timeout: 30000 }
            },
            
            // === STEP 9: Fill search input with reference ===
            {
                type: 'fill',
                selector: '#s2id_autogen1_search, input.select2-input, combobox[expanded] input',
                value: '{{reference}}',
                options: { timeout: 30000 }
            },
            {
                type: 'wait',
                options: { timeout: 2000 }
            },
            // Log HTML after filling search input
            {
                type: 'log-html',
                options: { filename: 'donsson-step9-after-fill-search.html' }
            },
            
            // === STEP 10: Press Enter to submit search ===
            {
                type: 'press',
                selector: '#s2id_autogen1_search, input.select2-input',
                options: { 
                    key: 'Enter',
                    timeout: 30000 
                }
            },
            {
                type: 'wait',
                options: { timeout: 10000 } // Wait for search results to load (increased from 5000ms)
            },
            
            // === STEP 11: Log final search results HTML ===
            {
                type: 'log-html',
                options: { filename: 'donsson-step10-final-search-results.html' }
            }
        ],
        waitForSelector: '[class*="product"], [class*="item"], .product-item, .product-card',
        parserConfig: {
            type: 'html',
        },
        timeoutMs: 120000,
        retryAttempts: 1,
    };

    try {
        console.log(`📡 Sending request to ${DEEP_SEARCH_SERVICE_URL}/search...`);
        console.log(`   Reference: ${reference}`);
        console.log(`   Origin: DONSSON`);

        const startTime = Date.now();
        const response = await fetch(`${DEEP_SEARCH_SERVICE_URL}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEP_SEARCH_SERVICE_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const data = await response.json();

        if (!response.ok) {
            console.error(`\n❌ Request failed:`);
            console.error(`   Status: ${response.status}`);
            console.error(`   Elapsed Time: ${elapsedTime}s`);
            console.error(`   Error:`, data);
            return { success: false, reference, error: data };
        }

        console.log(`\n✅ Request successful! (${elapsedTime}s)`);
        console.log(`📊 Results:`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Product Count: ${data.productCount || 0}`);
        console.log(`   Products Found: ${data.products?.length || 0}`);
        
        if (data.products && data.products.length > 0) {
            console.log(`\n📦 Products:`);
            data.products.forEach((product: any, index: number) => {
                console.log(`\n   Product ${index + 1}:`);
                console.log(`      Reference: ${product.reference || 'N/A'}`);
                console.log(`      Description: ${product.description || 'N/A'}`);
                console.log(`      Price: ${product.price ? `$${product.price}` : 'N/A'}`);
                console.log(`      Stock: ${product.stock || 'N/A'}`);
                console.log(`      Has Stock: ${product.hasStock ? 'Yes' : 'No'}`);
                if (product.link) {
                    console.log(`      Link: ${product.link}`);
                }
                if (product.brand) {
                    console.log(`      Brand: ${product.brand}`);
                }
            });
        } else {
            console.log(`\n⚠️  No products found for reference "${reference}"`);
        }

        if (data.error) {
            console.log(`\n⚠️  Warning: ${data.error}`);
        }

        return { success: true, reference, data, elapsedTime: parseFloat(elapsedTime) };
    } catch (error: any) {
        console.error(`\n❌ Error testing API:`);
        console.error(`   ${error.message}`);
        if (error.cause) {
            console.error(`   Cause:`, error.cause);
        }
        return { success: false, reference, error: error.message };
    }
}

async function testDonssonAPI() {
    console.log('🧪 Testing DONSSON API endpoint with multiple searches...\n');
    console.log(`Service URL: ${DEEP_SEARCH_SERVICE_URL}`);
    console.log(`API Key: ${DEEP_SEARCH_SERVICE_API_KEY ? 'Set (***)' : 'NOT SET'}`);
    console.log(`Test References: ${TEST_REFERENCES.join(', ')}\n`);

    const results: Array<{ success: boolean; reference: string; data?: any; elapsedTime?: number; error?: any }> = [];

    // Perform each search sequentially
    for (let i = 0; i < TEST_REFERENCES.length; i++) {
        const reference = TEST_REFERENCES[i];
        const result = await performSearch(reference, i + 1, TEST_REFERENCES.length);
        results.push(result);
        
        // Add a small delay between searches to avoid overwhelming the service
        if (i < TEST_REFERENCES.length - 1) {
            console.log(`\n⏳ Waiting 2 seconds before next search...\n`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 SUMMARY`);
    console.log(`${'='.repeat(60)}\n`);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTime = results.reduce((sum, r) => sum + (r.elapsedTime || 0), 0);
    const totalProducts = results.reduce((sum, r) => sum + (r.data?.products?.length || 0), 0);

    console.log(`Total Searches: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`📦 Total Products Found: ${totalProducts}\n`);

    results.forEach((result, index) => {
        console.log(`Search ${index + 1} (${result.reference}):`);
        if (result.success) {
            console.log(`   ✅ Success - ${result.data?.products?.length || 0} products (${result.elapsedTime?.toFixed(2)}s)`);
        } else {
            console.log(`   ❌ Failed - ${result.error || 'Unknown error'}`);
        }
    });
}

testDonssonAPI()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });

