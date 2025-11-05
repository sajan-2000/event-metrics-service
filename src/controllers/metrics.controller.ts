import { Response } from 'express';
import { getMetrics as getMetricsService } from '../services/metric.service';
import logger from '../utils/logger';
import { RequestWithCorrelationId } from '../middleware/correlation-id.middleware';

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Get metrics for a specific date
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\\d{4}-\\d{2}-\\d{2}$'
 *           example: '2024-01-15'
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetricsResponse'
 *       400:
 *         description: Invalid date format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getMetrics = async (
  req: RequestWithCorrelationId,
  res: Response
): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  const { date } = req.query || {};

  try {
    logger.info('Metrics retrieval requested', {
      correlationId,
      date: date || 'today',
    });

    // Call service to handle business logic
    const dateStr = date && typeof date === 'string' ? date : undefined;
    const result = await getMetricsService(dateStr);

    logger.debug('Metrics retrieved', {
      correlationId,
      date: result.date,
      metricCount: result.metrics.length,
    });

    res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle validation errors
    if (errorMessage.includes('Invalid date format')) {
      res.status(400).json({
        error: 'Bad Request',
        message: errorMessage,
      });
      return;
    }

    // Other errors will be handled by error middleware
    throw error;
  }
};

