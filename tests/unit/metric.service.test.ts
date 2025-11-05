import { aggregateMetrics, getMetricsByDate } from '../../src/services/metric.service';
import { Event } from '../../src/types';
import Metric from '../../src/models/Metric.model';

// Mock Metric model
jest.mock('../../src/models/Metric.model');

describe('Metric Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics correctly for same date and eventType', async () => {
      const events: Event[] = [
        {
          _id: '1',
          batchId: 'batch1',
          eventType: 'click',
          userId: 'user1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          metadata: {},
          processed: false,
          idempotencyKey: 'key1',
          createdAt: new Date(),
        },
        {
          _id: '2',
          batchId: 'batch1',
          eventType: 'click',
          userId: 'user2',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          metadata: {},
          processed: false,
          idempotencyKey: 'key2',
          createdAt: new Date(),
        },
      ];

      const bulkWriteMock = jest.fn().mockResolvedValue({});
      (Metric.bulkWrite as jest.Mock) = bulkWriteMock;

      await aggregateMetrics(events);

      expect(bulkWriteMock).toHaveBeenCalled();
      const callArgs = bulkWriteMock.mock.calls[0][0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].updateOne.filter).toEqual({
        date: '2024-01-15',
        eventType: 'click',
      });
      expect(callArgs[0].updateOne.update.$inc.count).toBe(2);
    });

    it('should aggregate metrics for different eventTypes', async () => {
      const events: Event[] = [
        {
          _id: '1',
          batchId: 'batch1',
          eventType: 'click',
          userId: 'user1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          metadata: {},
          processed: false,
          idempotencyKey: 'key1',
          createdAt: new Date(),
        },
        {
          _id: '2',
          batchId: 'batch1',
          eventType: 'purchase',
          userId: 'user2',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          metadata: {},
          processed: false,
          idempotencyKey: 'key2',
          createdAt: new Date(),
        },
      ];

      const bulkWriteMock = jest.fn().mockResolvedValue({});
      (Metric.bulkWrite as jest.Mock) = bulkWriteMock;

      await aggregateMetrics(events);

      expect(bulkWriteMock).toHaveBeenCalled();
      const callArgs = bulkWriteMock.mock.calls[0][0];
      expect(callArgs).toHaveLength(2);
    });

    it('should handle empty events array', async () => {
      const bulkWriteMock = jest.fn();
      (Metric.bulkWrite as jest.Mock) = bulkWriteMock;

      await aggregateMetrics([]);

      expect(bulkWriteMock).not.toHaveBeenCalled();
    });
  });

  describe('getMetricsByDate', () => {
    it('should retrieve metrics for valid date', async () => {
      const mockMetrics = [
        {
          eventType: 'click',
          count: 10,
          date: '2024-01-15',
        },
        {
          eventType: 'purchase',
          count: 5,
          date: '2024-01-15',
        },
      ];

      const findMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMetrics),
      });
      (Metric.find as jest.Mock) = findMock;

      const result = await getMetricsByDate('2024-01-15');

      expect(findMock).toHaveBeenCalledWith({ date: '2024-01-15' });
      expect(result).toEqual([
        { eventType: 'click', count: 10 },
        { eventType: 'purchase', count: 5 },
      ]);
    });

    it('should throw error for invalid date format', async () => {
      await expect(getMetricsByDate('invalid-date')).rejects.toThrow(
        'Invalid date format'
      );
    });

    it('should return empty array when no metrics found', async () => {
      const findMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      (Metric.find as jest.Mock) = findMock;

      const result = await getMetricsByDate('2024-01-15');
      expect(result).toEqual([]);
    });
  });
});

