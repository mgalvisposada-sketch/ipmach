import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

/**
 * Request validation middleware
 * Validates DeepSearchRequest payload
 */

// Allowed origin codes (for validation)
const ALLOWED_ORIGIN_CODES = [
  'AGROCOSTA',
  'GECOLSA',
  'PARTEQUIPOS',
  'RETROTRAC',
  'SERVITRACTOR',
  'IMPORTADORAGRANANDINA',
  'DONSSON',
  'MONTECARLO',
];

// Allowed domains (for SSRF prevention)
const ALLOWED_DOMAINS = [
  'agro-costa.com',
  'gecolsa.com',
  'partequipos.com',
  'retrotrac.com',
  'empresaservitractor.zohocreatorportal.com',
  'importadoragranandina.com',
  'parts.cat.com',  // GECOLSA parts store
  'signin.cat.com', // GECOLSA OAuth login
  'cat.com',        // Caterpillar domain (for any cat.com subdomain)
  'donsson.com',    // DONSSON domain
  'portal.imm.com.co', // MONTECARLO domain
  'imm.com.co',     // MONTECARLO base domain
];

interface DeepSearchRequest {
  reference: string;
  originCode: string;
  originName: string;
  url: string;
  method: 'GET' | 'POST';
  requiresLogin?: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  loginSteps?: any[]; // Combined login+search steps
  timeoutMs?: number;
  retryAttempts?: number;
  waitForSelector?: string;
  parserConfig?: any;
  token?: string;
  tokenHeaderName?: string;
  tokenPlacement?: 'header' | 'query' | 'body';
  requestBodyTemplate?: string;
  cookies?: string;
}

function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check if hostname is in allowed domains
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function validateReference(reference: string): boolean {
  // Reference should be 1-100 chars, alphanumeric + dash/underscore
  if (!reference || reference.length === 0 || reference.length > 100) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(reference);
}

export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as DeepSearchRequest;

  // Validate required fields
  if (!body.reference || typeof body.reference !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Reference is required and must be a string',
    });
    return;
  }

  if (!validateReference(body.reference)) {
    res.status(400).json({
      success: false,
      error: 'Invalid reference format. Must be 1-100 alphanumeric characters',
    });
    return;
  }

  if (!body.originCode || typeof body.originCode !== 'string') {
    res.status(400).json({
      success: false,
      error: 'originCode is required',
    });
    return;
  }

  // Validate origin code
  if (!ALLOWED_ORIGIN_CODES.includes(body.originCode.toUpperCase())) {
    res.status(400).json({
      success: false,
      error: `Invalid originCode: ${body.originCode}. Allowed: ${ALLOWED_ORIGIN_CODES.join(', ')}`,
    });
    return;
  }

  if (!body.url || typeof body.url !== 'string') {
    res.status(400).json({
      success: false,
      error: 'url is required',
    });
    return;
  }

  // Validate URL format and prevent SSRF
  if (!validateUrl(body.url)) {
    res.status(400).json({
      success: false,
      error: 'Invalid URL or domain not allowed (SSRF prevention)',
    });
    return;
  }

  if (!body.method || !['GET', 'POST'].includes(body.method)) {
    res.status(400).json({
      success: false,
      error: 'method must be GET or POST',
    });
    return;
  }

  // Validate timeout
  if (body.timeoutMs !== undefined) {
    const maxTimeout = 120000; // 2 minutes max
    const minTimeout = 1000; // 1 second min
    if (body.timeoutMs < minTimeout || body.timeoutMs > maxTimeout) {
      res.status(400).json({
        success: false,
        error: `timeoutMs must be between ${minTimeout} and ${maxTimeout}`,
      });
      return;
    }
  }

  // Validate retry attempts
  if (body.retryAttempts !== undefined && (body.retryAttempts < 0 || body.retryAttempts > 5)) {
    res.status(400).json({
      success: false,
      error: 'retryAttempts must be between 0 and 5',
    });
    return;
  }

  // Validate login steps array
  if (body.loginSteps && !Array.isArray(body.loginSteps)) {
    res.status(400).json({
      success: false,
      error: 'loginSteps must be an array',
    });
    return;
  }

  if (body.loginSteps && body.loginSteps.length > 50) {
    res.status(400).json({
      success: false,
      error: 'loginSteps array cannot exceed 50 steps',
    });
    return;
  }


  // Validation passed
  next();
}

