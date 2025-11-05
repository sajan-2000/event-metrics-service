import { Router } from 'express';
import { getDLQ } from '../controllers/queue.controller';
import { adminAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/:name/dlq', adminAuthMiddleware, getDLQ);

export default router;

