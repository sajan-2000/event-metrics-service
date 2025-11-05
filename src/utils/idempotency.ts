import { createHash } from 'crypto';

/**
 * Generate an idempotency key from event data
 * This ensures that duplicate events (same userId, eventType, timestamp) are not processed twice
 */
export const generateIdempotencyKey = (
  userId: string,
  eventType: string,
  timestamp: Date
): string => {
  const data = `${userId}:${eventType}:${timestamp.toISOString()}`;
  return createHash('sha256').update(data).digest('hex');
};

