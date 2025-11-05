import { Router } from 'express';
import uploadRoutes from './upload.routes';
import batchRoutes from './batch.routes';
import metricsRoutes from './metrics.routes';
import queueRoutes from './queue.routes';

const router = Router();

// Mount all route modules
router.use('/uploads', uploadRoutes);
router.use('/batches', batchRoutes);
router.use('/metrics', metricsRoutes);
router.use('/queues', queueRoutes);

export default router;

