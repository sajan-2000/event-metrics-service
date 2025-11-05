import mongoose, { Schema, Document } from 'mongoose';
import { Batch } from '../types';

export interface BatchDocument extends Omit<Batch, '_id'>, Document {}

const BatchSchema = new Schema<BatchDocument>(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    totalEvents: {
      type: Number,
      required: true,
      min: 0,
    },
    processedEvents: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'completed', 'failed'],
      default: 'uploaded',
      index: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index will be created in database.ts
export default mongoose.model<BatchDocument>('Batch', BatchSchema);

