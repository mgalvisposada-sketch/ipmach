/**
 * PARTEQUIPOS automation steps
 * Website: https://tienda.partequipos.com
 * 
 * Login credentials:
 * - Username: a.galvis@ciparcol.com
 * - Password: cip800145360*
 * 
 * Flow:
 * 1. Navigate to login page
 * 2. Fill email and password
 * 3. Click login button
 * 4. Navigate to search URL with reference
 * 5. Extract search results
 */

export const partequiposLoginSteps = [
  // === LOGIN PORTION ===
  {
    type: 'goto',
    url: 'https://tienda.partequipos.com/customer/account',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 5000 } // Wait for page to stabilize and cookie dialog to appear
  },
  // Handle cookie consent dialog if present
  {
    type: 'evaluate',
    script: `
      (function() {
        // Check for and close cookie consent dialog
        const buttons = Array.from(document.querySelectorAll('button'));
        const cookieButton = buttons.find(btn => {
          const text = (btn.textContent || btn.innerText || '').toLowerCase();
          return text.includes('permitir cookies') || 
                 text.includes('allow cookies') ||
                 text.includes('accept cookies') ||
                 btn.getAttribute('aria-label')?.toLowerCase().includes('cookie');
        });
        
        if (cookieButton) {
          cookieButton.click();
          return { cookieDialogClosed: true };
        }
        return { cookieDialogClosed: false, cookieDialogFound: false };
      })();
    `,
    options: { timeout: 5000 }
  },
  {
    type: 'wait',
    options: { timeout: 2000 } // Wait after closing cookie dialog
  },
  {
    type: 'wait',
    selector: '#email',
    options: { timeout: 30000 } // Wait for email input to appear
  },
  {
    type: 'fill',
    selector: '#email',
    value: '{{username}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 } // Small delay between fields
  },
  {
    type: 'wait',
    selector: '#pass',
    options: { timeout: 30000 } // Wait for password input to appear
  },
  {
    type: 'fill',
    selector: '#pass',
    value: '{{password}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 } // Small delay before clicking
  },
  // Try multiple selectors for login button (Magento may have multiple buttons with same ID)
  {
    type: 'click',
    selector: '#send2, button.action.login.primary, button[type="submit"].action.login, form#login-form button[type="submit"]',
    options: { timeout: 30000, waitUntil: 'networkidle' }
  },
  {
    type: 'wait',
    options: { timeout: 5000 } // Wait for login to complete and page to redirect
  },
  {
    type: 'log-html',
    options: { filename: 'partequipos-after-login.html' }
  }
];

export const partequiposSearchSteps = [
  // === SEARCH PORTION ===
  // Navigate directly to the search results URL with the reference
  {
    type: 'goto',
    url: 'https://tienda.partequipos.com/catalogsearch/result/?q={{reference}}',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 3000 } // Wait for page to load
  },
  // Wait for product results to appear (Magento structure)
  {
    type: 'wait',
    selector: '.products-list .product-item, .products-grid .product-item, li.product-item',
    options: { timeout: 30000 } // Wait for product elements to be rendered
  },
  {
    type: 'wait',
    options: { timeout: 2000 } // Additional wait for content to fully load
  },
  {
    type: 'log-html',
    options: { filename: 'partequipos-search-results-{{reference}}.html' }
  }
];

// Combined login and search steps
export const partequiposCombinedSteps = [
  ...partequiposLoginSteps,
  ...partequiposSearchSteps,
];
