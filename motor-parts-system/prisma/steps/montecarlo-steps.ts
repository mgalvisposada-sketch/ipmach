/**
 * MONTECARLO automation steps
 * Website: https://portal.imm.com.co
 * 
 * Login credentials:
 * - Username: a.galvis@ciparcol.com
 * - Password: cater2580*
 * 
 * Flow:
 * 1. Navigate to auth check URL
 * 2. Login if needed
 * 3. Navigate to shop page
 * 4. Fill search input with reference
 * 5. Press Enter to submit search
 * 6. Extract search results
 */
export const montecarloCombinedSteps = [
  // === STEP 1: Navigate to shop page (auth check happens in handler) ===
  // Handler checks authentication by navigating to /shop and looking for login button
  // If login button found, we need to login
  {
    type: 'goto',
    url: 'https://portal.imm.com.co/shop',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 3000 } // Wait for page to load
  },
  
  // === STEP 2: Navigate to login page (click login button or go directly) ===
  // If login button is present, navigate to login page
  {
    type: 'goto',
    url: 'https://portal.imm.com.co/web/login',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 2000 } // Wait for login page to load
  },
  
  // === STEP 3: Wait for and fill username/email ===
  // Email field: input[name="login"] or input#login (type="text", not email)
  {
    type: 'wait',
    selector: 'input[name="login"], input#login, input[type="text"]',
    options: { timeout: 30000 }
  },
  {
    type: 'fill',
    selector: 'input[name="login"], input#login, input[type="text"]',
    value: '{{username}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 }
  },
  
  // === STEP 4: Fill password ===
  {
    type: 'wait',
    selector: 'input[type="password"]',
    options: { timeout: 30000 }
  },
  {
    type: 'fill',
    selector: 'input[type="password"]',
    value: '{{password}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 }
  },
  
  // === STEP 5: Click Login button ===
  // Login button is button[type="submit"] (text is empty but it's a submit button)
  {
    type: 'click',
    selector: 'button[type="submit"]',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 5000 } // Wait for login to complete and redirect
  },
  
  // === STEP 6: Navigate to shop page after login ===
  {
    type: 'goto',
    url: 'https://portal.imm.com.co/shop',
    options: { waitUntil: 'domcontentloaded', timeout: 60000 }
  },
  {
    type: 'wait',
    options: { timeout: 3000 } // Wait for shop page to load
  },
  
  // === STEP 7: Wait for search input ===
  // Search input: input[type="search"][name="search"] with class "search-query"
  {
    type: 'wait',
    selector: 'input[type="search"][name="search"], input.search-query, input.oe_search_box, input[placeholder="Buscar..."]',
    options: { timeout: 30000 }
  },
  
  // === STEP 8: Fill search input with reference ===
  {
    type: 'fill',
    selector: 'input[type="search"][name="search"], input.search-query, input.oe_search_box',
    value: '{{reference}}',
    options: { timeout: 30000 }
  },
  {
    type: 'wait',
    options: { timeout: 1000 } // Wait for input to be filled
  },
  
  // === STEP 9: Press Enter to submit search ===
  {
    type: 'press',
    selector: 'input[type="search"][name="search"], input.search-query, input.oe_search_box',
    options: { 
      key: 'Enter',
      timeout: 30000 
    }
  },
  {
    type: 'wait',
    options: { timeout: 5000 } // Wait for search results to load
  }
];

