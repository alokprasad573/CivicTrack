import mongoose, { Document, Schema, Model, Types } from "mongoose";
import { UserRole } from "@civictrack/contracts";

export type StaffInvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface IStaffInvitationDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  role: UserRole.ADMIN | UserRole.OFFICER;
  departmentId?: Types.ObjectId;
  tokenHash: string;
  status: StaffInvitationStatus;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StaffInvitationSchema = new Schema<IStaffInvitationDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: [UserRole.ADMIN, UserRole.OFFICER],
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
      default: undefined,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

StaffInvitationSchema.index({ email: 1, status: 1 });
StaffInvitationSchema.index({ tokenHash: 1, status: 1 });

export const StaffInvitationModel: Model<IStaffInvitationDocument> =
  mongoose.models.StaffInvitation ||
  mongoose.model<IStaffInvitationDocument>("StaffInvitation", StaffInvitationSchema);
