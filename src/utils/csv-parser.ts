import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { CSVRow } from '../types';
import { validateCSVStructure, validateCSVRows, CSVValidationError } from '../validators/csv.validator';

export interface ParsedCSVData {
  rows: CSVRow[];
  headers: string[];
}

/**
 * Parse CSV file buffer into structured data
 */
export const parseCSV = (buffer: Buffer): Promise<ParsedCSVData> => {
  return new Promise((resolve, reject) => {
    const rows: CSVRow[] = [];
    let headers: string[] = [];
    let headersReceived = false;

    const stream = Readable.from(buffer.toString());

    const parser = csvParser({
      skipEmptyLines: true,
    } as any);

    parser
      .on('headers', (headerList: string[]) => {
        headers = headerList.map(h => h.trim());
        headersReceived = true;
        const structureErrors = validateCSVStructure(headers);
        if (structureErrors.length > 0) {
          stream.destroy();
          reject(new CSVValidationError(structureErrors, `CSV structure validation failed: ${JSON.stringify(structureErrors)}`));
        }
      })
      .on('data', (row: CSVRow) => {
        // If headers weren't received via headers event, extract from first row
        if (!headersReceived && rows.length === 0) {
          headers = Object.keys(row).map(h => h.trim());
          headersReceived = true;
          const structureErrors = validateCSVStructure(headers);
          if (structureErrors.length > 0) {
            stream.destroy();
            reject(new CSVValidationError(structureErrors, `CSV structure validation failed: ${JSON.stringify(structureErrors)}`));
            return;
          }
        }

        // Trim all values in the row
        const trimmedRow: Partial<CSVRow> = {};
        Object.keys(row).forEach(key => {
          const trimmedKey = key.trim();
          const value = row[key];
          trimmedRow[trimmedKey as keyof CSVRow] = typeof value === 'string' ? value.trim() : value;
        });
        rows.push(trimmedRow as CSVRow);
      })
      .on('end', () => {
        // Ensure we have headers
        if (!headersReceived && rows.length > 0) {
          headers = Object.keys(rows[0]).map(h => h.trim());
          const structureErrors = validateCSVStructure(headers);
          if (structureErrors.length > 0) {
            reject(new CSVValidationError(structureErrors, `CSV structure validation failed: ${JSON.stringify(structureErrors)}`));
            return;
          }
        }

        const validationErrors = validateCSVRows(rows);
        if (validationErrors.length > 0) {
          const errorMessage = `CSV row validation failed. Errors: ${JSON.stringify(validationErrors)}`;
          reject(new CSVValidationError(validationErrors, errorMessage));
        } else {
          resolve({ rows, headers });
        }
      })
      .on('error', (error: Error) => {
        reject(error);
      });

    stream.pipe(parser);
  });
};

/**
 * Get field value from row (case-insensitive)
 */
const getFieldValue = (row: CSVRow, fieldName: string): string => {
  const fieldLower = fieldName.toLowerCase();
  const key = Object.keys(row).find(k => k.toLowerCase() === fieldLower);
  return key ? (row[key] || '') : '';
};

/**
 * Convert CSV row to normalized format
 */
export const normalizeCSVRow = (row: CSVRow, headers: string[]): CSVRow => {
  const normalized: CSVRow = {
    userId: getFieldValue(row, 'userId').trim(),
    eventType: getFieldValue(row, 'eventType').trim(),
    timestamp: getFieldValue(row, 'timestamp').trim(),
  };

  // Add metadata (all other columns)
  headers.forEach((header) => {
    const headerLower = header.toLowerCase().trim();
    if (!['userid', 'eventtype', 'timestamp'].includes(headerLower)) {
      // Preserve original header name but get value case-insensitively
      const value = row[header] || getFieldValue(row, header) || '';
      normalized[header] = value;
    }
  });

  return normalized;
};

