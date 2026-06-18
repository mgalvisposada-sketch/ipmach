import 'dotenv/config';
import { servitractorCombinedSteps } from '../prisma/steps';

/**
 * Test script to verify SERVITRACTOR API endpoint
 * Tests the /api/search/deep-web/SERVITRACTOR endpoint
 */

const DEEP_SEARCH_SERVICE_URL = process.env.DEEP_SEARCH_SERVICE_URL || 'http://localhost:3001';
const DEEP_SEARCH_SERVICE_API_KEY = process.env.DEEP_SEARCH_SERVICE_API_KEY || 'test-api-key-12345';

async function testServitractorAPI() {
    console.log('🧪 Testing SERVITRACTOR API endpoint...\n');
    console.log(`Service URL: ${DEEP_SEARCH_SERVICE_URL}`);
    console.log(`API Key: ${DEEP_SEARCH_SERVICE_API_KEY ? 'Set (***)' : 'NOT SET'}\n`);

    // Test reference - adjust as needed
    const testReference = '1R0750';

    const payload = {
        reference: testReference,
        originCode: 'SERVITRACTOR',
        originName: 'Servitractor',
        url: 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1', // Base URL only, loginSteps handle the actual search
        method: 'GET',
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
    };

    try {
        console.log(`📡 Sending request to ${DEEP_SEARCH_SERVICE_URL}/search...`);
        console.log(`   Reference: ${testReference}`);
        console.log(`   Origin: SERVITRACTOR`);
        console.log(`   Login Steps: ${servitractorCombinedSteps.length} steps\n`);

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
            console.error('❌ Request failed:');
            console.error(`   Status: ${response.status}`);
            console.error(`   Elapsed Time: ${elapsedTime}s`);
            console.error(`   Error:`, data);
            return;
        }

        console.log('✅ Request successful!\n');
        console.log(`⏱️  Elapsed Time: ${elapsedTime}s\n`);
        console.log(`📊 Results:`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Product Count: ${data.productCount || 0}`);
        console.log(`   Products: ${data.products?.length || 0}`);
        
        if (data.products && data.products.length > 0) {
            console.log(`\n📦 Products Found:`);
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
            console.log(`\n⚠️  No products found for reference "${testReference}"`);
        }

        if (data.error) {
            console.log(`\n⚠️  Warning: ${data.error}`);
        }

        // Log raw data if available (for debugging)
        if (data.products && data.products.length > 0 && data.products[0].rawData) {
            console.log(`\n🔍 Raw Data (first product):`);
            console.log(JSON.stringify(data.products[0].rawData, null, 2));
        }
    } catch (error: any) {
        console.error('❌ Error testing API:');
        console.error(`   ${error.message}`);
        if (error.cause) {
            console.error(`   Cause:`, error.cause);
        }
        if (error.stack) {
            console.error(`   Stack:`, error.stack);
        }
    }
}

testServitractorAPI()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });

