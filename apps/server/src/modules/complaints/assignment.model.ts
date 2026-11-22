import mongoose, { Document, Schema, Model, Types } from "mongoose";

export interface IAssignmentDocument extends Document {
  _id: Types.ObjectId;
  complaintId: Types.ObjectId;
  departmentId: Types.ObjectId;
  officerId?: Types.ObjectId;
  assignedBy: Types.ObjectId;
  remarks?: string;
  assignedAt: Date;
  unassignedAt?: Date;
}

const AssignmentSchema = new Schema<IAssignmentDocument>(
  {
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    officerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unassignedAt: {
      type: Date,
    },
  },
  {
    versionKey: false,
  }
);

AssignmentSchema.index({ complaintId: 1, assignedAt: -1 });

export const AssignmentModel: Model<IAssignmentDocument> =
  mongoose.models.Assignment ||
  mongoose.model<IAssignmentDocument>("Assignment", AssignmentSchema);
