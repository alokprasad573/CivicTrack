import mongoose, { Document, Schema, Model, Types } from "mongoose";

export type UploadIntentStatus = "PENDING" | "ATTACHED" | "EXPIRED";

export interface IUploadIntentDocument extends Document {
  _id: Types.ObjectId;
  objectKey: string;
  userId: Types.ObjectId;
  contentType: string;
  size: number;
  checksum?: string;
  status: UploadIntentStatus;
  complaintId?: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UploadIntentSchema = new Schema<IUploadIntentDocument>(
  {
    objectKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    checksum: {
      type: String,
    },
    status: {
      type: String,
      enum: ["PENDING", "ATTACHED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: "Complaint",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding pending uploads that have expired for cleanup
UploadIntentSchema.index({ status: 1, createdAt: 1 });

export const UploadIntentModel: Model<IUploadIntentDocument> =
  mongoose.models.UploadIntent ||
  mongoose.model<IUploadIntentDocument>("UploadIntent", UploadIntentSchema);
