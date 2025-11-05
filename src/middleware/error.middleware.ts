import { Request, Response, NextFunction } from 'express';
import { CSVValidationError } from '../validators/csv.validator';
import logger from '../utils/logger';
import { RequestWithCorrelationId } from './correlation-id.middleware';

/**
 * Global error handler middleware
 */
export const errorMiddleware = (
  err: Error,
  req: RequestWithCorrelationId,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';

  // Log error
  logger.error('Request error', {
    correlationId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err instanceof CSVValidationError) {
    res.status(400).json({
      error: 'CSV Validation Failed',
      message: err.message,
      details: err.errors,
    });
    return;
  }

  // Handle MongoDB duplicate key error
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this key already exists',
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    });
    return;
  }

  // Default error response
  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
};

/**
 * 404 handler
 */
export const notFoundMiddleware = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
};

