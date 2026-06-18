import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';

/**
 * Global rate limiter
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-origin rate limiter factory
 */
const originRateLimiters = new Map<string, ReturnType<typeof rateLimit>>();

export function getOriginRateLimiter(originCode: string) {
  if (!originRateLimiters.has(originCode)) {
    originRateLimiters.set(
      originCode,
      rateLimit({
        windowMs: config.rateLimitWindowMs,
        max: config.rateLimitPerOriginMax,
        message: {
          success: false,
          error: `Rate limit exceeded for ${originCode}. Please try again later`,
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          // Use origin code + IP for per-origin limiting
          return `${originCode}:${req.ip}`;
        },
      })
    );
  }
  return originRateLimiters.get(originCode)!;
}

