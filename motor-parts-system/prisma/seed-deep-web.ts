import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
    servitractorCombinedSteps,
    partequiposCombinedSteps,
    retrotracCombinedSteps,
    donssonCombinedSteps,
    montecarloCombinedSteps,
} from './steps';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding DeepWebEndpoint configurations...');

    // Create AgroCosta endpoint
    const agroCosta = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'AGROCOSTA' },
        update: {
            name: 'AgroCosta',
            url: 'https://agro-costa.com/consulta/consulta_inventario.php?tipo_busqueda=referencia&referencia={{reference}}&descripcion=&buscar=',
            method: 'POST',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://agro-costa.com/consulta/login.php',
            loginUsername: 'ciparc',
            loginPassword: 'COL25',
            loginFormSelector: 'form',
            usernameField: 'input[name="usuario"]',
            passwordField: 'input[name="contraseña"]',
            timeoutMs: 40000,
            retryAttempts: 1,
        },
        create: {
            originCode: 'AGROCOSTA',
            name: 'AgroCosta',
            url: 'https://agro-costa.com/consulta/consulta_inventario.php?tipo_busqueda=referencia&referencia={{reference}}&descripcion=&buscar=',
            method: 'POST',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://agro-costa.com/consulta/login.php',
            loginUsername: 'ciparc',
            loginPassword: 'COL25',
            loginFormSelector: 'form',
            usernameField: 'input[name="usuario"]',
            passwordField: 'input[name="contraseña"]',
            timeoutMs: 40000,
            retryAttempts: 1,
        },
    });

    // Create Gecolsa endpoint (DEACTIVATED)
    const gecolsa = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'GECOLSA' },
        update: {
            name: 'Gecolsa',
            url: 'https://parts.cat.com/es/gecolsa/search?q={{reference}}&p_page=1',
            method: 'GET',
            isActive: true, // DEACTIVATED
            requiresLogin: false,
            timeoutMs: 40000,
            retryAttempts: 1,
        },
        create: {
            originCode: 'GECOLSA',
            name: 'Gecolsa',
            url: 'https://parts.cat.com/es/gecolsa/search?q={{reference}}&p_page=1',
            method: 'GET',
            isActive: false, // DEACTIVATED
            requiresLogin: false,
            timeoutMs: 40000,
            retryAttempts: 1,
        },
    });

    // Create Servitractor endpoint
    // Note: Requires step-by-step login with Zoho authentication
    // Steps are imported from ./steps/servitractor-steps.ts

    const servitractor = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'SERVITRACTOR' },
        update: {
            name: 'Servitractor',
            url: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1', // Base URL only, loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1',
            loginUsername: 'comercial2@ciparcol.com',
            loginPassword: 'Ciparcol2025*',
            loginSteps: servitractorCombinedSteps,
            waitForSelector: '.zc-pb-tile-container, .zc-pb-tile-card', // Wait for Zoho tiles container/cards (directly indicates results are rendered)
            parserConfig: {
                type: 'json',
            },
            timeoutMs: 90000, // Increased timeout to 90 seconds to allow for login + search + results loading
            retryAttempts: 1,
        },
        create: {
            originCode: 'SERVITRACTOR',
            name: 'Servitractor',
            url: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1', // Base URL only, loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1',
            loginUsername: 'comercial2@ciparcol.com',
            loginPassword: 'Ciparcol2025*',
            loginSteps: servitractorCombinedSteps,
            waitForSelector: '.zc-pb-tile-container, .zc-pb-tile-card', // Wait for Zoho tiles container/cards (directly indicates results are rendered)
            parserConfig: {
                type: 'json',
            },
            timeoutMs: 90000, // Increased timeout to 90 seconds to allow for login + search + results loading
            retryAttempts: 1,
        },
    });

    // Create Gran Andina endpoint
    // This endpoint returns a full list, so we cache it and search within it
    // Cookies are stored in parserConfig for this endpoint
    const importadoraGranAndinaCookies = 'wordpress_sec_9087a7c4c883efcb2a4a6a0b10fe55a6=CIPARCOL%7C1762118851%7CGgV4STYJ0ZWk4LL1esJmGsFYJSzCiJ29GxMRWTinfDA%7C77fd4144c6efb7959f38c6105116bef30fc68fc784e346f4fe0634965c402216; lenix_first_visit=%7B%22landing_page%22%3A%22https%3A%2F%2Fimportadoragranandina.com%2F%22%2C%22landing_page_title%22%3A%22Inicio%20-%20IMPORTADORA%20GRAN%20ANDINA%22%2C%22first_visit_time%22%3A1761945981%2C%22initial_referrer%22%3A%22Direct%22%7D; _ga=GA1.1.607556546.1761945983; _gcl_au=1.1.1976477232.1761945983; _ga_699EW7RBPH=GS2.1.s1761945983$o1$g1$t1761946034$j9$l0$h0; wordpress_test_cookie=WP%20Cookie%20check; wordpress_logged_in_9087a7c4c883efcb2a4a6a0b10fe55a6=CIPARCOL%7C1762118851%7CGgV4STYJ0ZWk4LL1esJmGsFYJSzCiJ29GxMRWTinfDA%7C2a384e5067cce98b77c6d5bdba73732227d59d2d478779f8aa823afb5948a70d; _ga_0D3T44WEEZ=GS2.1.s1761945983$o1$g1$t1761946352$j60$l0$h0';

    const importadoraGranAndina = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'IMPORTADORAGRANANDINA' },
        update: {
            name: 'Gran Andina',
            url: 'https://importadoragranandina.com/wp-admin/admin-ajax.php?action=wp_ajax_ninja_tables_public_action&table_id=850&target_action=get-all-data&default_sorting=new_first&skip_rows=0&limit_rows=0&ninja_table_public_nonce=88349ca6b7',
            method: 'GET',
            isActive: true,
            requiresLogin: false,
            parserConfig: {
                cookies: importadoraGranAndinaCookies,
            },
            timeoutMs: 40000,
            retryAttempts: 1,
        },
        create: {
            originCode: 'IMPORTADORAGRANANDINA',
            name: 'Gran Andina',
            url: 'https://importadoragranandina.com/wp-admin/admin-ajax.php?action=wp_ajax_ninja_tables_public_action&table_id=850&target_action=get-all-data&default_sorting=new_first&skip_rows=0&limit_rows=0&ninja_table_public_nonce=88349ca6b7',
            method: 'GET',
            isActive: true,
            requiresLogin: false,
            parserConfig: {
                cookies: importadoraGranAndinaCookies,
            },
            timeoutMs: 40000,
            retryAttempts: 1,
        },
    });

    // Create Partequipos endpoint
    // Requires step-by-step login with Magento authentication
    // Steps are imported from ./steps/partequipos-steps.ts

    const partequipos = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'PARTEQUIPOS' },
        update: {
            name: 'Partequipos',
            url: 'https://tienda.partequipos.com/', // Base URL only, loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://tienda.partequipos.com/customer/account/',
            loginUsername: 'a.galvis@ciparcol.com',
            loginPassword: 'cip800145360*',
            loginSteps: partequiposCombinedSteps,
            waitForSelector: '.search.results, .products-grid, .products-list, .category-products, main', // Wait for search results page to load
            parserConfig: {},
            timeoutMs: 40000,
            retryAttempts: 1,
        },
        create: {
            originCode: 'PARTEQUIPOS',
            name: 'Partequipos',
            url: 'https://tienda.partequipos.com/', // Base URL only, loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://tienda.partequipos.com/customer/account/',
            loginUsername: 'a.galvis@ciparcol.com',
            loginPassword: 'cip800145360*',
            loginSteps: partequiposCombinedSteps,
            waitForSelector: '.search.results, .products-grid, .products-list, .category-products, main', // Wait for search results page to load
            parserConfig: {},
            timeoutMs: 40000,
            retryAttempts: 1,
        },
    });

    // Create Retrotrac endpoint
    // Login steps handle authentication
    // Search steps handle the search after login
    // Steps are imported from ./steps/retrotrac-steps.ts

    const retrotrac = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'RETROTRAC' },
        update: {
            name: 'Retrotrac',
            url: 'https://tiendab2b.retrotrac.com/home', // Base URL (home page after login), loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://tiendab2b.retrotrac.com/login',
            loginUsername: 'comercial3@ciparcol.com',
            loginPassword: 'CIPARCOL4',
            loginSteps: retrotracCombinedSteps,
            waitForSelector: 'main, .products, [class*="product"]', // Wait for search results page to load
            parserConfig: {
                type: 'html',
            },
            timeoutMs: 120000, // Increased to 120 seconds for Retrotrac automation (with 30s buffer = 150s total)
            retryAttempts: 1,
        },
        create: {
            originCode: 'RETROTRAC',
            name: 'Retrotrac',
            url: 'https://tiendab2b.retrotrac.com/home', // Base URL (home page after login), loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://tiendab2b.retrotrac.com/login',
            loginUsername: 'comercial3@ciparcol.com',
            loginPassword: 'CIPARCOL4',
            loginSteps: retrotracCombinedSteps,
            waitForSelector: 'main, .products, [class*="product"]', // Wait for search results page to load
            parserConfig: {
                type: 'html',
            },
            timeoutMs: 120000, // Increased to 120 seconds for Retrotrac automation (with 30s buffer = 150s total)
            retryAttempts: 1,
        },
    });

    // Create DONSSON endpoint
    // Requires step-by-step login with Odoo authentication
    // Steps are imported from ./steps/donsson-steps.ts

    const donsson = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'DONSSON' },
        update: {
            name: 'Donsson',
            url: 'https://www.donsson.com/shop', // Start at shop page, check for login link
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://www.donsson.com/shop',
            loginUsername: 'a.galvis@ciparcol.com',
            loginPassword: '8001453601',
            loginSteps: donssonCombinedSteps,
            waitForSelector: '[class*="product"], [class*="item"], div:has(> h4), div:has(> h5)', // Wait for product elements
            parserConfig: {
                type: 'html',
            },
            timeoutMs: 120000, // Increased timeout to 120 seconds to allow for login + search + results loading
            retryAttempts: 1,
        },
        create: {
            originCode: 'DONSSON',
            name: 'Donsson',
            url: 'https://www.donsson.com/shop', // Start at shop page, check for login link
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://www.donsson.com/shop',
            loginUsername: 'a.galvis@ciparcol.com',
            loginPassword: '8001453601',
            loginSteps: donssonCombinedSteps,
            waitForSelector: '[class*="product"], [class*="item"], div:has(> h4), div:has(> h5)', // Wait for product elements
            parserConfig: {
                type: 'html',
            },
            timeoutMs: 120000, // Increased timeout to 120 seconds to allow for login + search + results loading
            retryAttempts: 1,
        },
    });

    // Create MONTECARLO endpoint
    // Requires step-by-step login with Odoo authentication
    // Steps are imported from ./steps/montecarlo-steps.ts

    const montecarlo = await (prisma as any).deepWebEndpoint.upsert({
        where: { originCode: 'MONTECARLO' },
        update: {
            name: 'Montecarlo',
            url: 'https://portal.imm.com.co/my', // Base URL (auth check), loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://portal.imm.com.co/my',
            loginUsername: 'a.galvis@ciparcol.com',
            loginPassword: 'cater2580*',
            loginSteps: montecarloCombinedSteps,
            waitForSelector: '[class*="product"], [class*="item"], div:has(> h4), div:has(> h5)', // Wait for product elements
            parserConfig: {
                type: 'html',
            },
            timeoutMs: 120000, // Increased timeout to 120 seconds to allow for login + search + results loading
            retryAttempts: 1,
        },
        create: {
            originCode: 'MONTECARLO',
            name: 'Montecarlo',
            url: 'https://portal.imm.com.co/my', // Base URL (auth check), loginSteps handle the actual search
            method: 'GET',
            isActive: true,
            requiresLogin: true,
            loginUrl: 'https://portal.imm.com.co/my',
            loginUsername: 'a.galvis@ciparcol.com',
            loginPassword: 'cater2580*',
            loginSteps: montecarloCombinedSteps,
            waitForSelector: '[class*="product"], [class*="item"], div:has(> h4), div:has(> h5)', // Wait for product elements
            parserConfig: {
                type: 'html',
            },
            timeoutMs: 120000, // Increased timeout to 120 seconds to allow for login + search + results loading
            retryAttempts: 1,
        },
    });

    console.log('✅ DeepWebEndpoint seeding completed!');
    console.log(`Created/Updated: ${agroCosta.name} (${agroCosta.originCode})`);
    console.log(`Created/Updated: ${gecolsa.name} (${gecolsa.originCode})`);
    console.log(`Created/Updated: ${servitractor.name} (${servitractor.originCode})`);
    console.log(`Created/Updated: ${importadoraGranAndina.name} (${importadoraGranAndina.originCode})`);
    console.log(`Created/Updated: ${partequipos.name} (${partequipos.originCode})`);
    console.log(`Created/Updated: ${retrotrac.name} (${retrotrac.originCode})`);
    console.log(`Created/Updated: ${donsson.name} (${donsson.originCode})`);
    console.log(`Created/Updated: ${montecarlo.name} (${montecarlo.originCode})`);
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

