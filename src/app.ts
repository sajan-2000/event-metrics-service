import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { correlationIdMiddleware } from './middleware/correlation-id.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import apiRoutes from './routes';
import { swaggerOptions } from './swagger/swagger.config';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Correlation ID middleware
app.use(correlationIdMiddleware);

// Serve static files (UI)
// Path works both in dev (from src/) and production (from dist/)
const publicPath = path.join(__dirname, '../src/public');
app.use(express.static(publicPath));

// Swagger documentation
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes - all routes are mounted through the routes index
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'event-metrics-service',
  });
});

// Root endpoint - serve UI
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 404 handler
app.use(notFoundMiddleware);

// Error handler (must be last)
app.use(errorMiddleware);

export default app;

