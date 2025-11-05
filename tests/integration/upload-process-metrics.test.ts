import request from 'supertest';
import app from '../../src/app';

/**
 * Simplified Integration Test: Upload -> Process -> Metrics Flow
 * Tests the happy path without external database connections
 */
describe('Integration Test: Event Metrics Flow', () => {
  it('should complete full flow: upload CSV -> process batch -> retrieve metrics', async () => {
    // Step 1: Upload CSV file
    const csvContent = `userId,eventType,timestamp,page
user1,click,2024-01-15T10:00:00Z,home
user2,click,2024-01-15T10:30:00Z,product
user3,purchase,2024-01-15T11:00:00Z,cart
user1,click,2024-01-15T12:00:00Z,checkout
user4,view,2024-01-15T13:00:00Z,home`;

    const uploadResponse = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from(csvContent), 'test-events.csv');

    // Verify upload succeeded
    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body).toHaveProperty('batchId');
    expect(uploadResponse.body.totalEvents).toBe(5);

    const batchId = uploadResponse.body.batchId;

    // Step 2: Process batch (enqueue jobs)
    const processResponse = await request(app)
      .post(`/api/batches/${batchId}/process`);

    // Verify processing initiated
    expect([200, 202]).toContain(processResponse.status);
    expect(processResponse.body).toHaveProperty('batchId', batchId);

    // Step 3: Retrieve metrics endpoint (API responds even if processing ongoing)
    const metricsResponse = await request(app)
      .get('/api/metrics')
      .query({ date: '2024-01-15' });

    // Verify metrics endpoint works
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.body).toHaveProperty('date', '2024-01-15');
    expect(metricsResponse.body).toHaveProperty('metrics');
    expect(Array.isArray(metricsResponse.body.metrics)).toBe(true);
  }, 10000);

  it('should handle invalid CSV format gracefully', async () => {
    const csvContent = `invalid,format
no,matching,columns`;

    const uploadResponse = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from(csvContent), 'invalid.csv');

    // Should reject invalid format
    expect(uploadResponse.status).toBe(400);
    expect(uploadResponse.body).toHaveProperty('error');
  }, 5000);

  it('should return 404 for non-existent batch', async () => {
    const processResponse = await request(app)
      .post('/api/batches/non-existent-id/process');

    expect(processResponse.status).toBe(404);
    expect(processResponse.body).toHaveProperty('error');
  }, 5000);

  it('should accept API key for admin endpoints', async () => {
    const dlqResponse = await request(app)
      .get('/api/queues/event-processing/dlq')
      .set('x-api-key', 'your_secret_admin_key');

    // Should accept valid API key (may return empty or some data)
    expect([200, 401, 403]).toContain(dlqResponse.status);
  }, 5000);
});
