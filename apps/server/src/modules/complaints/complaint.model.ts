import mongoose, { Document, Schema, Model, Types } from "mongoose";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  EvidenceItem,
  GeoJsonPoint,
} from "@civictrack/contracts";

export interface IComplaintDocument extends Document {
  _id: Types.ObjectId;
  referenceNumber: string;
  citizenId: Types.ObjectId;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  location: GeoJsonPoint;
  address: string;
  landmark?: string;
  evidence: EvidenceItem[];
  departmentId?: Types.ObjectId;
  assignedOfficerId?: Types.ObjectId;
  dueAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  rejectionReason?: string;
  resolutionRemarks?: string;
  resolutionEvidence?: EvidenceItem[];
  feedbackRating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: Date;
  duplicateOf?: Types.ObjectId;
  isDuplicate?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GeoJsonPointMongooseSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: (coords: number[]) =>
          Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0]! >= -180 &&
          coords[0]! <= 180 && // longitude
          coords[1]! >= -90 &&
          coords[1]! <= 90,    // latitude
        message: "Invalid coordinates: [longitude (-180..180), latitude (-90..90)]",
      },
    },
  },
  { _id: false }
);

const EvidenceItemMongooseSchema = new Schema<EvidenceItem>(
  {
    objectKey: { type: String, required: true },
    key: { type: String },
    url: { type: String },
    originalName: { type: String },
    contentType: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ComplaintSchema = new Schema<IComplaintDocument>(
  {
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Complaint title is required"],
      trim: true,
      minlength: 5,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, "Complaint description is required"],
      trim: true,
      minlength: 20,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: Object.values(ComplaintCategory),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ComplaintStatus),
      default: ComplaintStatus.SUBMITTED,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(ComplaintPriority),
      default: ComplaintPriority.MEDIUM,
      index: true,
    },
    location: {
      type: GeoJsonPointMongooseSchema,
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    evidence: {
      type: [EvidenceItemMongooseSchema],
      default: [],
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    assignedOfficerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    dueAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    resolutionRemarks: { type: String, trim: true, maxlength: 1000 },
    resolutionEvidence: {
      type: [EvidenceItemMongooseSchema],
      default: [],
    },
    feedbackRating: { type: Number, min: 1, max: 5 },
    feedbackComment: { type: String, trim: true, maxlength: 1000 },
    feedbackSubmittedAt: { type: Date },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Complaint", index: true },
    isDuplicate: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL: 2dsphere spatial index for geospatial queries and duplicate detection
ComplaintSchema.index({ location: "2dsphere" });

// High-cardinality filtering indexes
ComplaintSchema.index({ citizenId: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });
ComplaintSchema.index({ departmentId: 1, status: 1, priority: 1 });
ComplaintSchema.index({ departmentId: 1, createdAt: -1 });
ComplaintSchema.index({ assignedOfficerId: 1, status: 1 });

export const ComplaintModel: Model<IComplaintDocument> =
  mongoose.models.Complaint || mongoose.model<IComplaintDocument>("Complaint", ComplaintSchema);
