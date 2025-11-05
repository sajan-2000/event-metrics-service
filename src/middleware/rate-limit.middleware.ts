import rateLimit from 'express-rate-limit';
import env from '../config/env';
import logger from '../utils/logger';

/**
 * Rate limiter for CSV uploads
 * Default: 10 uploads per minute per IP
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.UPLOAD_RATE_LIMIT,
  message: 'Too many upload requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Upload rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((req as any).rateLimit.resetTime / 1000),
    });
  },
});

