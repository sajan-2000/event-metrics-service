import { Router } from 'express';
import { processBatch } from '../controllers/batch.controller';

const router = Router();

router.post('/:id/process', processBatch);

export default router;

