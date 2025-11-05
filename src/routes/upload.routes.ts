import { Router } from 'express';
import { uploadCSV, upload } from '../controllers/upload.controller';
import { uploadRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post('/', uploadRateLimiter, upload.single('file'), uploadCSV);

export default router;

