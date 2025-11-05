import { Response } from 'express';
import { processBatch as processBatchService } from '../services/batch.service';
import { RequestWithCorrelationId } from '../middleware/correlation-id.middleware';

/**
 * @swagger
 * /api/batches/{id}/process:
 *   post:
 *     summary: Process a batch by enqueuing jobs for unprocessed events
 *     tags: [Batches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Batch ID
 *     responses:
 *       202:
 *         description: Batch processing initiated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchProcessResponse'
 *       404:
 *         description: Batch not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const processBatch = async (
  req: RequestWithCorrelationId,
  res: Response
): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  const { id: batchId } = req.params;

  try {
    // Call service to handle business logic
    const result = await processBatchService(batchId, correlationId);

    // Determine status code based on result
    const statusCode = result.jobsEnqueued === 0 ? 200 : 202;

    res.status(statusCode).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle "not found" error
    if (errorMessage.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: errorMessage,
      });
      return;
    }

    // Other errors will be handled by error middleware
    throw error;
  }
};

