import mongoose, { Document, Schema, Model, Types } from "mongoose";
import { UserRole } from "@civictrack/contracts";

export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  clerkUserId?: string;
  passwordHash?: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    clerkUserId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      select: false,
      required: false,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CITIZEN,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for administrative queries
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ departmentId: 1, role: 1 });

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);
