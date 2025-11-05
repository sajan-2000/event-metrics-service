import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

/**
 * Middleware to add correlation ID to requests
 */
export const correlationIdMiddleware = (
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction
): void => {
  const correlationId =
    (req.headers['x-correlation-id'] as string) || uuidv4();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};

