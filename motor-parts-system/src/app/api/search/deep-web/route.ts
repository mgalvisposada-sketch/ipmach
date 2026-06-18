import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
// Dynamic imports for parsers and PlaywrightScraper to avoid build-time issues
// These will be loaded only at runtime when the API route is accessed
import { ParserFactory } from '@/lib/parsers/ParserFactory';
import { ParseResult, ParseError, Product } from '@/lib/parsers/types';
import { getCachedData, setCachedData, needsCacheRefresh } from '@/lib/utils/cache';
import { extractServitractorData } from '@/lib/utils/openai-extractor';
import { PersistentBrowserPool } from '@/lib/scrapers/PersistentBrowserPool';
import { ScrapeConfig } from '@/lib/scrapers/ScrapeConfig';
import {
    getCached as getRedisCached,
    setCached as setRedisCached,
    getDeepWebCacheKey,
    initializeCache,
} from '@/lib/utils/redis-cache';

export const dynamic = 'force-dynamic';

// Global pool instance (reused across requests)
let globalPool: PersistentBrowserPool | null = null;
let cacheInitialized = false;

// Type definition for login step (matches ScrapeConfig)
type LoginStep = {
    type: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'press' | 'navigate' | 'log-html' | 'evaluate';
    selector?: string;
    value?: string;
    url?: string;
    script?: string;
    options?: {
        delay?: number;
        timeout?: number;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'networkidle0' | 'networkidle2';
        button?: 'left' | 'right' | 'middle';
        key?: string;
        filename?: string;
    };
};

// Type guard to check if JsonValue is an array of LoginStep
function isLoginStepsArray(value: Prisma.JsonValue | null | undefined): value is LoginStep[] {
    if (!value || !Array.isArray(value)) {
        return false;
    }
    // Check if all elements are objects with a 'type' property
    return value.every((item) => 
        typeof item === 'object' && 
        item !== null && 
        'type' in item && 
        typeof (item as any).type === 'string'
    );
}

// Type definition for DeepWebEndpoint
type DeepWebEndpoint = {
    id: number;
    originCode: string;
    name: string;
    url: string;
    method: 'GET' | 'POST';
    token: string | null;
    tokenHeaderName: string | null;
    tokenPlacement: 'header' | 'query' | 'body';
    requestBodyTemplate: string | null;
    isActive: boolean;
    parserConfig: any;
    timeoutMs: number;
    retryAttempts: number;
    waitForSelector: string | null;
    requiresLogin: boolean;
    loginUrl: string | null;
    loginUsername: string | null;
    loginPassword: string | null;
    loginFormSelector: string | null;
    usernameField: string | null;
    passwordField: string | null;
    loginSteps?: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
};

// Register parsers lazily to avoid build-time execution
// This function will be called only at runtime when the API route is accessed
async function registerParsers() {
    // Only register if not already registered (singleton pattern)
    if (ParserFactory.getAllParsers().length === 0) {
        // Dynamic imports to avoid build-time execution
        const [
            { PartequiposParser },
            { AgroCostaParser },
            { GecolsaParser },
            { ServitractorParser },
            { ImportadoraGranAndinaParser },
            { RetrotracParser }
        ] = await Promise.all([
            import('@/lib/parsers/PartequiposParser'),
            import('@/lib/parsers/AgroCostaParser'),
            import('@/lib/parsers/GecolsaParser'),
            import('@/lib/parsers/ServitractorParser'),
            import('@/lib/parsers/ImportadoraGranAndinaParser'),
            import('@/lib/parsers/RetrotracParser')
        ]);

        ParserFactory.registerParser(new PartequiposParser());
        ParserFactory.registerParser(new AgroCostaParser());
        ParserFactory.registerParser(new GecolsaParser());
        ParserFactory.registerParser(new ServitractorParser());
        ParserFactory.registerParser(new ImportadoraGranAndinaParser());
        ParserFactory.registerParser(new RetrotracParser());
    }
}

/**
 * Build request URL with token placement in query string
 */
function buildUrl(urlTemplate: string, reference: string, token?: string, tokenPlacement?: string): string {
    // Replace {{reference}} in the URL template
    // Handle case where reference is inside a JSON string that needs to be URL-encoded
    let url = urlTemplate;

    // First, check if {{reference}} is inside an already URL-encoded JSON string
    // (e.g., in pageParameters=%7B%22busqueda%22%3A%22{{reference}}%22%7D)
    // In this case, we need to decode, replace, and re-encode
    if (url.includes('pageParameters=')) {
        // Extract the pageParameters part
        const match = url.match(/pageParameters=([^&]+)/);
        if (match) {
            try {
                // Decode the URL-encoded JSON
                const decoded = decodeURIComponent(match[1]);
                console.log('🔧 [buildUrl] Decoded pageParameters:', decoded);

                // Check if it contains the placeholder
                if (decoded.includes('{{reference}}')) {
                    // Replace {{reference}} in the decoded JSON
                    const withReference = decoded.replace(/\{\{reference\}\}/g, reference);
                    console.log('🔧 [buildUrl] Replaced with reference:', withReference);

                    // Re-encode the JSON
                    const reencoded = encodeURIComponent(withReference);
                    console.log('🔧 [buildUrl] Re-encoded:', reencoded);

                    // Replace in URL
                    url = url.replace(/pageParameters=[^&]+/, `pageParameters=${reencoded}`);
                } else {
                    // No placeholder found, use standard replacement
                    url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
                }
            } catch (e: any) {
                console.warn('⚠️ [buildUrl] Failed to decode pageParameters:', e.message);
                // If decoding fails, fall back to simple replacement
                url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
            }
        } else {
            // No pageParameters match, use standard replacement
            url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
        }
    } else {
        // Standard replacement - encode the reference
        url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
    }

    if (token && tokenPlacement === 'query') {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}token=${encodeURIComponent(token)}`;
    }

    return url;
}

/**
 * Build request headers with token if needed
 */
function buildHeaders(token?: string, tokenHeaderName?: string, tokenPlacement?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    if (token && tokenHeaderName && tokenPlacement === 'header') {
        headers[tokenHeaderName] = token;
    }

    return headers;
}

/**
 * Build request body for POST requests
 */
function buildBody(bodyTemplate: string | null, reference: string, token?: string, tokenPlacement?: string): string | undefined {
    if (!bodyTemplate) return undefined;

    let body = bodyTemplate.replace(/\{\{reference\}\}/g, reference);

    if (token && tokenPlacement === 'body') {
        // Try to insert token into JSON body
        try {
            const parsed = JSON.parse(body);
            if (typeof parsed === 'object') {
                parsed.token = token;
                body = JSON.stringify(parsed);
            }
        } catch {
            // If not JSON, append token somehow
            body += `&token=${encodeURIComponent(token)}`;
        }
    }

    return body;
}

/**
 * Helper function to send SSE events
 */
function sendSSEEvent(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, data: any): void {
    const eventData = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(eventData));
}

/**
 * Process a single endpoint and return parsed results
 */
async function processEndpoint(
    endpoint: DeepWebEndpoint,
    reference: string,
    pool: PersistentBrowserPool // Use PersistentBrowserPool instead of ScraperWorker
): Promise<{ result?: ParseResult; error?: ParseError }> {
    const isServitractor = endpoint.originCode === 'SERVITRACTOR';
    const isRetrotrac = endpoint.originCode === 'RETROTRAC';
    const isImportadoraGranAndina = endpoint.originCode === 'IMPORTADORAGRANANDINA';

    if (isServitractor) {
        console.log('🚀 [SERVITRACTOR] Starting endpoint processing');
        console.log('🚀 [SERVITRACTOR] Reference:', reference);
        console.log('🚀 [SERVITRACTOR] Endpoint URL template:', endpoint.url);
    }

    if (isImportadoraGranAndina) {
        console.log('📦 [IMPORTADORAGRANANDINA] Starting endpoint processing');
        console.log('📦 [IMPORTADORAGRANANDINA] Reference to search:', reference);
    }

    try {
        // Special handling for Importadora Gran Andina: cache full list and search within it
        if (isImportadoraGranAndina) {
            // Check if cache needs refresh
            let cachedFullList: any[] | null = null;

            if (!needsCacheRefresh(endpoint.originCode)) {
                cachedFullList = getCachedData<any[]>(endpoint.originCode);
                if (cachedFullList) {
                    console.log(`✅ [IMPORTADORAGRANANDINA] Using cached data (${cachedFullList.length} items)`);
                }
            }

            // If no cache or cache is stale, fetch the full list
            if (!cachedFullList) {
                console.log('🔄 [IMPORTADORAGRANANDINA] Cache is stale or missing, fetching full list...');

                // Build URL without reference (to get full list)
                // The URL template should not include {{reference}} for this source
                const fullListUrl = endpoint.url.replace(/\{\{reference\}\}/g, '');

                const headers = buildHeaders(
                    endpoint.token || undefined,
                    endpoint.tokenHeaderName || undefined,
                    endpoint.tokenPlacement
                );

                // Add Accept header for JSON response
                headers['Accept'] = 'application/json, text/javascript, */*; q=0.01';
                headers['X-Requested-With'] = 'XMLHttpRequest'; // WordPress AJAX endpoint expects this

                // Parse cookies if provided (from endpoint config or env)
                let cookies: string | undefined = undefined;
                const cookieHeader = process.env.IMPORTADORAGRANANDINA_COOKIES ||
                    endpoint.parserConfig?.cookies;

                if (cookieHeader) {
                    headers['Cookie'] = cookieHeader;
                    cookies = cookieHeader;
                    console.log('📦 [IMPORTADORAGRANANDINA] Using cookies for authentication');
                }

                try {
                    // Fetch full list
                    const fullListContent = await pool.scrape({
                        url: fullListUrl,
                        method: endpoint.method,
                        headers,
                        body: endpoint.method === 'POST' ? endpoint.requestBodyTemplate || undefined : undefined,
                        timeout: endpoint.timeoutMs,
                        waitForSelector: endpoint.waitForSelector || undefined,
                        retryAttempts: endpoint.retryAttempts,
                        requiresLogin: endpoint.requiresLogin || false,
                        loginUrl: endpoint.loginUrl || undefined,
                        loginUsername: endpoint.loginUsername || undefined,
                        loginPassword: endpoint.loginPassword || undefined,
                        loginFormSelector: endpoint.loginFormSelector || undefined,
                        usernameField: endpoint.usernameField || undefined,
                        passwordField: endpoint.passwordField || undefined,
                        cookies,
                    });

                    // Parse the full list
                    let parsedFullList: any[];
                    try {
                        let contentToParse = fullListContent;

                        // If content is a string, check if it starts with HTML tags
                        if (typeof contentToParse === 'string') {
                            const trimmed = contentToParse.trim();

                            // If response starts with HTML, try to extract JSON from it
                            if (trimmed.startsWith('<')) {
                                console.warn('⚠️ [IMPORTADORAGRANANDINA] Response appears to be HTML, attempting to extract JSON...');

                                // Try to find JSON array in the HTML (might be in script tags or body)
                                const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
                                if (jsonMatch) {
                                    contentToParse = jsonMatch[0];
                                    console.log('✅ [IMPORTADORAGRANANDINA] Extracted JSON from HTML response');
                                } else {
                                    // Log first 500 chars for debugging
                                    console.error('❌ [IMPORTADORAGRANANDINA] Response is HTML and no JSON found. First 500 chars:', trimmed.substring(0, 500));
                                    throw new Error('Response is HTML and no JSON array found');
                                }
                            }

                            // Try to parse as JSON
                            parsedFullList = JSON.parse(contentToParse);
                        } else {
                            parsedFullList = contentToParse as any[];
                        }

                        if (!Array.isArray(parsedFullList)) {
                            throw new Error('Response is not an array');
                        }

                        // Cache the full list
                        setCachedData(endpoint.originCode, parsedFullList);
                        cachedFullList = parsedFullList;
                        console.log(`✅ [IMPORTADORAGRANANDINA] Fetched and cached full list (${parsedFullList.length} items)`);
                    } catch (parseError: any) {
                        console.error('❌ [IMPORTADORAGRANANDINA] Failed to parse full list:', parseError.message);
                        console.error('❌ [IMPORTADORAGRANANDINA] Content type:', typeof fullListContent);
                        console.error('❌ [IMPORTADORAGRANANDINA] Content length:', typeof fullListContent === 'string' ? fullListContent.length : 'N/A');
                        if (typeof fullListContent === 'string') {
                            console.error('❌ [IMPORTADORAGRANANDINA] Content preview (first 500 chars):', fullListContent.substring(0, 500));
                        }
                        return {
                            error: {
                                originCode: endpoint.originCode,
                                originName: endpoint.name,
                                error: `Failed to parse full list: ${parseError.message}`,
                            },
                        };
                    }
                } catch (fetchError: any) {
                    console.error('❌ [IMPORTADORAGRANANDINA] Failed to fetch full list:', fetchError.message);

                    // Try to use stale cache if available
                    cachedFullList = getCachedData<any[]>(endpoint.originCode);
                    if (cachedFullList) {
                        console.log(`⚠️ [IMPORTADORAGRANANDINA] Using stale cache due to fetch error (${cachedFullList.length} items)`);
                    } else {
                        return {
                            error: {
                                originCode: endpoint.originCode,
                                originName: endpoint.name,
                                error: `Failed to fetch full list: ${fetchError.message}`,
                            },
                        };
                    }
                }
            }

            // Search within cached/fetched full list
            const parser = await ParserFactory.getParser(endpoint as any);
            const result = await parser.parse(cachedFullList, reference);

            return { result };
        }

        // Build request configuration (for all other endpoints)
        const url = buildUrl(endpoint.url, reference, endpoint.token || undefined, endpoint.tokenPlacement);

        if (isServitractor) {
            console.log('🚀 [SERVITRACTOR] Built URL:', url);
            // Verify reference was replaced
            if (url.includes('{{reference}}')) {
                console.error('❌ [SERVITRACTOR] ERROR: Reference placeholder not replaced in URL!');
            } else {
                console.log('✅ [SERVITRACTOR] Reference replaced successfully');
            }
        }

        const headers = buildHeaders(endpoint.token || undefined, endpoint.tokenHeaderName || undefined, endpoint.tokenPlacement);
        const body = endpoint.method === 'POST' ? buildBody(endpoint.requestBodyTemplate || null, reference, endpoint.token || undefined, endpoint.tokenPlacement) : undefined;

        // Set Content-Type for POST requests with JSON body
        if (endpoint.method === 'POST' && body) {
            const contentType = (endpoint.parserConfig as any)?.contentType || 'application/json';
            headers['Content-Type'] = contentType;
            console.log(`📦 [${endpoint.originCode}] Set Content-Type: ${contentType}`);
        }

        // Get cookies from environment variable or parserConfig
        // Format: {ORIGIN_CODE}_COOKIES="cookie1=value1; cookie2=value2" or parserConfig.cookies
        let cookies: string | undefined = undefined;

        // Check for cookies in parserConfig first (for endpoints like Partequipos, ImportadoraGranAndina, Servitractor)
        const parserConfigCookies = endpoint.parserConfig?.cookies;
        if (parserConfigCookies && typeof parserConfigCookies === 'string') {
            cookies = parserConfigCookies;
            headers['Cookie'] = cookies;
            console.log(`🍪 [${endpoint.originCode}] Using cookies from parserConfig (${cookies.split(';').length} cookies)`);
        }
        // Fallback: Check for cookies in environment variable (for backward compatibility)
        else if (isServitractor) {
            cookies = process.env.SERVITRACTOR_COOKIES || undefined;
            if (cookies) {
                console.log('🚀 [SERVITRACTOR] Cookies found in env (length:', cookies.length, 'chars)');
                // Also add Cookie header for Servitractor
                headers['Cookie'] = cookies;
            } else {
                console.warn('⚠️ [SERVITRACTOR] No cookies found in parserConfig or SERVITRACTOR_COOKIES env variable');
            }
        }
        // Generic check for {ORIGIN_CODE}_COOKIES env variable
        else {
            const envCookieName = `${endpoint.originCode}_COOKIES`;
            const envCookies = process.env[envCookieName];
            if (envCookies) {
                cookies = envCookies;
                headers['Cookie'] = cookies;
                console.log(`🍪 [${endpoint.originCode}] Using cookies from ${envCookieName} env variable`);
            }
        }

        if (isServitractor) {
            console.log('🚀 [SERVITRACTOR] Starting scrape with method:', endpoint.method);
        }

        // Scrape content using Playwright
        const content = await pool.scrape({
            url,
            method: endpoint.method,
            headers,
            body,
            timeout: endpoint.timeoutMs,
            waitForSelector: endpoint.waitForSelector || undefined,
            retryAttempts: endpoint.retryAttempts,
            requiresLogin: endpoint.requiresLogin || false,
            loginUrl: endpoint.loginUrl || undefined,
            loginUsername: endpoint.loginUsername || undefined,
            loginPassword: endpoint.loginPassword || undefined,
            loginFormSelector: endpoint.loginFormSelector || undefined,
            usernameField: endpoint.usernameField || undefined,
            passwordField: endpoint.passwordField || undefined,
            cookies, // Pass cookies to scraper
            originCode: endpoint.originCode, // Pass origin code for context caching
            loginSteps: isLoginStepsArray(endpoint.loginSteps) ? endpoint.loginSteps : undefined, // Pass combined login+search steps (safely cast from Prisma JsonValue)
            reference: reference, // Pass reference for loginSteps {{reference}} placeholder replacement
        });

        if (isServitractor) {
            console.log('🚀 [SERVITRACTOR] Scrape completed');
            console.log('🚀 [SERVITRACTOR] Content type:', typeof content);
            console.log('🚀 [SERVITRACTOR] Content length:', typeof content === 'string' ? content.length : 'N/A');
            console.log('🚀 [SERVITRACTOR] Content preview (first 1000 chars):', typeof content === 'string' ? content.substring(0, 1000) : 'N/A');

            // Store the full SERVITRACTOR response for logging
            const contentString = typeof content === 'string' ? content : JSON.stringify(content);

            // Log the full content (truncated if too long for console)
            const maxLogLength = 10000;
            if (contentString.length > maxLogLength) {
                console.log('📦 [SERVITRACTOR] Full response (truncated for logging):', contentString.substring(0, maxLogLength) + '... [truncated]');
                console.log(`📦 [SERVITRACTOR] Full response length: ${contentString.length} characters`);
            } else {
                console.log('📦 [SERVITRACTOR] Full response stored:', contentString);
            }

            // Check if using automation (loginSteps with combined login+search)
            const hasLoginSteps = isLoginStepsArray(endpoint.loginSteps);

            if (hasLoginSteps) {
                // For automation-based requests, use ServitractorParser (it can extract from HTML tiles)
                console.log('🔍 [SERVITRACTOR] Using automation - parsing with ServitractorParser');

                try {
                    const parser = await ParserFactory.getParser(endpoint as any);
                    const parseResult = await parser.parse(content, reference);

                    console.log(`✅ [SERVITRACTOR] Parser extracted ${parseResult.products?.length || 0} products`);
                    return { result: parseResult };
                } catch (parserError: any) {
                    console.error('❌ [SERVITRACTOR] Parser error:', parserError.message);
                    return {
                        result: {
                            originCode: endpoint.originCode,
                            originName: endpoint.name,
                            searchTerm: reference,
                            products: [],
                            metadata: {
                                totalFound: 0,
                                error: `Parser failed: ${parserError.message}`,
                            },
                        },
                    };
                }
            } else {
                // For direct URL requests (non-automation), use OpenAI directly (backward compatibility)
                console.log('🤖 [SERVITRACTOR] Using direct URL - using OpenAI to extract product information');
                console.log(`🤖 [SERVITRACTOR] Sending ${contentString.length} characters to OpenAI for search term: "${reference}"`);

                try {
                    // Extract data using OpenAI
                    const openaiResult = await extractServitractorData(contentString, reference);

                    // Log the raw OpenAI response
                    console.log('🤖 [SERVITRACTOR] OpenAI raw response received:');
                    console.log('🤖 [SERVITRACTOR] OpenAI response structure:', {
                        hasProducts: Array.isArray(openaiResult.products),
                        productCount: openaiResult.products?.length || 0,
                        hasError: !!openaiResult.error,
                        error: openaiResult.error || 'none',
                    });

                    // Log each product extracted by OpenAI
                    if (openaiResult.products && openaiResult.products.length > 0) {
                        console.log('🤖 [SERVITRACTOR] OpenAI extracted products:');
                        openaiResult.products.forEach((product, index) => {
                            console.log(`  [${index + 1}] ${product.reference || 'N/A'}: ${product.description || 'N/A'} - Price: ${product.price || 'N/A'} - Stock: ${product.stock || 0} - HasStock: ${product.hasStock}`);
                        });
                    } else {
                        console.log('⚠️ [SERVITRACTOR] OpenAI returned no products');
                    }

                    if (openaiResult.error) {
                        console.error('❌ [SERVITRACTOR] OpenAI extraction error:', openaiResult.error);
                        console.error('❌ [SERVITRACTOR] Full OpenAI error response:', JSON.stringify(openaiResult, null, 2));
                        return {
                            result: {
                                originCode: endpoint.originCode,
                                originName: endpoint.name,
                                searchTerm: reference,
                                products: [],
                                metadata: {
                                    totalFound: 0,
                                    error: `OpenAI extraction failed: ${openaiResult.error}`,
                                    extractedBy: 'openai',
                                },
                            },
                        };
                    }

                    // Convert OpenAI results to our Product format
                    // Normalize reference (uppercase, trim, remove extra spaces)
                    const normalizeReference = (ref: string): string => {
                        return ref.trim().toUpperCase().replace(/\s+/g, ' ');
                    };

                    const products: Product[] = openaiResult.products.map((item) => ({
                        reference: normalizeReference(item.reference),
                        description: item.description,
                        price: item.price,
                        stock: item.stock || 0,
                        hasStock: item.hasStock,
                        origin: endpoint.originCode,
                    }));

                    console.log(`✅ [SERVITRACTOR] OpenAI extracted ${products.length} products`);
                    console.log('✅ [SERVITRACTOR] Final products after normalization:');
                    products.forEach((product, index) => {
                        console.log(`  [${index + 1}] ${product.reference}: ${product.description || 'N/A'} - Price: ${product.price || 'N/A'} - Stock: ${product.stock || 0} - HasStock: ${product.hasStock}`);
                    });

                    return {
                        result: {
                            originCode: endpoint.originCode,
                            originName: endpoint.name,
                            searchTerm: reference,
                            products,
                            metadata: {
                                totalFound: products.length,
                                extractedBy: 'openai',
                            },
                        },
                    };
                } catch (openaiError: any) {
                    console.error('❌ [SERVITRACTOR] OpenAI extraction failed:', openaiError.message);
                    return {
                        error: {
                            originCode: endpoint.originCode,
                            originName: endpoint.name,
                            error: `OpenAI extraction failed: ${openaiError.message}`,
                            details: openaiError.stack,
                        },
                    };
                }
            }
        }

        const isPartequipos = endpoint.originCode === 'PARTEQUIPOS';

        if (isRetrotrac) {
            console.log('🔄 [RETROTRAC] Scrape completed');
            console.log('🔄 [RETROTRAC] Content type:', typeof content);
            console.log('🔄 [RETROTRAC] Content length:', content.length);
            console.log('🔄 [RETROTRAC] Content preview (first 1000 chars):', content.substring(0, 1000));

            // Store the full RETROTRAC response for logging
            const contentString = typeof content === 'string' ? content : JSON.stringify(content);

            // Log the full content (truncated if too long for console)
            const maxLogLength = 10000;
            if (contentString.length > maxLogLength) {
                console.log('📦 [RETROTRAC] Full response (truncated for logging):', contentString.substring(0, maxLogLength) + '... [truncated]');
                console.log(`📦 [RETROTRAC] Full response length: ${contentString.length} characters`);
            } else {
                console.log('📦 [RETROTRAC] Full response stored:', contentString);
            }

            // Check if content is HTML (from automation) - if so, let the parser handle it
            const isHtmlContent = contentString.includes('<!DOCTYPE') ||
                contentString.includes('box-product__info') ||
                contentString.includes('CANT.DISPONIBLE');

            if (isHtmlContent) {
                console.log('🔍 [RETROTRAC] Detected HTML content from automation - passing to parser');
                // Let the parser handle HTML content
                const parser = await ParserFactory.getParser(endpoint as any);
                const result = await parser.parse(content, reference);
                return { result };
            }

            // For RETROTRAC JSON responses, parse the JSON directly here
            console.log('🔍 [RETROTRAC] Parsing JSON response directly');

            try {
                // Parse the JSON response
                let jsonData: any;
                if (typeof content === 'string') {
                    jsonData = JSON.parse(contentString);
                } else {
                    jsonData = content;
                }

                console.log('✅ [RETROTRAC] JSON parsed successfully');
                console.log('🔍 [RETROTRAC] Response structure:', {
                    hasItems: Array.isArray(jsonData.items),
                    itemsCount: Array.isArray(jsonData.items) ? jsonData.items.length : 0,
                    cantidadTotal: jsonData.cantidadTotal,
                    totalPage: jsonData.totalPage,
                });

                // Extract products from items array
                const products: Product[] = [];

                if (Array.isArray(jsonData.items) && jsonData.items.length > 0) {
                    console.log('🔍 [RETROTRAC] Processing items...');

                    jsonData.items.forEach((item: any, index: number) => {
                        try {
                            // Normalize reference helper
                            const normalizeRef = (ref: string): string => {
                                return ref.trim().toUpperCase().replace(/\s+/g, ' ');
                            };

                            // Extract reference - prioritize shortDescription
                            let productReference = '';
                            if (item.shortDescription && item.shortDescription.trim()) {
                                productReference = normalizeRef(item.shortDescription.trim());
                            } else if (item.reference) {
                                productReference = normalizeRef(item.reference);
                            } else {
                                productReference = normalizeRef(reference);
                            }

                            // Remove "RET" prefix if reference starts with "RET"
                            if (productReference.toUpperCase().startsWith('RET')) {
                                productReference = productReference.substring(3);
                            }

                            // Extract description
                            const description = item.name || item.shortDescription || '';

                            // Extract price - use itemPrice (without tax)
                            let price = 0;
                            if (item.itemPrice) {
                                price = parseFloat(item.itemPrice.toString()) || 0;
                            } else if (item.currentPrice) {
                                price = parseFloat(item.currentPrice.toString()) || 0;
                            } else if (item.lastPrice) {
                                price = parseFloat(item.lastPrice.toString()) || 0;
                            }

                            // Extract stock - use available field only
                            let stock = 0;
                            if (typeof item.available === 'number') {
                                stock = item.available;
                            } else if (typeof item.available === 'string') {
                                stock = parseInt(item.available, 10) || 0;
                            }
                            const hasStock = stock > 0;

                            // Extract image URL
                            let imageUrl: string | undefined = undefined;
                            if (item.principalImage && item.imagesDetail && item.imagesDetail.length > 0) {
                                const imageDetail = item.imagesDetail[0];
                                if (imageDetail.path && imageDetail.image) {
                                    imageUrl = `${imageDetail.path}${imageDetail.image}`;
                                }
                            }

                            // Extract link
                            const link = item.slug || item.producto_slug
                                ? `https://admin.retrotrac.com/frontend/web/index.php/${item.slug || item.producto_slug}`
                                : undefined;

                            console.log(`✅ [RETROTRAC] Product ${index + 1}: ${productReference} - ${description.substring(0, 50)} - Price: ${price} - Stock: ${stock}`);

                            products.push({
                                reference: productReference,
                                description: description || undefined,
                                price: price > 0 ? price : undefined,
                                stock,
                                hasStock,
                                imageUrl,
                                link,
                                origin: endpoint.originCode,
                            });
                        } catch (itemError: any) {
                            console.error(`❌ [RETROTRAC] Error processing item ${index + 1}:`, itemError.message);
                        }
                    });

                    console.log(`✅ [RETROTRAC] Extracted ${products.length} products from JSON`);

                    return {
                        result: {
                            originCode: endpoint.originCode,
                            originName: endpoint.name,
                            searchTerm: reference,
                            products,
                            metadata: {
                                totalFound: products.length,
                                cantidadTotal: jsonData.cantidadTotal,
                                totalPage: jsonData.totalPage,
                            },
                        },
                    };
                } else {
                    console.warn('⚠️ [RETROTRAC] No items found in response');
                    return {
                        result: {
                            originCode: endpoint.originCode,
                            originName: endpoint.name,
                            searchTerm: reference,
                            products: [],
                            metadata: {
                                totalFound: 0,
                                error: 'No items found in response',
                            },
                        },
                    };
                }
            } catch (jsonError: any) {
                console.error('❌ [RETROTRAC] Failed to parse JSON:', jsonError.message);
                console.error('❌ [RETROTRAC] Content that failed to parse:', contentString.substring(0, 500));

                return {
                    error: {
                        originCode: endpoint.originCode,
                        originName: endpoint.name,
                        error: `Failed to parse JSON response: ${jsonError.message}`,
                        details: jsonError.stack,
                    },
                };
            }
        }

        if (isPartequipos) {
            console.log('📦 [PARTEQUIPOS] Scrape completed');
            console.log('📦 [PARTEQUIPOS] Content type:', typeof content);
            console.log('📦 [PARTEQUIPOS] Content length:', content.length);
        }

        // Parse content - try to detect if it's JSON
        let parsedContent: string | object = content;

        // Parse content based on endpoint type
        if (typeof content === 'string') {
            const trimmed = content.trim();

            // For SERVITRACTOR, try to extract JSON from HTML/string
            if (isServitractor) {
                // Check if content contains JSON structure (MODEL and DATAJSONARRAY)
                if (trimmed.includes('"MODEL"') && trimmed.includes('"DATAJSONARRAY"')) {
                    // Try to extract JSON object from the string
                    const jsonMatch = trimmed.match(/\{[\s\S]*?"MODEL"[\s\S]*?"DATAJSONARRAY"[\s\S]*?\}/);
                    if (jsonMatch) {
                        try {
                            parsedContent = JSON.parse(jsonMatch[0]);
                            console.log('✅ [SERVITRACTOR] Extracted and parsed JSON from content');
                        } catch (parseError) {
                            console.warn('⚠️ [SERVITRACTOR] Failed to parse extracted JSON:', (parseError as Error).message);
                            // Try parsing the full content
                            try {
                                parsedContent = JSON.parse(trimmed);
                                console.log('✅ [SERVITRACTOR] Parsed full content as JSON');
                            } catch {
                                // Keep as string, parser will handle it
                                parsedContent = content;
                                console.log('⚠️ [SERVITRACTOR] Keeping content as string, parser will extract JSON');
                            }
                        }
                    } else {
                        // Try parsing the full content
                        try {
                            parsedContent = JSON.parse(trimmed);
                            console.log('✅ [SERVITRACTOR] Parsed full content as JSON');
                        } catch {
                            // Keep as string, parser will handle it
                            parsedContent = content;
                            console.log('⚠️ [SERVITRACTOR] Keeping content as string, parser will extract JSON');
                        }
                    }
                } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    // Standard JSON format
                    try {
                        parsedContent = JSON.parse(trimmed);
                        console.log('✅ [SERVITRACTOR] Parsed JSON successfully');
                    } catch (e) {
                        console.warn('⚠️ [SERVITRACTOR] Content looks like JSON but failed to parse:', (e as Error).message);
                        parsedContent = content;
                    }
                } else {
                    // Keep as string, parser will try to extract JSON
                    parsedContent = content;
                    console.log('🚀 [SERVITRACTOR] Content does not start with { or [, keeping as string for parser');
                }
            } else if (endpoint.originCode === 'RETROTRAC') {
                // For RETROTRAC, try to parse as JSON
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        parsedContent = JSON.parse(trimmed);
                        console.log('✅ [RETROTRAC] Parsed JSON successfully');
                    } catch (e) {
                        console.warn('⚠️ [RETROTRAC] Failed to parse JSON:', (e as Error).message);
                        parsedContent = content;
                    }
                } else {
                    parsedContent = content;
                }
            } else {
                // Standard JSON parsing for other endpoints
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        parsedContent = JSON.parse(trimmed);
                        console.log(`✅ [${endpoint.originCode}] Parsed JSON successfully`);
                    } catch (e) {
                        // Not valid JSON, treat as HTML
                        parsedContent = content;
                        console.log(`📄 [${endpoint.originCode}] Content is not valid JSON, treating as HTML/text`);
                    }
                } else {
                    parsedContent = content;
                }
            }
        }

        // Get parser for this endpoint
        const parser = await ParserFactory.getParser(endpoint as any);

        if (isServitractor) {
            console.log('🚀 [SERVITRACTOR] Parser obtained:', parser.originCode);
        }

        // Log content info before parsing
        if (endpoint.originCode === 'SERVITRACTOR' || endpoint.originCode === 'PARTEQUIPOS' || endpoint.originCode === 'RETROTRAC') {
            console.log(`🔍 [${endpoint.originCode}] Content info before canParse check:`);
            console.log(`  - Type: ${typeof parsedContent}`);
            console.log(`  - Is string: ${typeof parsedContent === 'string'}`);
            if (typeof parsedContent === 'string') {
                console.log(`  - Length: ${parsedContent.length}`);
                console.log(`  - Preview (first 500 chars): ${parsedContent.substring(0, 500)}`);
                console.log(`  - Contains MODEL: ${parsedContent.includes('MODEL')}`);
                console.log(`  - Contains DATAJSONARRAY: ${parsedContent.includes('DATAJSONARRAY')}`);
                console.log(`  - Contains items: ${parsedContent.includes('items')}`);
                console.log(`  - Contains partequipos: ${parsedContent.includes('partequipos')}`);
            } else {
                console.log(`  - Keys: ${Object.keys(parsedContent || {}).join(', ')}`);
            }
        }

        // Verify parser can handle this content
        const canParse = parser.canParse(parsedContent);

        if (isRetrotrac) {
            console.log(`🔍 [RETROTRAC] canParse result: ${canParse}`);
            console.log(`🔍 [RETROTRAC] parsedContent type: ${typeof parsedContent}`);
            if (typeof parsedContent === 'object' && parsedContent !== null) {
                console.log(`🔍 [RETROTRAC] parsedContent keys: ${Object.keys(parsedContent).join(', ')}`);
                if ('items' in parsedContent) {
                    console.log(`🔍 [RETROTRAC] items is array: ${Array.isArray((parsedContent as any).items)}`);
                    console.log(`🔍 [RETROTRAC] items count: ${Array.isArray((parsedContent as any).items) ? (parsedContent as any).items.length : 'N/A'}`);
                }
            }
        }

        if (!canParse) {
            const preview = typeof parsedContent === 'string' ? parsedContent.substring(0, 200) : 'object';
            console.warn(`⚠️ [${endpoint.originCode}] Parser cannot parse content for ${reference}. Preview:`, preview);
            console.warn(`⚠️ [${endpoint.originCode}] Content type: ${typeof parsedContent}`);

            // For these three parsers, try parsing anyway if content is not empty
            if ((endpoint.originCode === 'SERVITRACTOR' || endpoint.originCode === 'PARTEQUIPOS' || endpoint.originCode === 'RETROTRAC') &&
                typeof parsedContent === 'string' && parsedContent.length > 10) {
                console.log(`⚠️ [${endpoint.originCode}] Parser rejected content, but trying to parse anyway since content is not empty`);
                // Continue to parse anyway - the parser might still work
            } else {
                // Return empty result instead of failing
                return {
                    result: {
                        originCode: endpoint.originCode,
                        originName: endpoint.name,
                        searchTerm: reference,
                        products: [],
                        metadata: {
                            totalFound: 0,
                            error: 'Parser cannot handle this content structure',
                        },
                    },
                };
            }
        }

        if (isServitractor) {
            console.log('🚀 [SERVITRACTOR] Parser can handle content, calling parse()...');
        }

        if (isRetrotrac) {
            console.log('🔄 [RETROTRAC] Parser can handle content, calling parse()...');
        }

        // Parse the content
        const result = await parser.parse(parsedContent, reference);

        if (isServitractor) {
            console.log('✅ [SERVITRACTOR] Parse result:', {
                originCode: result.originCode,
                originName: result.originName,
                productCount: result.products.length,
                metadata: result.metadata,
            });
        }

        if (isRetrotrac) {
            console.log('✅ [RETROTRAC] Parse result:', {
                originCode: result.originCode,
                originName: result.originName,
                productCount: result.products.length,
                metadata: result.metadata,
            });
            console.log('✅ [RETROTRAC] Products:', result.products.map(p => ({
                reference: p.reference,
                description: p.description?.substring(0, 50),
                price: p.price,
                stock: p.stock,
                hasStock: p.hasStock,
            })));
        }

        return { result };
    } catch (error: any) {
        if (isServitractor) {
            console.error('❌ [SERVITRACTOR] Error processing endpoint:', error.message);
            console.error('❌ [SERVITRACTOR] Error stack:', error.stack);
        }

        if (isRetrotrac) {
            console.error('❌ [RETROTRAC] Error processing endpoint:', error.message);
            console.error('❌ [RETROTRAC] Error stack:', error.stack);
        }

        return {
            error: {
                originCode: endpoint.originCode,
                originName: endpoint.name,
                error: error.message || 'Unknown error',
                details: error.stack,
            },
        };
    }
}

/**
 * POST /api/search/deep-web
 * Searches across multiple external endpoints using deep web search
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { reference, clientId, clientType } = await request.json();

        if (!reference || typeof reference !== 'string' || !reference.trim()) {
            return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
        }

        const searchTerm = reference.trim();

        // Register parsers lazily (only at runtime, not during build)
        await registerParsers();

        // Fetch all active endpoints from database
        const endpoints = await (prisma as any).deepWebEndpoint.findMany({
            where: {
                isActive: true,
            },
            orderBy: {
                id: 'asc',
            },
        }) as DeepWebEndpoint[];

        if (endpoints.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                errors: [],
                message: 'No active endpoints configured',
            });
        }

        // Initialize cache if not already done
        if (!cacheInitialized) {
            await initializeCache();
            cacheInitialized = true;
        }

        // Generate cache key
        const cacheKey = getDeepWebCacheKey(searchTerm, clientType);

        // Check cache first
        const cachedResult = await getRedisCached<any>(cacheKey);
        if (cachedResult) {
            console.log(`[DEEP-WEB] ✅ Cache hit for "${searchTerm}"`);
            return NextResponse.json(cachedResult);
        }

        // Initialize or reuse persistent browser pool
        if (!globalPool) {
            const poolSize = parseInt(process.env.DEEP_WEB_WORKER_POOL_SIZE || '4', 10);
            globalPool = new PersistentBrowserPool(poolSize);
            await globalPool.initialize();
            console.log(`[DEEP-WEB] ✅ Initialized persistent browser pool with ${poolSize} workers`);
        }

        // Get priority order for endpoints (fastest first)
        const originCodes = endpoints.map((e) => e.originCode);
        const priorityOrder = globalPool.getPriorityOrder(originCodes);

        // Sort endpoints by priority
        const sortedEndpoints = [...endpoints].sort((a, b) => {
            const aIndex = priorityOrder.indexOf(a.originCode);
            const bIndex = priorityOrder.indexOf(b.originCode);
            // If not in priority list, put at end
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });

        console.log(`[DEEP-WEB] Processing ${sortedEndpoints.length} endpoints in priority order:`, priorityOrder);

        try {
            // Process all endpoints in parallel using worker pool
            const promises = sortedEndpoints.map((endpoint: DeepWebEndpoint) =>
                processEndpoint(endpoint, searchTerm, globalPool!)
            );

            const results = await Promise.allSettled(promises);

            // Collect successful results and errors
            const parseResults: ParseResult[] = [];
            const parseErrors: ParseError[] = [];
            const allProducts: Product[] = [];

            results.forEach((result: PromiseSettledResult<{ result?: ParseResult; error?: ParseError }>, index: number) => {
                if (result.status === 'fulfilled') {
                    const { result: parseResult, error } = result.value;
                    if (parseResult) {
                        parseResults.push(parseResult);
                        allProducts.push(...parseResult.products);
                    } else if (error) {
                        parseErrors.push(error);
                    }
                } else {
                    // Promise rejection
                    const endpoint = endpoints[index];
                    parseErrors.push({
                        originCode: endpoint.originCode,
                        originName: endpoint.name,
                        error: result.reason?.message || 'Unknown error',
                        details: result.reason,
                    });
                }
            });

            // Group products by origin instead of merging
            const productsByOrigin = new Map<string, Product[]>();

            // Initialize all origins (even with 0 products) so they appear in tabs
            endpoints.forEach((endpoint) => {
                if (!productsByOrigin.has(endpoint.originCode)) {
                    productsByOrigin.set(endpoint.originCode, []);
                }
            });

            parseResults.forEach((result) => {
                const originCode = result.originCode;
                if (!productsByOrigin.has(originCode)) {
                    productsByOrigin.set(originCode, []);
                }
                productsByOrigin.get(originCode)!.push(...result.products);
            });

            // Log grouping for debugging
            console.log('Products grouped by origin:', {
                origins: Array.from(productsByOrigin.entries()).map(([code, products]) => ({
                    code,
                    count: products.length
                }))
            });

            // Apply price markup for deep web search: divide by 0.6 (equivalent to 66.67% markup)
            // This applies to all deep web sources regardless of client type
            console.log('🔢 [DEEP-WEB] Applying price markup (÷ 0.6) to all products...');
            productsByOrigin.forEach((products, originCode) => {
                products.forEach((product) => {
                    if (product.price && product.price > 0) {
                        const originalPrice = product.price;
                        product.price = Math.round(product.price / 0.6);
                        console.log(`💰 [${originCode}] ${product.reference}: ${originalPrice} → ${product.price} (÷ 0.6)`);
                    }
                });
            });

            // Sort products within each origin by stock availability
            productsByOrigin.forEach((products, originCode) => {
                products.sort((a, b) => {
                    if (a.hasStock && !b.hasStock) return -1;
                    if (!a.hasStock && b.hasStock) return 1;
                    if (a.hasStock && b.hasStock) {
                        return (b.stock || 0) - (a.stock || 0);
                    }
                    return 0;
                });
            });

            // Convert to object for easy frontend access
            const resultsByOrigin: Record<string, Product[]> = {};
            productsByOrigin.forEach((products, originCode) => {
                resultsByOrigin[originCode] = products;
            });

            // Also provide summary with origin names - include all endpoints even if no results
            const originSummary = endpoints.map((endpoint) => {
                const parseResult = parseResults.find((r) => r.originCode === endpoint.originCode);
                return {
                    originCode: endpoint.originCode,
                    originName: endpoint.name,
                    productCount: parseResult?.products.length || 0,
                    hasError: parseErrors.some((e) => e.originCode === endpoint.originCode),
                };
            });

            // Also include origins from parseResults that might not be in endpoints (shouldn't happen but be safe)
            parseResults.forEach((result) => {
                if (!originSummary.find((o) => o.originCode === result.originCode)) {
                    originSummary.push({
                        originCode: result.originCode,
                        originName: result.originName,
                        productCount: result.products.length,
                        hasError: false,
                    });
                }
            });

            const responseData = {
                success: true,
                data: resultsByOrigin,
                results: parseResults,
                errors: parseErrors,
                summary: {
                    totalProducts: allProducts.length,
                    totalOrigins: parseResults.length,
                    failedOrigins: parseErrors.length,
                    origins: originSummary,
                },
                metrics: globalPool.getEnhancedMetrics(),
            };

            // Cache the results for 5 minutes
            await setRedisCached(cacheKey, responseData, 300);

            return NextResponse.json(responseData);
        } catch (poolError: any) {
            console.error('[DEEP-WEB] Error in pool processing:', poolError);
            // Don't close pool on error - keep it alive for next request
            throw poolError;
        }
    } catch (error: any) {
        console.error('Deep web search error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Internal server error',
            },
            { status: 500 }
        );
    }
}

