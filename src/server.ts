import { Server } from 'http';
import app from './app';
import env from './config/env';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { startWorker } from './workers/event-processor.worker';
import logger from './utils/logger';

const PORT = env.PORT;

let server: Server;

// Graceful shutdown handler for SIGTERM and SIGINT
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Close server
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close worker
  try {
    const { stopWorker } = await import('./workers/event-processor.worker');
    await stopWorker();
  } catch (error) {
    logger.error('Error stopping worker', { error });
  }

  // Close Redis
  try {
    const { disconnectRedis } = await import('./config/redis');
    await disconnectRedis();
  } catch (error) {
    logger.error('Error disconnecting Redis', { error });
  }

  // Close MongoDB
  try {
    const { disconnectDatabase } = await import('./config/database');
    await disconnectDatabase();
  } catch (error) {
    logger.error('Error disconnecting database', { error });
  }

  process.exit(0);
};

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis
    connectRedis();

    // Start BullMQ worker
    startWorker();

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`Server started successfully`, {
        port: PORT,
        environment: env.NODE_ENV,
        nodeVersion: process.version,
      });
    });

    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start server', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
};


startServer();

export default server;

