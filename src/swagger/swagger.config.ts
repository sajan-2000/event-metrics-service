import swaggerJsdoc from 'swagger-jsdoc';
import env from '../config/env';

export const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Metrics Service API',
      version: '1.0.0',
      description:
        'Production-ready Event Metrics Service with CSV processing and background job queues',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Admin API key for protected endpoints',
        },
      },
      schemas: {
        UploadResponse: {
          type: 'object',
          properties: {
            batchId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique batch identifier',
            },
            totalEvents: {
              type: 'number',
              description: 'Number of events successfully uploaded',
            },
            message: {
              type: 'string',
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        BatchProcessResponse: {
          type: 'object',
          properties: {
            batchId: {
              type: 'string',
              format: 'uuid',
            },
            jobsEnqueued: {
              type: 'number',
              description: 'Number of jobs enqueued for processing',
            },
            message: {
              type: 'string',
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        MetricsResponse: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
            metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  eventType: {
                    type: 'string',
                  },
                  count: {
                    type: 'number',
                  },
                },
              },
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        DLQResponse: {
          type: 'object',
          properties: {
            queueName: {
              type: 'string',
            },
            failedJobs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                  },
                  data: {
                    type: 'object',
                  },
                  error: {
                    type: 'string',
                  },
                  failedReason: {
                    type: 'string',
                  },
                  timestamp: {
                    type: 'number',
                  },
                },
              },
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

