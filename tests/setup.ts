// Test setup file
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-event-metrics';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.LOG_LEVEL = 'error';

