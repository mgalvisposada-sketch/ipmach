/**
 * Servitractor login and search steps
 * Zoho Creator Portal with iframe-based authentication
 */

export const servitractorLoginSteps = [
    // === LOGIN PORTION ===
    {
        type: 'goto',
        url: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio',
        options: { waitUntil: 'domcontentloaded', timeout: 60000 }
    },
    {
        type: 'wait',
        options: { timeout: 5000 } // Wait for Zoho page and iframe to load
    },
    // Log HTML when servitractor page first opens
    {
        type: 'log-html',
        options: { filename: 'servitractor-initial-page.html' }
    },
    {
        type: 'wait',
        selector: 'iframe[name="zohoiam"]',
        options: { timeout: 30000 } // Wait for login iframe to appear
    },
    {
        type: 'wait',
        selector: 'iframe[name="zohoiam"] >>> #login_id',
        options: { timeout: 30000 } // Wait for email input in iframe
    },
    {
        type: 'fill',
        selector: 'iframe[name="zohoiam"] >>> #login_id',
        value: '{{username}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay before clicking Siguiente
    },
    {
        type: 'click',
        selector: 'iframe[name="zohoiam"] >>> #nextbtn',
        options: { timeout: 30000 } // Click "Siguiente" button to proceed to password
    },
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for iframe to reload and password field to appear
    },
    // Re-acquire iframe and wait for password field (iframe content reloads after clicking Siguiente)
    {
        type: 'wait',
        selector: 'iframe[name="zohoiam"]',
        options: { timeout: 30000 } // Wait for iframe to be present again
    },
    {
        type: 'wait',
        options: { timeout: 2000 } // Additional wait for iframe content to load
    },
    {
        type: 'wait',
        selector: 'iframe[name="zohoiam"] >>> #password',
        options: { timeout: 30000 } // Wait for password input to be visible in reloaded iframe
    },
    {
        type: 'fill',
        selector: 'iframe[name="zohoiam"] >>> #password',
        value: '{{password}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay before clicking login
    },
    {
        type: 'click',
        selector: 'iframe[name="zohoiam"] >>> #nextbtn',
        options: { timeout: 30000, waitUntil: 'networkidle' } // Click "Iniciar sesión" button
    },
    {
        type: 'wait',
        options: { timeout: 8000 } // Wait for login to complete and page to redirect (increased for Zoho redirect)
    },
    {
        type: 'log-html',
        options: { filename: 'servitractor-after-login.html' }
    }
];

export const servitractorSearchSteps = [
    // === SEARCH PORTION ===
    // Navigate to the search page after login
    // Note: If already authenticated, this will show the search page directly
    {
        type: 'goto',
        url: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1',
        options: { waitUntil: 'domcontentloaded', timeout: 60000 }
    },
    // Wait for page to fully load - Zoho pages load dynamically
    // Verified via browser testing: Zoho pages need significant time to load after redirect
    {
        type: 'wait',
        options: { timeout: 10000 } // Wait longer for Zoho page to fully render after login redirect
    },
    // Wait for the search form to appear on Inicio1 page
    // The search input is inside form[name="Busqueda"]
    // Verified via browser testing: form loads asynchronously after authentication
    {
        type: 'wait',
        selector: 'form[name="Busqueda"]',
        options: { timeout: 60000 } // Wait up to 60 seconds for dynamically loaded search form
    },
    // Additional wait after form appears to ensure input is ready
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for form content to fully render
    },
    // Wait for the search input field specifically
    // Verified via browser testing: #zc-Busqueda is the correct selector when authenticated
    {
        type: 'wait',
        selector: '#zc-Busqueda, input[name="Busqueda"], form[name="Busqueda"] input[type="text"], form[name="Busqueda"] textbox',
        options: { timeout: 60000 } // Wait for search input to be ready (prioritize ID selector)
    },
    {
        type: 'wait',
        options: { timeout: 2000 } // Additional wait to ensure input is fully ready
    },
    {
        type: 'fill',
        selector: '#zc-Busqueda, input[name="Busqueda"], form[name="Busqueda"] input[type="text"], form[name="Busqueda"] textbox',
        value: '{{reference}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay before clicking search button
    },
    // Click the "Buscar" button (more reliable than Enter key for Zoho forms)
    // The button is inside the Busqueda form
    {
        type: 'click',
        selector: 'form[name="Busqueda"] button, form[name="Busqueda"] button[type="submit"]',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 5000 } // Wait for search results to load (URL changes to result1)
    },
    // Wait for results page - URL should contain "result1"
    // Check if URL contains "result1" or wait for results content
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for URL to change to result1
    },
    // Wait for results content to appear (product information or "No se encontraron resultados")
    // Results page shows either product tiles or result content with product details
    {
        type: 'wait',
        selector: '[class*="result"], [class*="tile"], .zc-pb-tile-container, .zc-pb-tile-card',
        options: { timeout: 30000 } // Wait for result content to appear
    },
    {
        type: 'log-html',
        options: { filename: 'servitractor-search-results-{{reference}}.html' }
    }
];

// Combined login and search steps
export const servitractorCombinedSteps = [
    ...servitractorLoginSteps,
    ...servitractorSearchSteps,
];

