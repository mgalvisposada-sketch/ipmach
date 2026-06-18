/**
 * DONSSON automation steps
 * Website: https://www.donsson.com
 * 
 * Login credentials:
 * - Username: a.galvis@ciparcol.com
 * - Password: 8001453601
 * 
 * Flow:
 * 1. Navigate to auth check URL
 * 2. Login if needed
 * 3. Navigate to shop page
 * 4. Fill search input with reference
 * 5. Press Enter to submit search
 * 6. Extract search results
 */

export const donssonCombinedSteps = [
  // === STEP 1: Navigate to shop page ===
  {
    type: 'goto',
    url: 'https://www.donsson.com/shop',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 3000 } // Wait for page to load
  },
  // Log HTML after initial navigation
  {
    type: 'log-html',
    options: { filename: 'donsson-step1-initial-navigation.html' }
  },
  
  // === STEP 2: Check if already logged in ===
  // ✅ Use evaluate to check authentication status before attempting login
  // This step verifies if we're already authenticated by checking:
  // 1. If we're on login page (redirected to /web/login)
  // 2. If login link exists on shop page (indicates need to login)
  // 3. If login form elements exist (username/password fields, login button)
  // 4. If we can access the shop page with search input (indicates authentication)
  {
    type: 'evaluate',
    script: `
      (function() {
        const currentUrl = window.location.href;
        const pageTitle = document.title;
        const bodyText = document.body ? document.body.innerText.substring(0, 500) : '';
        
        // Check if we're on login page
        const isLoginPage = currentUrl.includes('/web/login') || currentUrl.includes('/login');
        
        // Check for login link on shop page (indicates we need to login)
        const loginLinks = Array.from(document.querySelectorAll('a[href*="/web/login"]'));
        let loginLink = null;
        let loginText = null;
        
        for (const link of loginLinks) {
          const text = link.textContent?.trim() || '';
          if (text.toLowerCase().includes('sign in') || 
              text.toLowerCase().includes('iniciar sesión') || 
              text.toLowerCase().includes('iniciar sesion') ||
              text.toLowerCase().includes('login')) {
            loginLink = link;
            loginText = text;
            break;
          }
        }
        
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
        
        // Check for search input on shop page (indicates we're logged in)
        const searchInput = document.querySelector('#s2id_autogen1_search, input.select2-input, input[role="combobox"]');
        
        // Check for Odoo portal indicators
        const hasOdooMenu = document.querySelector('nav, [class*="menu"], [id*="menu"]');
        const hasOdooContent = currentUrl.includes('/web#') || bodyText.includes('Odoo') || pageTitle.includes('Odoo');
        
        // Check for shop page access (if we navigate there)
        const canAccessShop = !isLoginPage && !usernameField && !passwordField && !loginLink;
        
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
            hasLoginLink: !!loginLink,
            loginLinkText: loginText,
            hasUsernameField: !!usernameField,
            hasPasswordField: !!passwordField,
            hasLoginButton: !!loginButton,
            hasSearchInput: !!searchInput,
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
        } else if (loginLink) {
          // Login link found on shop page - need to login
          authResult.isAuthenticated = false;
          authResult.reason = 'login_link_found';
        } else if (usernameField || passwordField || loginButton) {
          authResult.isAuthenticated = false;
          authResult.reason = 'login_form_found';
        } else if (currentUrl.includes('/shop') && searchInput && !loginLink) {
          // On shop page with search input and no login link - authenticated
          authResult.isAuthenticated = true;
          authResult.reason = 'shop_page_accessible_with_search';
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
  
  // === STEP 3: Check if login is needed ===
  // If we're redirected to login page or see login form, proceed with login
  {
    type: 'wait',
    selector: 'input[type="password"], textbox[aria-label="Contraseña"], input[type="email"], textbox[aria-label="Correo electrónico"], button[type="submit"]',
    options: { timeout: 10000 } // Short timeout - if not found, we might already be logged in
  },
  
  // === STEP 4: Fill username/email ===
  {
    type: 'wait',
    selector: 'textbox[aria-label="Correo electrónico"], input[type="email"]',
    options: { timeout: 30000 }
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
    options: { timeout: 5000 } // Wait for login to complete and redirect
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
    options: { timeout: 3000 } // Wait for shop page to load
  },
  // Log HTML after navigating to shop page
  {
    type: 'log-html',
    options: { filename: 'donsson-step7-shop-page.html' }
  },
  
  // === STEP 8: Wait for search input ===
  // ✅ VERIFIED: Search input is Select2 with id s2id_autogen1_search
  // The input is accessible directly - no need to click "Buscar..." first
  {
    type: 'wait',
    selector: '#s2id_autogen1_search, input.select2-input, combobox[expanded] input, input[role="combobox"]',
    options: { timeout: 30000 }
  },
  
  // === STEP 9: Fill search input with reference ===
  // ✅ VERIFIED: Can fill directly into #s2id_autogen1_search
  {
    type: 'fill',
    selector: '#s2id_autogen1_search, input.select2-input, combobox[expanded] input',
    value: '{{reference}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 2000 } // Wait for Select2 dropdown to show results
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
    options: { timeout: 5000 } // Wait for search results to load
  },
  
  // === STEP 11: Log final search results HTML ===
  {
    type: 'log-html',
    options: { filename: 'donsson-step10-final-search-results.html' }
  }
];

