import mongoose, { Document, Schema, Model, Types } from "mongoose";
import { UserRole } from "@civictrack/contracts";

export interface IStaffSessionDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: UserRole.ADMIN | UserRole.OFFICER;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSessionSchema = new Schema<IStaffSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: [UserRole.ADMIN, UserRole.OFFICER],
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index for automatic expiration cleanup
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

StaffSessionSchema.index({ userId: 1, isRevoked: 1 });

export const StaffSessionModel: Model<IStaffSessionDocument> =
  mongoose.models.StaffSession ||
  mongoose.model<IStaffSessionDocument>("StaffSession", StaffSessionSchema);
