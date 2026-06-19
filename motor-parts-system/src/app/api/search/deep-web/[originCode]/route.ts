import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canClientSearch, getClientSearchPolicy, getSearchDeniedReason } from '@/lib/client-search-policy';
import { Product } from '@/lib/parsers/types';
import { calculatePriceWithProfit } from '@/lib/utils/price-calculation';
import { ClientSourceConfig } from '@/types';

export const dynamic = 'force-dynamic';

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
    loginSteps: any; // Combined login+search steps
    createdAt: Date;
    updatedAt: Date;
};

/**
 * POST /api/search/deep-web/[originCode]
 * Search a single source by originCode
 * Now calls Deep Search Service instead of handling scraping directly
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ originCode: string }> }
) {
    let originCodeForError: string | undefined;
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { originCode } = await params;
        originCodeForError = originCode;
        let { reference, clientId, clientType } = await request.json();
        
        if (reference) {
            reference = String(reference).toUpperCase().trim();
        }

        if (!reference || typeof reference !== 'string' || !reference.trim()) {
            return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
        }

        if (session.user.role === 'client') {
            const clientId = parseInt(session.user.id);
            const canSearch = await canClientSearch(clientId);
            if (!canSearch) {
                const policy = await getClientSearchPolicy(clientId);
                const { code, message } = getSearchDeniedReason(policy);
                return NextResponse.json({ error: message, code }, { status: 403 });
            }
        }

        const searchTerm = reference.trim();
        const originCodeUpper = originCode.toUpperCase();

        // Fetch the specific endpoint from database (include ALL fields including loginSteps)
        const endpoint = await (prisma as any).deepWebEndpoint.findFirst({
            where: {
                originCode: originCodeUpper,
                isActive: true,
            },
            // Explicitly select all fields to ensure loginSteps is included
            select: undefined, // undefined means select all fields
        }) as DeepWebEndpoint | null;

        if (!endpoint) {
            return NextResponse.json(
                { error: `Endpoint ${originCode} not found or inactive` },
                { status: 404 }
            );
        }

        // Build URL with reference placeholder replacement
        let url = endpoint.url.replace('{{reference}}', encodeURIComponent(searchTerm));

        // Build request payload for Deep Search Service
        // Include ALL fields from Prisma schema, especially loginSteps (combined login+search)
        // CRITICAL: reference MUST be included for loginSteps placeholder replacement ({{reference}})
        const payload = {
            reference: searchTerm, // CRITICAL: Required for {{reference}} placeholder in loginSteps
            originCode: endpoint.originCode,
            originName: endpoint.name,
            url,
            method: endpoint.method,
            requiresLogin: endpoint.requiresLogin || false,
            loginUrl: endpoint.loginUrl || undefined,
            loginUsername: endpoint.loginUsername || undefined,
            loginPassword: endpoint.loginPassword || undefined,
            loginFormSelector: endpoint.loginFormSelector || undefined,
            usernameField: endpoint.usernameField || undefined,
            passwordField: endpoint.passwordField || undefined,
            // CRITICAL: Send loginSteps (combined login+search) from Prisma schema
            loginSteps: endpoint.loginSteps ? JSON.parse(JSON.stringify(endpoint.loginSteps)) : undefined,
            timeoutMs: endpoint.timeoutMs,
            retryAttempts: endpoint.retryAttempts,
            waitForSelector: endpoint.waitForSelector || undefined,
            parserConfig: endpoint.parserConfig ? JSON.parse(JSON.stringify(endpoint.parserConfig)) : undefined,
            token: endpoint.token || undefined,
            tokenHeaderName: endpoint.tokenHeaderName || undefined,
            tokenPlacement: endpoint.tokenPlacement || undefined,
            requestBodyTemplate: endpoint.requestBodyTemplate || undefined,
            cookies: process.env[`${originCodeUpper}_COOKIES`] || undefined,
        };

        // Validate that reference is present (critical for loginSteps)
        if (!payload.reference || payload.reference.trim() === '') {
            console.error(`[DEEP-WEB-SINGLE] ❌ CRITICAL: Reference is missing or empty in payload!`);
            throw new Error('Reference is required for search');
        }

        console.log(`[DEEP-WEB-SINGLE] ✅ Payload validation:`, {
            hasReference: !!payload.reference,
            reference: payload.reference,
            referenceLength: payload.reference.length,
            hasLoginSteps: !!payload.loginSteps,
            loginStepsCount: payload.loginSteps ? (Array.isArray(payload.loginSteps) ? payload.loginSteps.length : 'not-array') : 0,
        });

        // Log payload for debugging (mask sensitive data)
        console.log(`[DEEP-WEB-SINGLE] 📤 Sending payload to Deep Search Service:`, {
            reference: payload.reference,
            referenceType: typeof payload.reference,
            referenceLength: payload.reference?.length || 0,
            originCode: payload.originCode,
            url: payload.url,
            method: payload.method,
            requiresLogin: payload.requiresLogin,
            hasLoginSteps: !!payload.loginSteps,
            loginStepsCount: payload.loginSteps ? (Array.isArray(payload.loginSteps) ? payload.loginSteps.length : 'not-array') : 0,
            hasLoginUsername: !!payload.loginUsername,
            hasLoginPassword: !!payload.loginPassword,
        });

        // Call Deep Search Service
        const serviceUrl = process.env.DEEP_SEARCH_SERVICE_URL || 'http://localhost:3001';
        const apiKey = process.env.DEEP_SEARCH_SERVICE_API_KEY || '';

        console.log(`[DEEP-WEB-SINGLE] 🔧 Service Configuration:`);
        console.log(`  Service URL: ${serviceUrl}`);
        console.log(`  API Key: ${apiKey ? 'Set (***)' : 'NOT SET - Warning!'}`);

        if (!apiKey) {
            console.warn('[DEEP-WEB-SINGLE] ⚠️ DEEP_SEARCH_SERVICE_API_KEY not set - requests may fail');
        }

        const fetchUrl = `${serviceUrl}/search`;
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey ? '***' : ''}`,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(180000), // 3 minutes max
        };

        // Log HTTP request details
        console.log(`[DEEP-WEB-SINGLE] 📡 HTTP Request Details:`);
        console.log(`  URL: ${fetchUrl}`);
        console.log(`  Method: ${fetchOptions.method}`);
        console.log(`  Headers:`, {
            'Content-Type': fetchOptions.headers['Content-Type'],
            'Authorization': fetchOptions.headers['Authorization'] ? 'Bearer ***' : 'Not set',
        });
        console.log(`  Timeout: 180000ms (3 minutes)`);
        console.log(`  Body size: ${JSON.stringify(payload).length} bytes`);
        console.log(`  Payload summary:`, {
            reference: payload.reference,
            originCode: payload.originCode,
            url: payload.url,
            method: payload.method,
            requiresLogin: payload.requiresLogin,
            hasLoginSteps: !!payload.loginSteps,
        });

        const requestStartTime = Date.now();
        let response: Response;

        try {
            response = await fetch(fetchUrl, {
                ...fetchOptions,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
            } as any);

            const requestDuration = Date.now() - requestStartTime;
            console.log(`[DEEP-WEB-SINGLE] ✅ HTTP Response received:`);
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log(`  Duration: ${requestDuration}ms`);
            console.log(`  Headers:`, Object.fromEntries(response.headers.entries()));
        } catch (fetchError: any) {
            const requestDuration = Date.now() - requestStartTime;
            console.error(`[DEEP-WEB-SINGLE] ❌ HTTP Request failed:`);
            console.error(`  URL: ${fetchUrl}`);
            console.error(`  Duration: ${requestDuration}ms`);
            console.error(`  Error: ${fetchError.message}`);
            console.error(`  Error code: ${fetchError.cause?.code || 'N/A'}`);
            console.error(`  Error name: ${fetchError.name || 'N/A'}`);

            // Check if it's a connection timeout
            if (fetchError.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || fetchError.name === 'ConnectTimeoutError') {
                console.error(`  ⚠️ Connection timeout - Service may not be running or reachable`);
                console.error(`  💡 Troubleshooting:`);
                console.error(`     - Verify Deep Search Service is running on ${serviceUrl}`);
                console.error(`     - Check if port 3001 is accessible`);
                console.error(`     - Verify DEEP_SEARCH_SERVICE_URL environment variable`);
                console.error(`     - Check network connectivity`);
            }

            if (fetchError.cause) {
                console.error(`  Cause details:`, {
                    code: fetchError.cause.code,
                    message: fetchError.cause.message,
                    name: fetchError.cause.name,
                });
            }

            // Re-throw with more context
            const enhancedError = new Error(
                `Failed to connect to Deep Search Service at ${fetchUrl}: ${fetchError.message}`
            );
            (enhancedError as any).cause = fetchError.cause;
            (enhancedError as any).originalError = fetchError;
            throw enhancedError;
        }

        if (!response.ok) {
            // Handle different error status codes
            let errorMessage = 'Service error';

            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const error = await response.json();
                    errorMessage = error.error || error.message || 'Service error';
                } else {
                    // Response is not JSON (likely HTML error page for 502, etc.)
                    if (response.status === 502) {
                        errorMessage = 'Deep Search Service is unavailable (502 Bad Gateway). The service may be down or unreachable.';
                    } else if (response.status === 503) {
                        errorMessage = 'Deep Search Service is temporarily unavailable (503 Service Unavailable).';
                    } else if (response.status === 504) {
                        errorMessage = 'Deep Search Service request timed out (504 Gateway Timeout).';
                    } else {
                        errorMessage = `Service returned ${response.status} ${response.statusText}`;
                    }
                }


            } catch (parseError) {
                // If we can't parse the error, use status-based message
                if (response.status === 502) {
                    errorMessage = 'Deep Search Service is unavailable (502 Bad Gateway)';
                } else if (response.status === 503) {
                    errorMessage = 'Deep Search Service is temporarily unavailable (503 Service Unavailable)';
                } else if (response.status === 504) {
                    errorMessage = 'Deep Search Service request timed out (504 Gateway Timeout)';
                } else {
                    errorMessage = `Service error: ${response.status} ${response.statusText}`;
                }
            }

            console.error(`[DEEP-WEB-SINGLE] Service returned error:`, {
                status: response.status,
                statusText: response.statusText,
                errorMessage,
            });

            // Return error response instead of throwing
            return NextResponse.json(
                {
                    success: false,
                    originCode: originCodeUpper,
                    originName: endpoint.name,
                    error: errorMessage,
                    products: [],
                    productCount: 0,
                },
                { status: 200 } // Return 200 with success:false so frontend can handle it gracefully
            );
        }

        const data = await response.json();

        if (data.success && data.products) {
            // Get client's profit value (divisor) for this source
            let profitValue = 0.6; // Default (current behavior: price / 0.6)

            if (clientId) {
                try {
                    const client = await prisma.users.findUnique({
                        where: { id: clientId },
                        select: { sourceConfig: true },
                    });

                    if (client?.sourceConfig) {
                        // Properly parse and validate the JSON value from Prisma
                        const config = client.sourceConfig as unknown as ClientSourceConfig;
                        if (config && typeof config === 'object' && 'sources' in config && Array.isArray(config.sources)) {
                            const sourceConfig = config.sources.find(
                                (s) => s.originCode === originCodeUpper && s.enabled
                            );
                            if (sourceConfig) {
                                profitValue = sourceConfig.profitValue;
                                console.log(`💰 [${endpoint.originCode}] Using client profit divisor: ${profitValue} (price / ${profitValue})`);
                            } else {
                                console.log(`💰 [${endpoint.originCode}] Source not enabled for client, using default: 0.6`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching client source config:`, error);
                    // Fall back to default
                }
            }

            // Apply price markup with client's profit divisor: price / profitValue
            const products = data.products.map((product: Product) => {
                if (product.price && product.price > 0) {
                    const originalPrice = product.price;
                    product.price = calculatePriceWithProfit(product.price, profitValue);
                    console.log(`💰 [${endpoint.originCode}] ${product.reference}: ${originalPrice} → ${product.price} (÷ ${profitValue})`);
                }
                return product;
            });

            // Sort by stock availability
            products.sort((a: Product, b: Product) => {
                if (a.hasStock && !b.hasStock) return -1;
                if (!a.hasStock && b.hasStock) return 1;
                if (a.hasStock && b.hasStock) {
                    return (b.stock || 0) - (a.stock || 0);
                }
                return 0;
            });

            console.log(`✅ [${endpoint.originCode}] Returning ${products.length} products successfully`);

            return NextResponse.json({
                success: true,
                originCode: endpoint.originCode,
                originName: endpoint.name,
                products: products,
                productCount: products.length,
                metadata: data.metadata || {},
            });
        } else {
            return NextResponse.json({
                success: false,
                originCode: endpoint.originCode,
                originName: endpoint.name,
                error: data.error || 'Unknown error',
                products: [],
                productCount: 0,
            });
        }
    } catch (error: any) {
        console.error(`[DEEP-WEB-SINGLE] Error searching ${originCodeForError ?? 'unknown'}:`, error);
        return NextResponse.json(
            {
                success: false,
                originCode: originCodeForError ?? 'unknown',
                error: error.message || 'Internal server error',
                products: [],
                productCount: 0,
            },
            { status: 500 }
        );
    }
}
