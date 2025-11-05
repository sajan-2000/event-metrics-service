import Redis, { RedisOptions } from 'ioredis';  // ✅ CHANGED
import env from './env';
import logger from '../utils/logger';


let redisClient: Redis;


export const connectRedis = (): Redis => {
  if (redisClient) {
    return redisClient;
  }


  const redisConfig: RedisOptions = {  // ✅ CHANGED
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };


  if (env.REDIS_PASSWORD) {
    redisConfig.password = env.REDIS_PASSWORD;
  }


  redisClient = new Redis(redisConfig);


  redisClient.on('connect', () => {
    logger.info('Redis connected successfully', {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });
  });


  redisClient.on('error', (error) => {
    logger.error('Redis connection error', { error: error.message });
  });


  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });


  return redisClient;
};


export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
};


export const getRedisClient = (): Redis => {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
};
