import { getBatch, getUnprocessedEvents, updateBatchStatus } from '../utils/event.utils';
import { getQueueService } from '../infrastructure/queue';
import logger from '../utils/logger';
import { BatchProcessResponse } from '../types';

const EVENTS_PER_JOB = 100;

/**
 * Process batch by enqueuing jobs for unprocessed events
 */
export const processBatch = async (
  batchId: string,
  correlationId: string
): Promise<BatchProcessResponse> => {
  const startTime = Date.now();

  logger.info('Batch processing requested', {
    correlationId,
    batchId,
  });

  // Validate batch exists
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error(`Batch with ID ${batchId} not found`);
  }

  // Get unprocessed events
  const unprocessedEvents = await getUnprocessedEvents(batchId, 10000); // Limit to 10k for now

  if (unprocessedEvents.length === 0) {
    return {
      batchId,
      jobsEnqueued: 0,
      message: 'No unprocessed events found in batch',
    };
  }

  // Batch event IDs into groups for efficient job processing
  const eventIdBatches: string[][] = [];
  for (let i = 0; i < unprocessedEvents.length; i += EVENTS_PER_JOB) {
    const batch = unprocessedEvents
      .slice(i, i + EVENTS_PER_JOB)
      .map((e) => e._id!.toString());
    eventIdBatches.push(batch);
  }

  // Enqueue jobs
  const queueService = getQueueService();
  const jobsEnqueued = await queueService.enqueueEventProcessingJobs(
    batchId,
    eventIdBatches,
    correlationId
  );

  // Update batch status to processing
  await updateBatchStatus(batchId, 'processing');

  const duration = Date.now() - startTime;

  logger.info('Batch processing initiated', {
    correlationId,
    batchId,
    jobsEnqueued,
    totalEvents: unprocessedEvents.length,
    duration: `${duration}ms`,
  });

  return {
    batchId,
    jobsEnqueued,
    message: `Successfully enqueued ${jobsEnqueued} jobs for processing`,
  };
};

