import { getQueueService } from './queue';
import logger from '../utils/logger';
import { DLQResponse } from '../types';

/**
 * Get failed jobs from Dead Letter Queue
 */
export const getDLQJobs = async (
  queueName: string,
  limit: number,
  correlationId: string
): Promise<DLQResponse> => {
  logger.info('DLQ access requested', {
    correlationId,
    queueName,
    limit,
  });

  // Validate queue name
  if (queueName !== 'event-processing') {
    throw new Error(`Unknown queue: ${queueName}`);
  }

  const queueService = getQueueService();
  const failedJobs = await queueService.getFailedJobs(limit);

  logger.debug('DLQ retrieved', {
    correlationId,
    queueName,
    failedJobCount: failedJobs.length,
  });

  return {
    queueName,
    failedJobs,
  };
};

