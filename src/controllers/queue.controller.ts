import { Response } from 'express';
import { getDLQJobs } from '../infrastructure/queue-admin';
import { RequestWithCorrelationId } from '../middleware/correlation-id.middleware';

/**
 * @swagger
 * /api/queues/{name}/dlq:
 *   get:
 *     summary: Get failed jobs from Dead Letter Queue (Admin only)
 *     tags: [Queues]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of failed jobs to return
 *     responses:
 *       200:
 *         description: Failed jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DLQResponse'
 *       401:
 *         description: Unauthorized (invalid or missing API key)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Bad request (unknown queue)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getDLQ = async (
  req: RequestWithCorrelationId,
  res: Response
): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  const { name: queueName } = req.params;
  const limit = parseInt(req.query.limit as string, 10) || 100;

  try {
    // Call service to handle business logic
    const result = await getDLQJobs(queueName, limit, correlationId);

    res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle validation errors
    if (errorMessage.includes('Unknown queue')) {
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

