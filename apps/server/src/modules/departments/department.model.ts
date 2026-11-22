import mongoose, { Document, Schema, Model, Types } from "mongoose";
import { ComplaintCategory } from "@civictrack/contracts";

export interface IDepartmentDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  categories: ComplaintCategory[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartmentDocument>(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: [true, "Department code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    categories: [
      {
        type: String,
        enum: Object.values(ComplaintCategory),
        required: true,
      },
    ],
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

export const DepartmentModel: Model<IDepartmentDocument> =
  mongoose.models.Department || mongoose.model<IDepartmentDocument>("Department", DepartmentSchema);
