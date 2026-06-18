/**
 * Retrotrac login and search steps
 * Angular-based application
 */

export const retrotracLoginSteps = [
    // === LOGIN PORTION ===
    {
        type: 'goto',
        url: 'https://tiendab2b.retrotrac.com/login',
        options: { waitUntil: 'domcontentloaded', timeout: 60000 }
    },
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for page to stabilize and dynamic content to load
    },
    // Log HTML when retrotrac page first opens
    {
        type: 'log-html',
        options: { filename: 'retrotrac-initial-page.html' }
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
        selector: '#password',
        options: { timeout: 30000 } // Wait for password input to appear
    },
    {
        type: 'fill',
        selector: '#password',
        value: '{{password}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay before clicking
    },
    {
        type: 'click',
        selector: 'button:has-text("Ingresar")',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for login validation message to appear
    },
    // Wait for navigation to home page after successful login
    // RETROTRAC redirects to /home after successful login
    {
        type: 'wait',
        selector: 'main',
        options: { timeout: 30000 } // Wait for main content to load on home page
    },
    {
        type: 'wait',
        options: { timeout: 2000 } // Additional wait for Angular to fully render home page
    },
    {
        type: 'log-html',
        options: { filename: 'retrotrac-after-login.html' }
    }
];

export const retrotracSearchSteps = [
    // === SEARCH PORTION ===
    // Navigate directly to the search results URL with the reference
    {
        type: 'goto',
        url: 'https://tiendab2b.retrotrac.com/categories-search/{{reference}}/products',
        options: { waitUntil: 'domcontentloaded', timeout: 60000 }
    },
    {
        type: 'wait',
        options: { timeout: 2000 } // Wait for initial page load
    },
    // Wait for the actual product elements to appear (Angular renders them dynamically)
    // Verified via browser testing: md-card.cards-same is the correct selector
    {
        type: 'wait',
        selector: 'md-card.cards-same',
        options: { timeout: 20000 } // Wait for product elements to be rendered by Angular
    },
    {
        type: 'wait',
        options: { timeout: 3000 } // Additional wait for Angular to fully render all content, images, and any lazy-loaded elements
    },
    {
        type: 'log-html',
        options: { filename: 'retrotrac-search-results-{{reference}}.html' }
    }
];

// Combined login and search steps
export const retrotracCombinedSteps = [
    ...retrotracLoginSteps,
    ...retrotracSearchSteps,
];

