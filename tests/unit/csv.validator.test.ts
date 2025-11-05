import { validateCSVRow, validateCSVStructure, validateCSVRows } from '../../src/validators/csv.validator';
import { CSVRow } from '../../src/types';

describe('CSV Validator', () => {
  describe('validateCSVRow', () => {
    it('should validate a valid CSV row', () => {
      const row: CSVRow = {
        userId: 'user123',
        eventType: 'click',
        timestamp: '2024-01-15T10:30:00Z',
      };

      const errors = validateCSVRow(row, 1);
      expect(errors).toHaveLength(0);
    });

    it('should reject row with missing userId', () => {
      const row: CSVRow = {
        userId: '',
        eventType: 'click',
        timestamp: '2024-01-15T10:30:00Z',
      };

      const errors = validateCSVRow(row, 1);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('userId');
    });

    it('should reject row with missing eventType', () => {
      const row: CSVRow = {
        userId: 'user123',
        eventType: '',
        timestamp: '2024-01-15T10:30:00Z',
      };

      const errors = validateCSVRow(row, 1);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('eventType');
    });

    it('should reject row with invalid timestamp', () => {
      const row: CSVRow = {
        userId: 'user123',
        eventType: 'click',
        timestamp: 'invalid-date',
      };

      const errors = validateCSVRow(row, 1);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('timestamp');
    });

    it('should reject row with missing timestamp', () => {
      const row: CSVRow = {
        userId: 'user123',
        eventType: 'click',
        timestamp: '',
      };

      const errors = validateCSVRow(row, 1);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('timestamp');
    });
  });

  describe('validateCSVStructure', () => {
    it('should validate CSV with all required columns', () => {
      const headers = ['userId', 'eventType', 'timestamp'];
      const errors = validateCSVStructure(headers);
      expect(errors).toHaveLength(0);
    });

    it('should validate CSV with required columns (case insensitive)', () => {
      const headers = ['USERID', 'EventType', 'TIMESTAMP'];
      const errors = validateCSVStructure(headers);
      expect(errors).toHaveLength(0);
    });

    it('should reject CSV missing userId column', () => {
      const headers = ['eventType', 'timestamp'];
      const errors = validateCSVStructure(headers);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('userId');
    });

    it('should reject CSV missing eventType column', () => {
      const headers = ['userId', 'timestamp'];
      const errors = validateCSVStructure(headers);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('eventType');
    });

    it('should reject CSV missing timestamp column', () => {
      const headers = ['userId', 'eventType'];
      const errors = validateCSVStructure(headers);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('timestamp');
    });
  });

  describe('validateCSVRows', () => {
    it('should validate valid CSV rows', () => {
      const rows: CSVRow[] = [
        {
          userId: 'user1',
          eventType: 'click',
          timestamp: '2024-01-15T10:30:00Z',
        },
        {
          userId: 'user2',
          eventType: 'purchase',
          timestamp: '2024-01-15T11:00:00Z',
        },
      ];

      const errors = validateCSVRows(rows);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty CSV', () => {
      const rows: CSVRow[] = [];
      const errors = validateCSVRows(rows);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should collect errors from multiple invalid rows', () => {
      const rows: CSVRow[] = [
        {
          userId: '',
          eventType: 'click',
          timestamp: '2024-01-15T10:30:00Z',
        },
        {
          userId: 'user2',
          eventType: '',
          timestamp: '2024-01-15T11:00:00Z',
        },
      ];

      const errors = validateCSVRows(rows);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should include correct row numbers in errors', () => {
      const rows: CSVRow[] = [
        {
          userId: 'user1',
          eventType: 'click',
          timestamp: '2024-01-15T10:30:00Z',
        },
        {
          userId: '',
          eventType: 'click',
          timestamp: '2024-01-15T10:30:00Z',
        },
      ];

      const errors = validateCSVRows(rows);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].row).toBe(3); // Row 2 (index 1) + header (1) + 1 = 3
    });
  });
});

