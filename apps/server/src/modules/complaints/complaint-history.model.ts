import mongoose, { Document, Schema, Model, Types } from "mongoose";
import { ComplaintStatus, EvidenceItem } from "@civictrack/contracts";

export interface IComplaintStatusHistoryDocument extends Document {
  _id: Types.ObjectId;
  complaintId: Types.ObjectId;
  fromStatus?: ComplaintStatus;
  toStatus: ComplaintStatus;
  actorId: Types.ObjectId;
  remarks?: string;
  evidence?: EvidenceItem[];
  createdAt: Date;
}

const EvidenceItemSchema = new Schema<EvidenceItem>(
  {
    objectKey: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ComplaintStatusHistorySchema = new Schema<IComplaintStatusHistoryDocument>(
  {
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      enum: Object.values(ComplaintStatus),
    },
    toStatus: {
      type: String,
      enum: Object.values(ComplaintStatus),
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    evidence: {
      type: [EvidenceItemSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

ComplaintStatusHistorySchema.index({ complaintId: 1, createdAt: 1 });

export const ComplaintStatusHistoryModel: Model<IComplaintStatusHistoryDocument> =
  mongoose.models.ComplaintStatusHistory ||
  mongoose.model<IComplaintStatusHistoryDocument>(
    "ComplaintStatusHistory",
    ComplaintStatusHistorySchema
  );
