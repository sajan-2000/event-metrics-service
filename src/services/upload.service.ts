import { v4 as uuidv4 } from 'uuid';
import Batch from '../models/Batch.model';
import { parseCSV, normalizeCSVRow } from '../utils/csv-parser';
import { createEventsFromCSV } from '../utils/event.utils';
import { CSVValidationError } from '../validators/csv.validator';
import logger from '../utils/logger';
import { UploadResponse } from '../types';

export interface UploadFileData {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/**
 * Process CSV file upload
 */
export const processCSVUpload = async (
  fileData: UploadFileData,
  correlationId: string
): Promise<UploadResponse> => {
  const startTime = Date.now();

  logger.info('CSV upload started', {
    correlationId,
    fileName: fileData.originalname,
    fileSize: fileData.size,
  });

  // Parse CSV
  let rows, headers;
  try {
    const parsed = await parseCSV(fileData.buffer);
    rows = parsed.rows;
    headers = parsed.headers;
  } catch (parseError) {
    if (parseError instanceof CSVValidationError) {
      logger.error('CSV validation failed', {
        correlationId,
        errors: parseError.errors,
        fileName: fileData.originalname,
      });
      throw parseError;
    }
    throw parseError;
  }

  // Normalize rows
  const normalizedRows = rows.map((row) => normalizeCSVRow(row, headers));

  // Generate batch ID
  const batchId = uuidv4();

  // Create batch record
  const batch = new Batch({
    batchId,
    fileName: fileData.originalname,
    totalEvents: normalizedRows.length,
    processedEvents: 0,
    status: 'uploaded',
    uploadedAt: new Date(),
  });

  await batch.save();

  // Create events in database
  const insertedCount = await createEventsFromCSV(batchId, normalizedRows, correlationId);

  // Update batch with actual inserted count (may differ due to duplicates)
  if (insertedCount !== normalizedRows.length) {
    await Batch.updateOne(
      { batchId },
      { $set: { totalEvents: insertedCount } }
    );
  }

  const duration = Date.now() - startTime;

  logger.info('CSV upload completed', {
    correlationId,
    batchId,
    fileName: fileData.originalname,
    totalRows: normalizedRows.length,
    insertedCount,
    duration: `${duration}ms`,
  });

  return {
    batchId,
    totalEvents: insertedCount,
    message: `Successfully uploaded ${insertedCount} events`,
  };
};

