import Metric from '../models/Metric.model';
import { Event } from '../types';
import logger from '../utils/logger';

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Aggregate metrics from events by date and eventType
 */
export const aggregateMetrics = async (
  events: Event[],
  correlationId?: string
): Promise<void> => {
  try {
    if (events.length === 0) {
      return;
    }

    // Group events by date and eventType
    const metricMap = new Map<string, number>();

    for (const event of events) {
      const date = formatDate(new Date(event.timestamp));
      const key = `${date}:${event.eventType}`;
      metricMap.set(key, (metricMap.get(key) || 0) + 1);
    }

    // Bulk update metrics
    const bulkOps = Array.from(metricMap.entries()).map(([key, count]) => {
      const [date, eventType] = key.split(':');
      return {
        updateOne: {
          filter: { date, eventType },
          update: {
            $inc: { count },
            $set: { lastUpdated: new Date() },
          },
          upsert: true,
        },
      };
    });

    await Metric.bulkWrite(bulkOps);

    logger.debug('Metrics aggregated', {
      correlationId,
      eventsProcessed: events.length,
      metricsUpdated: metricMap.size,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error aggregating metrics', {
      correlationId,
      error: errorMessage,
    });
    throw error;
  }
};

/**
 * Get metrics for a specific date
 */
export const getMetricsByDate = async (date: string) => {
  try {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    const metrics = await Metric.find({ date }).lean();

    return metrics.map((metric) => ({
      eventType: metric.eventType,
      count: metric.count,
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting metrics by date', {
      date,
      error: errorMessage,
    });
    throw error;
  }
};

/**
 * Get metrics for a date (with default to today)
 */
export const getMetrics = async (date?: string) => {
  // Default to today's date if not provided
  let targetDate: string;
  if (date && typeof date === 'string') {
    targetDate = date;
  } else {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    targetDate = `${year}-${month}-${day}`;
  }

  const metrics = await getMetricsByDate(targetDate);

  return {
    date: targetDate,
    metrics,
  };
};

/**
 * Check if event was already processed (idempotency check)
 */
export const isEventProcessed = async (idempotencyKey: string): Promise<boolean> => {
  try {
    const Event = (await import('../models/Event.model')).default;
    const event = await Event.findOne({ idempotencyKey, processed: true }).lean();
    return !!event;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking if event is processed', {
      idempotencyKey,
      error: errorMessage,
    });
    return false;
  }
};

