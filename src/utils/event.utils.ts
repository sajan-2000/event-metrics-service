import Event from '../models/Event.model';
import Batch from '../models/Batch.model';
import { Event as EventType, CSVRow } from '../types';
import { generateIdempotencyKey } from './idempotency';
import logger from './logger';

/**
 * Create events from CSV rows and save to database
 */
export const createEventsFromCSV = async (
  batchId: string,
  rows: CSVRow[],
  correlationId?: string
): Promise<number> => {
  try {
    const events: Array<Omit<EventType, '_id'>> = [];
    const now = new Date();

    for (const row of rows) {
      const timestamp = new Date(row.timestamp);
      const idempotencyKey = generateIdempotencyKey(row.userId, row.eventType, timestamp);

      // Extract metadata (all columns except userId, eventType, timestamp)
      const metadata: Record<string, unknown> = {};
      Object.keys(row).forEach((key) => {
        const keyLower = key.toLowerCase().trim();
        if (!['userid', 'eventtype', 'timestamp'].includes(keyLower)) {
          metadata[key] = row[key];
        }
      });

      events.push({
        batchId,
        eventType: row.eventType.trim(),
        userId: row.userId.trim(),
        timestamp,
        metadata,
        processed: false,
        idempotencyKey,
        createdAt: now,
      });
    }

    // Use bulk write with ordered: false to continue on duplicate key errors
    const bulkOps = events.map((event) => ({
      updateOne: {
        filter: { idempotencyKey: event.idempotencyKey },
        update: { $setOnInsert: event },
        upsert: true,
      },
    }));

    const result = await Event.bulkWrite(bulkOps, { ordered: false });

    const insertedCount = result.upsertedCount || 0;

    logger.info('Events created from CSV', {
      correlationId,
      batchId,
      totalRows: rows.length,
      insertedCount,
      duplicateCount: rows.length - insertedCount,
    });

    return insertedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating events from CSV', {
      correlationId,
      batchId,
      error: errorMessage,
    });
    throw error;
  }
};

/**
 * Get unprocessed events for a batch
 */
export const getUnprocessedEvents = async (
  batchId: string,
  limit = 100
): Promise<EventType[]> => {
  try {
    const events = await Event.find({
      batchId,
      processed: false,
    })
      .limit(limit)
      .lean();

    // Convert Mongoose lean documents to Event type
    return events.map((e: any) => ({
      ...e,
      _id: e._id?.toString() || e._id,
    })) as EventType[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting unprocessed events', {
      batchId,
      error: errorMessage,
    });
    throw error;
  }
};

/**
 * Mark events as processed
 */
export const markEventsAsProcessed = async (
  eventIds: string[],
  correlationId?: string
): Promise<void> => {
  try {
    await Event.updateMany(
      { _id: { $in: eventIds } },
      { $set: { processed: true } }
    );

    logger.debug('Events marked as processed', {
      correlationId,
      eventCount: eventIds.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error marking events as processed', {
      correlationId,
      error: errorMessage,
    });
    throw error;
  }
};

/**
 * Update batch status
 */
export const updateBatchStatus = async (
  batchId: string,
  status: 'uploaded' | 'processing' | 'completed' | 'failed',
  processedEvents?: number
): Promise<void> => {
  try {
    const update: {
      status: string;
      processedEvents?: number;
      processedAt?: Date;
    } = { status };

    if (processedEvents !== undefined) {
      update.processedEvents = processedEvents;
    }

    if (status === 'completed' || status === 'failed') {
      update.processedAt = new Date();
    }

    await Batch.updateOne({ batchId }, { $set: update });

    logger.debug('Batch status updated', {
      batchId,
      status,
      processedEvents,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating batch status', {
      batchId,
      error: errorMessage,
    });
    throw error;
  }
};

/**
 * Get batch by batchId
 */
export const getBatch = async (batchId: string) => {
  try {
    const batch = await Batch.findOne({ batchId }).lean();
    return batch;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting batch', {
      batchId,
      error: errorMessage,
    });
    throw error;
  }
};

