import mongoose, { Schema, Document } from 'mongoose';
import { Metric } from '../types';

export interface MetricDocument extends Omit<Metric, '_id'>, Document {}

const MetricSchema = new Schema<MetricDocument>(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Unique compound index will be created in database.ts
export default mongoose.model<MetricDocument>('Metric', MetricSchema);

