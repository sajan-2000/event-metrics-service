import { Worker, Job } from 'bullmq';
import env from '../config/env';
import { getRedisClient } from '../config/redis';
import { JobData, Event } from '../types';
import { getUnprocessedEvents, markEventsAsProcessed, updateBatchStatus } from '../utils/event.utils';
import { aggregateMetrics, isEventProcessed } from '../services/metric.service';
import logger from '../utils/logger';
import EventModel from '../models/Event.model';
import { v4 as uuidv4 } from 'uuid';

const WORKER_CONCURRENCY = 10;
const EVENTS_PER_JOB = 100;

class EventProcessorWorker {
  private worker: Worker<JobData>;

  constructor() {
    const connection = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    };

    this.worker = new Worker<JobData>(
      'event-processing',
      async (job: Job<JobData>) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: WORKER_CONCURRENCY,
        limiter: {
          max: 100,
          duration: 1000,
        },
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info('Worker job completed', {
        jobId: job.id,
        batchId: job.data.batchId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Worker job failed', {
        jobId: job?.id,
        batchId: job?.data.batchId,
        error: error.message,
        stack: error.stack,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
    });
  }

  private async processJob(job: Job<JobData>): Promise<void> {
    // const correlationId = uuidv4();
    const correlationId = job.data.correlationId || uuidv4();
    const startTime = Date.now();
    const { batchId, eventIds } = job.data;

    logger.info('Processing event batch job', {
      correlationId,
      jobId: job.id,
      batchId,
      eventCount: eventIds.length,
    });

    try {
      // Fetch events from database
      const events = await EventModel.find({
        _id: { $in: eventIds },
        processed: false,
      }).lean();

      if (events.length === 0) {
        logger.warn('No unprocessed events found for job', {
          correlationId,
          jobId: job.id,
          batchId,
        });
        return;
      }

      // Check idempotency and filter out already processed events
      const eventsToProcess: Event[] = [];
      for (const event of events) {
        const alreadyProcessed = await isEventProcessed(event.idempotencyKey);
        if (!alreadyProcessed && !event.processed) {
          eventsToProcess.push(event as Event);
        }
      }

      if (eventsToProcess.length === 0) {
        logger.warn('All events already processed', {
          correlationId,
          jobId: job.id,
          batchId,
        });
        // Mark events as processed even if skipped
        await markEventsAsProcessed(eventIds, correlationId);
        return;
      }

      // Aggregate metrics
      await aggregateMetrics(eventsToProcess, correlationId);

      // Mark events as processed
      await markEventsAsProcessed(
        eventsToProcess.map((e) => e._id!.toString()),
        correlationId
      );

      // Update batch status (check if all events in batch are processed)
      await this.updateBatchProgress(batchId, eventsToProcess.length, correlationId);

      const duration = Date.now() - startTime;
      logger.info('Event batch processed successfully', {
        correlationId,
        jobId: job.id,
        batchId,
        eventsProcessed: eventsToProcess.length,
        duration: `${duration}ms`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      logger.error('Error processing event batch', {
        correlationId,
        jobId: job.id,
        batchId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
      });

      // Determine if error is transient (should retry) or fatal (move to DLQ)
      const isTransientError = this.isTransientError(error);

      if (!isTransientError) {
        // Fatal error - will be moved to DLQ
        throw new Error(`Fatal error: ${errorMessage}`);
      }

      // Transient error - will be retried by BullMQ
      throw error;
    }
  }

  private isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const transientPatterns = [
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'network',
      'connection',
    ];

    const errorMessage = error.message.toLowerCase();
    return transientPatterns.some((pattern) => errorMessage.includes(pattern));
  }

  private async updateBatchProgress(
    batchId: string,
    processedCount: number,
    correlationId: string
  ): Promise<void> {
    try {
      const Batch = (await import('../models/Batch.model')).default;
      const Event = (await import('../models/Event.model')).default;

      const batch = await Batch.findOne({ batchId });
      if (!batch) {
        return;
      }

      // Count total processed events for this batch
      const totalProcessed = await Event.countDocuments({
        batchId,
        processed: true,
      });

      const updateData: {
        processedEvents: number;
        status?: string;
        processedAt?: Date;
      } = {
        processedEvents: totalProcessed,
      };

      if (totalProcessed >= batch.totalEvents) {
        updateData.status = 'completed';
        updateData.processedAt = new Date();
      } else if (batch.status === 'uploaded') {
        updateData.status = 'processing';
      }

      await Batch.updateOne({ batchId }, { $set: updateData });

      logger.debug('Batch progress updated', {
        correlationId,
        batchId,
        totalProcessed,
        totalEvents: batch.totalEvents,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error updating batch progress', {
        correlationId,
        batchId,
        error: errorMessage,
      });
      // Don't throw - this is not critical for job completion
    }
  }

  /**
   * Close worker connection
   */
  async close(): Promise<void> {
    await this.worker.close();
    logger.info('Worker closed');
  }
}

// Singleton instance
let worker: EventProcessorWorker;

export const startWorker = (): EventProcessorWorker => {
  if (!worker) {
    worker = new EventProcessorWorker();
    logger.info('Event processor worker started', {
      concurrency: WORKER_CONCURRENCY,
    });
  }
  return worker;
};

export const stopWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null as unknown as EventProcessorWorker;
  }
};

