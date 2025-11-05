import { Queue, QueueOptions } from 'bullmq';
import env from '../config/env';
import { JobData } from '../types';
import logger from '../utils/logger';

const QUEUE_NAME = 'event-processing';

export class QueueService {
  private queue: Queue<JobData>;

  constructor() {
    const connection = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    };

    const queueOptions: QueueOptions = {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1 second
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    };

    this.queue = new Queue<JobData>(QUEUE_NAME, queueOptions);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Only handle queue-level errors here
    // Job-level events (active, completed, failed) are handled by the Worker
    this.queue.on('error', (error) => {
      logger.error('Queue error', { error: error.message });
    });
  }

  /**
   * Add jobs to queue for processing events
   */
  async enqueueEventProcessingJobs(
    batchId: string,
    eventIdBatches: string[][],
    correlationId: string
  ): Promise<number> {
    try {
      const jobs = eventIdBatches.map((eventIds) => ({
        name: 'process-events',
        data: {
          batchId,
          eventIds,
          correlationId,
        },
      }));

      await this.queue.addBulk(jobs);

      logger.info('Event processing jobs enqueued', {
        batchId,
        jobsCount: jobs.length,
      });

      return jobs.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error enqueuing jobs', {
        batchId,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting queue stats', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get failed jobs from DLQ
   */
  async getFailedJobs(limit = 100) {
    try {
      const failedJobs = await this.queue.getFailed(0, limit - 1);
      return failedJobs.map((job) => ({
        id: job.id || 'unknown',
        data: job.data,
        error: job.failedReason,
        failedReason: job.failedReason,
        timestamp: job.timestamp || Date.now(),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting failed jobs', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get queue instance (for worker)
   */
  getQueue(): Queue<JobData> {
    return this.queue;
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Queue closed');
  }
}

// Singleton instance
let queueService: QueueService;

export const getQueueService = (): QueueService => {
  if (!queueService) {
    queueService = new QueueService();
  }
  return queueService;
};

