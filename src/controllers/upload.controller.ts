import { Response,NextFunction } from 'express';
import multer from 'multer';
import { processCSVUpload } from '../services/upload.service';
import { RequestWithCorrelationId } from '../middleware/correlation-id.middleware';

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * @swagger
 * /api/uploads:
 *   post:
 *     summary: Upload CSV file with user events
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file with columns userId, eventType, timestamp, and optional metadata columns
 *     responses:
 *       201:
 *         description: CSV uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: Bad request (invalid CSV or validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests (rate limit exceeded)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// export const uploadCSV = async (
//   req: RequestWithCorrelationId,
//   res: Response
// ): Promise<void> => {
//   const correlationId = req.correlationId || 'unknown';

//   try {
//     if (!req.file) {
//       res.status(400).json({
//         error: 'Bad Request',
//         message: 'No CSV file provided',
//         correlationId,
//       });
//       return;
//     }

//     // Call service to handle business logic
//     const result = await processCSVUpload(
//       {
//         buffer: req.file.buffer,
//         originalname: req.file.originalname,
//         size: req.file.size,
//       },
//       correlationId
//     );

//     res.status(201).json({
//       ...result,
//       correlationId,
//     });
//   } catch (error) {
//     // Error will be handled by error middleware
//     throw error;
//   }
// };

export const uploadCSV = async (
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction // <--- 1. ADD THIS PARAMETER
): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';

  try {
    if (!req.file) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No CSV file provided',
      });
      return;
    }

    // Call service to handle business logic
    const result = await processCSVUpload(
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        size: req.file.size,
      },
      correlationId
    );

    res.status(201).json(result);
  } catch (error) {
    // 2. CHANGE "throw error;" TO "next(error);"
    next(error);
  }
};