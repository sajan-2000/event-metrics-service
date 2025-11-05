import { Response, NextFunction } from 'express';
import env from '../config/env';
import logger from '../utils/logger';
import { RequestWithCorrelationId } from './correlation-id.middleware';

/**
 * Admin authentication middleware using API key
 */
export const adminAuthMiddleware = (
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    logger.warn('Unauthorized admin access attempt', {
      correlationId,
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key required',
      correlationId,
    });
    return;
  }

  next();
};

