import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

/**
 * Request logging middleware
 * Masks sensitive data in logs
 */
function sanitizeLog(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };

  // Mask sensitive fields
  const sensitiveFields = [
    'loginPassword',
    'password',
    'token',
    'apiKey',
    'authorization',
    'cookie',
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLog(sanitized[key]);
    }
  }

  return sanitized;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request (sanitized)
  if (config.logSensitiveData) {
    console.log('Request:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      body: req.body,
    });
  } else {
    console.log('Request:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      body: sanitizeLog(req.body),
    });
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log('Response:', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}

