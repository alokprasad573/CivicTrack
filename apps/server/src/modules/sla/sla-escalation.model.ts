import { Schema, model, Document, Types } from "mongoose";

export interface ISlaEscalationDocument extends Document {
  _id: Types.ObjectId;
  complaintId: Types.ObjectId;
  dueAt: Date;
  escalatedAt: Date;
  delayHours: number;
  isResolved: boolean;
  resolvedAt?: Date;
  notifiedAdminsCount: number;
}

const SlaEscalationSchema = new Schema<ISlaEscalationDocument>(
  {
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    escalatedAt: {
      type: Date,
      default: Date.now,
    },
    delayHours: {
      type: Number,
      required: true,
      min: 0,
    },
    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    notifiedAdminsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Unique compound index enforces strict idempotency for overdue scans
SlaEscalationSchema.index({ complaintId: 1, dueAt: 1 }, { unique: true });

export const SlaEscalationModel = model<ISlaEscalationDocument>(
  "SlaEscalation",
  SlaEscalationSchema
);
