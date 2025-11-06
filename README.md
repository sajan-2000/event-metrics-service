# Event Metrics Service

A production-ready Event Metrics Service built with Node.js and TypeScript that processes CSV uploads of user events, computes daily metrics using background job queues, and provides RESTful APIs for data retrieval.

## Features

- 📤 **CSV File Upload**: Upload and validate CSV files containing user events
- 🔄 **Background Processing**: Asynchronous event processing using BullMQ job queues
- 📊 **Daily Metrics**: Aggregate and retrieve metrics by date and event type
- 🔐 **Admin Authentication**: Protected endpoints for queue management
- 📝 **Structured Logging**: Winston-based logging with correlation IDs
- 🚦 **Rate Limiting**: Upload rate limiting (10 requests per minute per IP)
- 📚 **API Documentation**: Swagger UI with OpenAPI 3.0 specification
- 🎨 **Web UI**: Built-in web interface for file uploads, batch management, and metrics viewing
- ✅ **Comprehensive Testing**: Unit and integration tests with Jest

## Tech Stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Cache/Queue**: Redis + BullMQ
- **Testing**: Jest
- **Documentation**: Swagger UI with OpenAPI 3.0
- **File Upload**: Multer
- **Validation**: Zod + Joi
- **Logging**: Winston (structured JSON logs)

## Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account or local MongoDB instance
- Redis server (local or cloud)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sajan-2000/event-metrics-service.git
   cd csv-processor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/event-metrics?retryWrites=true&w=majority
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ADMIN_API_KEY=your_secret_admin_key
   LOG_LEVEL=info
   UPLOAD_RATE_LIMIT=10
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## Complete Application Flow

### Phase 1: Application Startup

When the server starts (`server.ts`):

1. **Database Connection**: Connects to MongoDB to store events, batches, and metrics
2. **Redis Connection**: Connects to Redis for BullMQ queue system
3. **Worker Initialization**: Starts the BullMQ worker (`event-processor.worker.ts`) that runs continuously in the background, listening for jobs
4. **HTTP Server**: Starts Express server to accept API requests

The worker runs continuously, waiting for jobs from the queue.

### Phase 2: CSV File Upload (`POST /api/uploads`)

**Request Flow**: `Client → Express App → Middleware → Controller → Service → Database`

1. **Request Received**
   - Route: `POST /api/uploads`
   - Middleware: Rate limiter (prevents spam), Correlation ID (adds tracking ID)

2. **File Upload Handling** (`upload.controller.ts`)
   - Multer middleware handles multipart/form-data
   - File stored in memory as Buffer
   - Validates file type (must be CSV)

3. **CSV Processing** (`upload.service.ts`)
   - Calls `parseCSV()` from `utils/csv-parser.ts`
   - Parses CSV rows and headers
   - Validates CSV structure (must have userId, eventType, timestamp columns)
   - Validates each row (required fields, data types)
   - Normalizes rows (case-insensitive headers, trims values)

4. **Batch Creation**
   - Generates unique `batchId` (UUID)
   - Creates Batch record in MongoDB:
     ```javascript
     {
       batchId: "uuid",
       fileName: "events.csv",
       totalEvents: 1000,
       processedEvents: 0,
       status: "uploaded",
       uploadedAt: Date
     }
     ```

5. **Event Creation** (`utils/event.utils.ts`)
   - For each CSV row:
     - Generates `idempotencyKey` (userId + eventType + timestamp hash)
     - Creates Event document:
       ```javascript
       {
         batchId: "uuid",
         userId: "user123",
         eventType: "click",
         timestamp: Date,
         metadata: {...},
         processed: false,
         idempotencyKey: "hash",
         createdAt: Date
       }
       ```
   - Uses `bulkWrite` with `upsert: true` to prevent duplicates
   - Returns count of newly inserted events

6. **Response**
   ```json
   {
     "batchId": "uuid",
     "totalEvents": 1000,
     "message": "Successfully uploaded 1000 events"
   }
   ```

**Status**: Events are stored in database but not processed yet (`processed: false`).

### Phase 3: Batch Processing (`POST /api/batches/:id/process`)

This is a manual trigger to start processing events:

1. **Request Received**
   - Route: `POST /api/batches/{batchId}/process`
   - Controller: `batch.controller.ts`

2. **Validation** (`batch.service.ts`)
   - Checks if batch exists in database
   - Fetches unprocessed events (up to 10,000)

3. **Job Creation**
   - Groups events into batches of 100 (`EVENTS_PER_JOB = 100`)
   - For each group of 100 event IDs:
     - Creates a BullMQ job:
       ```javascript
       {
         name: "process-events",
         data: {
           batchId: "uuid",
           eventIds: ["id1", "id2", ... "id100"],
           correlationId: "correlation-id"
         }
       }
       ```
   - Adds jobs to Redis queue (`event-processing`)

4. **Batch Status Update**
   - Updates batch status: `uploaded` → `processing`

5. **Response**
   ```json
   {
     "batchId": "uuid",
     "jobsEnqueued": 10,
     "message": "Successfully enqueued 10 jobs for processing"
   }
   ```

**Status**: Jobs are now in Redis queue, waiting for worker to pick them up.

### Phase 4: Worker Processing (`event-processor.worker.ts`)

Background worker automatically processes jobs:

1. **Job Pickup**
   - Worker pulls job from Redis queue
   - Job contains: `batchId`, `eventIds[]`, `correlationId`

2. **Event Fetching**
   - Queries MongoDB for events with those IDs
   - Filters: `processed: false`

3. **Idempotency Check**
   - For each event, checks if already processed
   - Filters out duplicates

4. **Metrics Aggregation** (`metric.service.ts`)
   - Groups events by date and eventType:
     ```
     "2024-01-15:click" → count: 50
     "2024-01-15:view" → count: 30
     "2024-01-16:click" → count: 25
     ```
   - Updates/creates Metric documents in MongoDB:
     ```javascript
     {
       date: "2024-01-15",
       eventType: "click",
       count: 50,  // Incremented
       lastUpdated: Date
     }
     ```

5. **Mark Events as Processed**
   - Updates all events: `processed: true`

6. **Batch Progress Update**
   - Counts total processed events for batch
   - If all events processed: status → `completed`, sets `processedAt`
   - Updates `processedEvents` count

7. **Job Completion**
   - Job marked as completed in Redis
   - Worker picks up next job (concurrency: 10 jobs at once)

**Retry Logic**: 
- If job fails (transient error): retries up to 3 times with exponential backoff
- If job fails permanently: moves to Dead Letter Queue (DLQ)

### Phase 5: Metrics Retrieval (`GET /api/metrics`)

Query metrics:

1. **Request Received**
   - Route: `GET /api/metrics?date=2024-01-15`
   - Optional: `date` parameter (defaults to today)

2. **Metrics Fetching** (`metric.service.ts`)
   - Queries MongoDB for metrics matching date
   - Returns aggregated counts by eventType

3. **Response**
   ```json
   {
     "date": "2024-01-15",
     "metrics": [
       { "eventType": "click", "count": 150 },
       { "eventType": "view", "count": 80 }
     ]
   }
   ```

### Phase 6: Admin Endpoint - Dead Letter Queue (`GET /api/queues/:name/dlq`)

For debugging failed jobs:

1. **Authentication**
   - Requires `X-API-Key` header
   - Validates against `ADMIN_API_KEY` from `.env`

2. **Queue Validation** (`infrastructure/queue-admin.ts`)
   - Validates queue name: must be `event-processing`

3. **Failed Jobs Retrieval** (`infrastructure/queue.ts`)
   - Gets failed jobs from Redis DLQ
   - Returns job details: id, data, error message, timestamp

4. **Response**
   ```json
   {
     "queueName": "event-processing",
     "failedJobs": [
       {
         "id": "job-123",
         "data": {...},
         "error": "Database connection failed",
         "failedReason": "Database connection failed",
         "timestamp": 1234567890
       }
     ]
   }
   ```

### Flow Diagram

```
┌─────────────┐
│  CSV Upload │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Parse & Validate│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Create Events   │
│ (in MongoDB)    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Create Batch    │
│ Status: uploaded │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ POST /batches   │
│ /:id/process    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Create Jobs     │
│ (in Redis Queue)│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Worker Picks    │
│ Up Job          │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Fetch Events    │
│ from MongoDB    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Aggregate       │
│ Metrics         │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Mark Events     │
│ as Processed    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Update Batch    │
│ Status: completed│
└─────────────────┘
```

## API Endpoints

### 1. Upload CSV File
**POST** `/api/uploads`

Upload a CSV file containing user events.

**Request:**
- Content-Type: `multipart/form-data`
- Body: CSV file (field name: `file`)

**CSV Format:**
```csv
userId,eventType,timestamp,metadata
user1,click,2024-01-15T10:00:00Z,{"page":"home"}
user2,purchase,2024-01-15T11:00:00Z,{"amount":100}
```

**Required Columns:**
- `userId`: User identifier (string)
- `eventType`: Type of event (string, e.g., "click", "purchase", "login")
- `timestamp`: ISO 8601 timestamp (string)

**Response:**
```json
{
  "batchId": "uuid",
  "totalEvents": 2,
  "message": "Successfully uploaded 2 events"
}
```

**Status Codes:**
- `201`: Created
- `400`: Bad Request (invalid CSV or validation error)
- `429`: Too Many Requests (rate limit exceeded)

### 2. Process Batch
**POST** `/api/batches/:id/process`

Trigger processing of a batch by enqueuing jobs for unprocessed events.

**Response:**
```json
{
  "batchId": "uuid",
  "jobsEnqueued": 1,
  "message": "Successfully enqueued 1 jobs for processing"
}
```

**Status Codes:**
- `202`: Accepted
- `404`: Not Found

### 3. Get Metrics
**GET** `/api/metrics?date=YYYY-MM-DD`

Retrieve metrics for a specific date.

**Query Parameters:**
- `date` (optional): Date in YYYY-MM-DD format (defaults to today)

**Response:**
```json
{
  "date": "2024-01-15",
  "metrics": [
    {
      "eventType": "click",
      "count": 150
    },
    {
      "eventType": "purchase",
      "count": 25
    }
  ]
}
```

**Status Codes:**
- `200`: OK
- `400`: Bad Request (invalid date format)

### 4. Get Dead Letter Queue (Admin)
**GET** `/api/queues/:name/dlq?limit=100`

Retrieve failed jobs from the Dead Letter Queue.

**Headers:**
- `X-API-Key`: Admin API key (required)

**Path Parameters:**
- `name`: Queue name (must be `event-processing`)

**Query Parameters:**
- `limit` (optional): Maximum number of failed jobs to return (default: 100)

**Response:**
```json
{
  "queueName": "event-processing",
  "failedJobs": [
    {
      "id": "job-id",
      "data": { "batchId": "uuid", "eventIds": ["id1", "id2"] },
      "error": "Error message",
      "failedReason": "Error message",
      "timestamp": 1234567890
    }
  ]
}
```

**Status Codes:**
- `200`: OK
- `401`: Unauthorized (invalid or missing API key)
- `400`: Bad Request (unknown queue)

## Architecture

### Project Structure
```
csv-processor/
├── src/
│   ├── config/          # Configuration (database, Redis, env)
│   ├── models/          # MongoDB models (Event, Metric, Batch)
│   ├── routes/          # Express routes
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── infrastructure/  # Queue infrastructure (queue.ts, queue-admin.ts)
│   ├── workers/         # BullMQ workers
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions (csv-parser, event.utils, logger, idempotency)
│   ├── validators/      # Validation logic
│   ├── types/           # TypeScript interfaces
│   ├── public/          # Static files (Web UI)
│   ├── swagger/         # OpenAPI configuration
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
└── README.md
```

### Data Flow

1. **Upload**: CSV file is uploaded via `/api/uploads`
   - File is parsed and validated
   - Events are inserted into MongoDB with idempotency keys
   - Batch record is created

2. **Process**: Batch processing is triggered via `/api/batches/:id/process`
   - Unprocessed events are fetched
   - Jobs are enqueued in BullMQ (batched by 100 events)

3. **Worker**: BullMQ worker processes jobs
   - Events are fetched from MongoDB
   - Metrics are aggregated by date and eventType
   - Metrics collection is updated (upsert)
   - Events are marked as processed
   - Batch status is updated

4. **Retrieve**: Metrics are queried via `/api/metrics`
   - Metrics are fetched from MongoDB
   - Results are returned grouped by eventType

### Database Schema

#### Events Collection
```javascript
{
  _id: ObjectId,
  batchId: string,           // Reference to batch
  eventType: string,         // e.g., "click", "purchase"
  userId: string,
  timestamp: Date,
  metadata: object,          // Additional CSV columns
  processed: boolean,        // Processing status
  idempotencyKey: string,    // Unique key for deduplication
  createdAt: Date
}
```

**Indexes:**
- `{ batchId: 1, processed: 1 }` - For batch processing queries
- `{ timestamp: 1, eventType: 1 }` - For metric queries
- `{ idempotencyKey: 1 }` - Unique index for deduplication
- `{ createdAt: 1 }` - For cleanup/archival

#### Metrics Collection
```javascript
{
  _id: ObjectId,
  date: string,              // YYYY-MM-DD format
  eventType: string,
  count: number,
  lastUpdated: Date
}
```

**Indexes:**
- `{ date: 1, eventType: 1 }` - Unique compound index

#### Batches Collection
```javascript
{
  _id: ObjectId,
  batchId: string,           // UUID
  fileName: string,
  totalEvents: number,
  processedEvents: number,
  status: string,            // "uploaded", "processing", "completed", "failed"
  uploadedAt: Date,
  processedAt: Date
}
```

**Indexes:**
- `{ batchId: 1 }` - Unique index
- `{ status: 1, uploadedAt: -1 }` - For querying batches

### Queue Configuration

- **Queue Name**: `event-processing`
- **Concurrency**: 10 workers
- **Retry Strategy**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Job Batching**: 100 events per job

### Security Features

- **Rate Limiting**: Upload endpoint limited to 10 requests/minute per IP
- **Admin Authentication**: API key required for DLQ endpoint
- **Input Validation**: All CSV data is validated before processing
- **Helmet**: Security headers middleware
- **CORS**: Cross-origin resource sharing enabled

### Observability

- **Structured Logging**: Winston logger with JSON output
- **Correlation IDs**: Unique ID per request for tracing (used in logs, not in responses)
- **Error Handling**: Comprehensive error middleware
- **Health Check**: `/health` endpoint for monitoring

## Web UI

The application includes a built-in web interface accessible at `http://localhost:3000`. The UI provides:

- **CSV File Upload**: Drag & drop or click to select CSV files
- **Batch Management**: View uploaded batches with their status (uploaded, processing, completed)
- **Batch Processing**: Trigger batch processing directly from the UI
- **Metrics Viewer**: 
  - Date picker to select date for metrics
  - Real-time metrics table showing event types and counts
  - Refresh button to reload metrics
- **Status Indicators**: Visual feedback for upload and processing status
- **Error Display**: Clear error messages for failed operations

The UI is a single-page application with vanilla JavaScript, providing a clean and intuitive interface for managing CSV uploads and viewing metrics without needing to use the API directly.

## API Documentation

Interactive API documentation is available at `/api-docs` when the server is running. The Swagger UI provides:
- Endpoint descriptions
- Request/response schemas
- Example payloads
- Error responses
- Authentication requirements

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Test individual functions and services
- **Integration Tests**: Test complete workflows (upload → process → metrics)

## Trade-offs and Considerations

### Performance
- **Bulk Operations**: MongoDB bulk writes for efficient event insertion
- **Batch Processing**: Events processed in batches (100 per job) to balance throughput and latency
- **Indexes**: Optimized indexes for common query patterns
- **Connection Pooling**: MongoDB connection pooling configured

### Scalability
- **Horizontal Scaling**: Multiple worker instances can process jobs concurrently
- **Redis Clustering**: Supports Redis cluster for high availability
- **Database Sharding**: MongoDB schema supports sharding by batchId or date

### Reliability
- **Idempotency**: Events deduplicated using idempotency keys
- **Retry Logic**: Transient errors automatically retried
- **Dead Letter Queue**: Failed jobs moved to DLQ for manual inspection
- **Transaction Safety**: Bulk operations use appropriate write concerns

### Limitations
- **File Size**: CSV uploads limited to 10MB
- **Rate Limiting**: Upload rate limited to prevent abuse
- **Processing Delay**: Metrics available after batch processing completes
- **Memory Usage**: Large CSV files loaded into memory (consider streaming for very large files)

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Verify `MONGODB_URI` in `.env`
   - Check network connectivity
   - Verify MongoDB Atlas IP whitelist

2. **Redis Connection Failed**
   - Verify Redis is running locally or connection details in `.env`
   - Check Redis password if required

3. **Jobs Not Processing**
   - Verify worker is running (check logs)
   - Check Redis connection
   - Verify events exist and are unprocessed

4. **Rate Limit Exceeded**
   - Wait for rate limit window to reset (1 minute)
   - Increase `UPLOAD_RATE_LIMIT` in `.env` if needed

## Contributing

1. Follow TypeScript strict mode guidelines
2. Maintain test coverage above 80%
3. Use meaningful commit messages
4. Update documentation for new features

## License

MIT
