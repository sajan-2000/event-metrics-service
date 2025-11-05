export interface Event {
  _id?: string;
  batchId: string;
  eventType: string;
  userId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  processed: boolean;
  idempotencyKey: string;
  createdAt: Date;
}

export interface Metric {
  _id?: string;
  date: string;
  eventType: string;
  count: number;
  lastUpdated: Date;
}

export interface Batch {
  _id?: string;
  batchId: string;
  fileName: string;
  totalEvents: number;
  processedEvents: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  uploadedAt: Date;
  processedAt?: Date;
}

export interface CSVRow {
  userId: string;
  eventType: string;
  timestamp: string;
  [key: string]: string;
}

export interface UploadResponse {
  batchId: string;
  totalEvents: number;
  message: string;
}

export interface BatchProcessResponse {
  batchId: string;
  jobsEnqueued: number;
  message: string;
}

export interface MetricsResponse {
  date: string;
  metrics: Array<{
    eventType: string;
    count: number;
  }>;
}

export interface DLQResponse {
  queueName: string;
  failedJobs: Array<{
    id: string;
    data: unknown;
    error: string;
    failedReason: string;
    timestamp: number;
  }>;
}

export interface JobData {
  batchId: string;
  eventIds: string[];
  correlationId: string;
}

export interface ExpressRequest extends Express.Request {
  correlationId?: string;
}

