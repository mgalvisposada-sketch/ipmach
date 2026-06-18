/**
 * AgroCosta login and search steps
 * PHP-based application with form-based authentication
 * 
 * Flow:
 * 1. Navigate to consulta_inventario.php (redirects to login.php if not logged in)
 * 2. Fill username and password
 * 3. Click login button
 * 4. Wait for redirect back to consulta_inventario.php
 * 5. Fill reference in search input
 * 6. Press Enter (form submits, page updates with results)
 */

export const agrocostaLoginSteps = [
    // === LOGIN PORTION ===
    // Navigate to consulta_inventario.php - it will redirect to login.php if not logged in
    {
        type: 'goto',
        url: 'https://agro-costa.com/consulta/consulta_inventario.php',
        options: { waitUntil: 'domcontentloaded', timeout: 60000 }
    },
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for page to load and potential redirect
    },
    // Wait for login form - check if we're on login page
    {
        type: 'wait',
        selector: 'input[name="usuario"], form#formulario',
        options: { timeout: 30000 } // Wait for login form to appear (if redirect happened)
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Additional wait to ensure form is fully loaded
    },
    // Fill username
    {
        type: 'fill',
        selector: 'input[name="usuario"]',
        value: '{{username}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay between fields
    },
    // Fill password
    {
        type: 'fill',
        selector: 'input[name="contraseña"]',
        value: '{{password}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay before clicking
    },
    // Click login button
    {
        type: 'click',
        selector: 'button[name="login"]',
        options: { timeout: 30000, waitUntil: 'domcontentloaded' } // Wait for redirect back to consulta_inventario.php
    },
    {
        type: 'wait',
        options: { timeout: 3000 } // Wait for login to complete and page to redirect
    },
    {
        type: 'log-html',
        options: { filename: 'agrocosta-after-login.html' }
    }
];

export const agrocostaSearchSteps = [
    // === SEARCH PORTION ===
    // Wait for search input to appear (on consulta_inventario.php after login)
    // Note: #referencia is a radio button, we need the text input with name="referencia"
    {
        type: 'wait',
        selector: 'input[name="referencia"][type="text"], input[name="referencia"]:not([type="radio"])',
        options: { timeout: 30000 } // Wait for search input to appear
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Additional wait to ensure input is ready
    },
    // Fill reference
    {
        type: 'fill',
        selector: 'input[name="referencia"][type="text"], input[name="referencia"]:not([type="radio"])',
        value: '{{reference}}',
        options: { timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small delay before pressing Enter
    },
    // Press Enter to submit search (form submits, page updates with results - no navigation)
    {
        type: 'press',
        selector: 'input[name="referencia"][type="text"], input[name="referencia"]:not([type="radio"])',
        options: { key: 'Enter', timeout: 30000 }
    },
    {
        type: 'wait',
        options: { timeout: 1000 } // Small wait for form submission to start
    },
    // Log HTML immediately after pressing Enter to see page state
    {
        type: 'log-html',
        options: { filename: 'agrocosta-after-press-{{reference}}.html' }
    },
    // Wait for results table to appear
    {
        type: 'wait',
        selector: 'table#tablaPrincipal, table.modern-table',
        options: { timeout: 30000 } // Wait for results table to be rendered
    },
    {
        type: 'wait',
        options: { timeout: 2000 } // Additional wait for table content to fully load
    },
    {
        type: 'log-html',
        options: { filename: 'agrocosta-search-results-{{reference}}.html' }
    }
];

// Combined login and search steps
export const agrocostaCombinedSteps = [
    ...agrocostaLoginSteps,
    ...agrocostaSearchSteps,
];


