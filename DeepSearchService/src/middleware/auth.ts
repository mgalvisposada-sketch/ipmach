import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

/**
 * API Key authentication middleware
 * Validates Authorization header with Bearer token
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development if API_KEY not set
  if (config.nodeEnv === 'development' && !config.apiKey) {
    console.warn('⚠️  API Key auth disabled in development (no API_KEY set)');
    return next();
  }

  // Get Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Missing Authorization header',
    });
    return;
  }

  // Extract Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: 'Invalid Authorization header format. Expected: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  // Validate token
  if (token !== config.apiKey) {
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  // Authentication successful
  next();
}

