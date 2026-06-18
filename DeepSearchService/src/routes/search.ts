import { Router, Request, Response } from 'express';
import { apiKeyAuth } from '../middleware/auth';
import { scrapeWithPuppeteer } from '../scrapers/scraper';
import { ParserFactory } from '../parsers/ParserFactory';
import { registerParsers } from '../parsers/registerParsers';

const router = Router();

// Register parsers on startup
registerParsers();

/**
 * Endpoint configuration interface
 */
interface EndpointConfig {
  originCode: string;
  originName: string;
  url: string;
  method: 'GET' | 'POST';
  requiresLogin: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  usernameField?: string;
  passwordField?: string;
  loginSteps?: any[];
  timeoutMs: number;
  retryAttempts: number;
  waitForSelector?: string;
  parserConfig?: any;
  cookies?: string;
  reference: string; // Search term
}

/**
 * POST /search
 * Accepts full endpoint configuration in request body
 * 
 * Request body:
 * {
 *   reference: string,        // Search term (e.g., "1R0750")
 *   originCode: string,      // Origin code (e.g., "RETROTRAC")
 *   originName: string,       // Origin name
 *   url: string,              // Base URL
 *   method: 'GET' | 'POST',   // HTTP method
 *   requiresLogin: boolean,   // Whether login is required
 *   loginUrl?: string,        // Login URL
 *   loginUsername?: string,   // Login username
 *   loginPassword?: string,   // Login password
 *   loginSteps?: any[],       // Login/search steps
 *   timeoutMs: number,         // Timeout in milliseconds
 *   retryAttempts: number,    // Number of retry attempts
 *   waitForSelector?: string, // Selector to wait for
 *   parserConfig?: any,       // Parser configuration
 *   cookies?: string,         // Cookies string
 *   ... other fields
 * }
 */
router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const requestStartTime = Date.now();
  
  try {
    const body = req.body as EndpointConfig;
    const { reference, originCode } = body;

    // Validate required fields
    if (!reference || typeof reference !== 'string' || reference.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Reference is required and must be a non-empty string',
        products: [],
        productCount: 0,
      });
    }

    if (!originCode || typeof originCode !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'originCode is required and must be a string',
        products: [],
        productCount: 0,
      });
    }

    const searchTerm = reference.trim();
    const code = originCode.toUpperCase().trim();

    console.log(`[DeepSearchService] 📥 Search request:`, {
      originCode: code,
      reference: searchTerm,
      hasLoginSteps: !!body.loginSteps,
      loginStepsCount: body.loginSteps?.length || 0,
    });

    // Calculate maximum timeout (use config timeout + buffer, max 3 minutes)
    const maxTimeout = Math.min((body.timeoutMs || 120000) + 60000, 180000); // Config timeout + 60s buffer, max 3min
    console.log(`[DeepSearchService] ⏱️  Timeout configuration:`, {
      configTimeout: body.timeoutMs || 120000,
      maxTimeout: maxTimeout,
      timeoutMs: `${maxTimeout}ms (${Math.round(maxTimeout / 1000)}s)`,
    });

    // Prepare config for scraper
    const config = {
      originCode: code,
      name: body.originName || code,
      url: body.url || '',
      method: (body.method || 'GET') as 'GET' | 'POST',
      requiresLogin: body.requiresLogin || false,
      loginUrl: body.loginUrl || null,
      loginUsername: body.loginUsername || null,
      loginPassword: body.loginPassword || null,
      usernameField: body.usernameField || null,
      passwordField: body.passwordField || null,
      loginSteps: body.loginSteps || null,
      timeoutMs: body.timeoutMs || 40000,
      retryAttempts: body.retryAttempts || 1,
      waitForSelector: body.waitForSelector || null,
      parserConfig: body.parserConfig || {},
      cookies: body.cookies || undefined,
    };

    // Special handling for IMPORTADORAGRANANDINA: use direct HTTP fetch instead of Puppeteer
    let content: string | object;
    
    if (code === 'IMPORTADORAGRANANDINA') {
      console.log('📦 [IMPORTADORAGRANANDINA] Using direct HTTP fetch (no Puppeteer)');
      
      try {
        // Extract cookies from parserConfig
        const cookies = config.parserConfig?.cookies || config.cookies;
        
        // Build headers
        const headers: Record<string, string> = {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        
        if (cookies) {
          headers['Cookie'] = cookies;
        }
        
        // Make the request
        const response = await fetch(config.url, {
          method: config.method || 'GET',
          headers,
          signal: AbortSignal.timeout(config.timeoutMs || 40000),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Get response as text (might be HTML or JSON)
        content = await response.text();
        
        console.log(`✅ [IMPORTADORAGRANANDINA] Fetched ${content.length} bytes from ${config.url}`);
      } catch (error: any) {
        console.error(`❌ [IMPORTADORAGRANANDINA] HTTP fetch failed:`, error.message);
        throw error;
      }
    } else {
      // Use Puppeteer for other endpoints
      // Wrap in timeout to prevent hanging requests that cause 502 errors
      console.log(`[DeepSearchService] 🚀 Starting Puppeteer scrape with ${maxTimeout}ms timeout...`);
      const scrapePromise = scrapeWithPuppeteer(config, searchTerm);
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Scraping operation timed out after ${maxTimeout}ms (${Math.round(maxTimeout / 1000)}s)`));
        }, maxTimeout);
      });
      
      try {
        content = await Promise.race([scrapePromise, timeoutPromise]);
        console.log(`[DeepSearchService] ✅ Scraping completed successfully`);
      } catch (scrapeError: any) {
        console.error(`[DeepSearchService] ❌ Scraping failed:`, scrapeError.message);
        throw scrapeError;
      }
    }

    // Parse content
    let parseResult;

    // Use OpenAI for Servitractor and Retrotrac (if API key is available and valid)
    if ((code === 'SERVITRACTOR' || code === 'RETROTRAC') && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-test-key') {
      try {
        const extractorName = code === 'SERVITRACTOR' ? 'extractServitractorData' : 'extractRetrotracData';
        const { [extractorName]: extractData } = await import('../utils/openai-extractor');
        
        const openaiResult = await extractData(content, searchTerm, {
          apiKey: process.env.OPENAI_API_KEY,
        });

        parseResult = {
          originCode: code,
          originName: config.name,
          searchTerm,
          products: openaiResult.products.map((p: any) => ({
            ...p,
            origin: code,
          })),
          metadata: {
            extractedBy: 'openai',
            totalFound: openaiResult.products.length,
          },
        };
      } catch (openaiError: any) {
        console.warn(`⚠️ [DeepSearchService] OpenAI extraction failed for ${code}, falling back to regular parser:`, openaiError.message);
        // Fall through to regular parser
        const parser = await ParserFactory.getParser({
          originCode: code,
          name: config.name,
          parserConfig: config.parserConfig || {},
        });
        parseResult = await parser.parse(content, searchTerm);
      }
    } else {
      // Use parser factory for other origins or when OpenAI is not available
      const parser = await ParserFactory.getParser({
        originCode: code,
        name: config.name,
        parserConfig: config.parserConfig || {},
      });

      parseResult = await parser.parse(content, searchTerm);
    }

    const requestDuration = Date.now() - requestStartTime;
    console.log(`✅ [${code}] Returning ${parseResult.products.length} products (duration: ${requestDuration}ms)`);

    return res.json({
      success: true,
      originCode: code,
      originName: config.name,
      products: parseResult.products,
      productCount: parseResult.products.length,
      metadata: parseResult.metadata || {},
    });
  } catch (error: any) {
    const requestDuration = Date.now() - requestStartTime;
    const originCode = req.body?.originCode?.toUpperCase() || 'UNKNOWN';
    
    console.error(`[DeepSearchService] Error after ${requestDuration}ms:`, error);
    console.error(`[DeepSearchService] Error stack:`, error.stack);
    
    // Determine error type and status code
    const isTimeout = error.message?.includes('timeout') || error.message?.includes('Timeout');
    const isNetworkError = error.message?.includes('net::ERR_') || error.message?.includes('Protocol error');
    
    const statusCode = isTimeout ? 504 : 500;
    const errorMessage = isTimeout 
      ? `Request timed out after ${requestDuration}ms. The scraping operation took too long.`
      : (error.message || 'Internal server error');
    
    return res.status(statusCode).json({
      success: false,
      originCode: originCode,
      error: errorMessage,
      products: [],
      productCount: 0,
      metadata: {
        duration: requestDuration,
        errorType: isTimeout ? 'timeout' : (isNetworkError ? 'network' : 'unknown'),
      },
    });
  }
});

export { router as searchRouter };

