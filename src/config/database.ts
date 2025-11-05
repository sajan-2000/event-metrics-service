import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

export const connectDatabase = async (): Promise<void> => {
  let retries = 0;

  const connect = async (): Promise<void> => {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info('MongoDB connected successfully', {
        uri: env.MONGODB_URI.replace(/:[^:]+@/, ':****@'),
      });

      // Setup connection event handlers
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', { error: error.message });
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      // Create indexes
      await createIndexes();
    } catch (error) {
      retries++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (retries >= MAX_RETRIES) {
        logger.error('Failed to connect to MongoDB after max retries', {
          retries,
          error: errorMessage,
        });
        throw error;
      }

      logger.warn(`MongoDB connection attempt ${retries} failed, retrying...`, {
        retries,
        error: errorMessage,
        nextRetryIn: `${RETRY_DELAY}ms`,
      });

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return connect();
    }
  };

  await connect();
};

const createIndexes = async (): Promise<void> => {
  try {
    const Event = (await import('../models/Event.model')).default;
    const Metric = (await import('../models/Metric.model')).default;
    const Batch = (await import('../models/Batch.model')).default;

    // Event indexes
    await Event.createIndexes();
    await Event.collection.createIndex({ batchId: 1, processed: 1 });
    await Event.collection.createIndex({ timestamp: 1, eventType: 1 });
    await Event.collection.createIndex({ idempotencyKey: 1 }, { unique: true });
    await Event.collection.createIndex({ createdAt: 1 });

    // Metric indexes
    await Metric.createIndexes();
    await Metric.collection.createIndex(
      { date: 1, eventType: 1 },
      { unique: true }
    );

    // Batch indexes
    await Batch.createIndexes();
    await Batch.collection.createIndex({ batchId: 1 }, { unique: true });
    await Batch.collection.createIndex({ status: 1, uploadedAt: -1 });

    logger.info('MongoDB indexes created successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create MongoDB indexes', { error: errorMessage });
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error disconnecting from MongoDB', { error: errorMessage });
  }
};

