import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

/**
 * Global error handler middleware
 * Sanitizes error messages to prevent information disclosure
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log full error internally
  console.error('[ErrorHandler] Error:', {
    message: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    originCode: (req.body as any)?.originCode || 'UNKNOWN',
  });

  // Determine status code based on error type
  let statusCode = (err as any).statusCode || 500;
  let message = err.message || 'Internal server error';

  // Check for timeout errors
  if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
    statusCode = 504; // Gateway Timeout
    message = config.nodeEnv === 'production'
      ? 'Request timed out. The operation took too long to complete.'
      : err.message;
  }
  // Check for network errors
  else if (err.message?.includes('net::ERR_') || err.message?.includes('Protocol error')) {
    statusCode = 502; // Bad Gateway
    message = config.nodeEnv === 'production'
      ? 'Network error occurred. Please try again later.'
      : err.message;
  }
  // Production mode: sanitize error messages
  else if (config.nodeEnv === 'production') {
    message = 'Internal server error';
  }

  // Ensure response hasn't been sent
  if (!res.headersSent) {
    res.status(statusCode).json({
      success: false,
      error: message,
      originCode: (req.body as any)?.originCode?.toUpperCase() || 'UNKNOWN',
      products: [],
      productCount: 0,
    });
  }
}

