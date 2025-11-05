import mongoose, { Schema, Document } from 'mongoose';
import { Event } from '../types';

export interface EventDocument extends Omit<Event, '_id'>, Document {}

const EventSchema = new Schema<EventDocument>(
  {
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound indexes will be created in database.ts
export default mongoose.model<EventDocument>('Event', EventSchema);

