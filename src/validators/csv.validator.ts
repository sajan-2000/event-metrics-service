import { CSVRow } from '../types';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export class CSVValidationError extends Error {
  constructor(
    public errors: ValidationError[],
    message = 'CSV validation failed'
  ) {
    super(message);
    this.name = 'CSVValidationError';
  }
}

/**
 * Get field value from row (case-insensitive)
 */
const getFieldValue = (row: CSVRow, fieldName: string): string | undefined => {
  const fieldLower = fieldName.toLowerCase();
  const key = Object.keys(row).find(k => k.toLowerCase() === fieldLower);
  return key ? row[key] : undefined;
};

/**
 * Validate CSV row structure and data types
 */
export const validateCSVRow = (row: CSVRow, rowNumber: number): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Get values case-insensitively
  const userId = getFieldValue(row, 'userId');
  const eventType = getFieldValue(row, 'eventType');
  const timestamp = getFieldValue(row, 'timestamp');

  // Required fields
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'userId',
      message: 'userId is required and must be a non-empty string',
    });
  }

  if (!eventType || typeof eventType !== 'string' || eventType.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'eventType',
      message: 'eventType is required and must be a non-empty string',
    });
  }

  if (!timestamp || typeof timestamp !== 'string' || timestamp.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'timestamp',
      message: 'timestamp is required and must be a non-empty string',
    });
  } else {
    // Validate timestamp format (ISO 8601)
    const timestampDate = new Date(timestamp);
    if (isNaN(timestampDate.getTime())) {
      errors.push({
        row: rowNumber,
        field: 'timestamp',
        message: 'timestamp must be a valid ISO 8601 date string',
      });
    }
  }

  return errors;
};

/**
 * Validate CSV structure - ensure required columns exist
 */
export const validateCSVStructure = (headers: string[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requiredColumns = ['userId', 'eventType', 'timestamp'];
  const headerLower = headers.map((h) => h.toLowerCase().trim());

  for (const required of requiredColumns) {
    if (!headerLower.includes(required.toLowerCase())) {
      errors.push({
        row: 0,
        field: required,
        message: `Required column '${required}' is missing`,
      });
    }
  }

  return errors;
};

/**
 * Validate all CSV rows
 */
export const validateCSVRows = (rows: CSVRow[]): ValidationError[] => {
  const allErrors: ValidationError[] = [];

  if (rows.length === 0) {
    allErrors.push({
      row: 0,
      field: 'file',
      message: 'CSV file is empty or contains no data rows',
    });
    return allErrors;
  }

  rows.forEach((row, index) => {
    const errors = validateCSVRow(row, index + 2); // +2 because row 1 is header
    allErrors.push(...errors);
  });

  return allErrors;
};

