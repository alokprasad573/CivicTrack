import { z } from "zod";
import { UserRole } from "./enums.js";

/**
 * Strong password rule:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special symbol
 */
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{}|;:,.<>])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{}|;:,.<>]{8,}$/;

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters")
  .regex(
    STRONG_PASSWORD_REGEX,
    "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character"
  );

/**
 * Direct Admin Registration Schema
 */
export const AdminRegisterSchema = z
  .object({
    name: z
      .string({ required_error: "Name is required" })
      .trim()
      .min(1, "Name is required")
      .max(120, "Name cannot exceed 120 characters"),
    email: z.string().trim().email("Please provide a valid work email address").toLowerCase(),
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AdminRegisterDto = z.infer<typeof AdminRegisterSchema>;

/**
 * Admin Officer/Staff Invitation Creation Schema
 */
export const CreateStaffInvitationSchema = z
  .object({
    email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
    role: z.enum([UserRole.OFFICER, UserRole.ADMIN], {
      errorMap: () => ({ message: "Role must be either OFFICER or ADMIN" }),
    }),
    departmentId: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (data.role === UserRole.OFFICER && !data.departmentId) {
        return false;
      }
      return true;
    },
    {
      message: "Department is required when inviting a departmental officer",
      path: ["departmentId"],
    }
  );

export type CreateStaffInvitationDto = z.infer<typeof CreateStaffInvitationSchema>;

/**
 * Staff Invitation Acceptance Schema
 */
export const AcceptStaffInvitationSchema = z
  .object({
    token: z.string().trim().min(16, "A valid invitation token is required"),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name cannot exceed 120 characters"),
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AcceptStaffInvitationDto = z.infer<typeof AcceptStaffInvitationSchema>;

/**
 * Invitation Verification Preview Response
 */
export interface VerifyStaffInvitationResponse {
  valid: boolean;
  email: string;
  role: UserRole.ADMIN | UserRole.OFFICER;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  expiresAt: string;
}

/**
 * Staff Invitation Details
 */
export interface StaffInvitationItem {
  id: string;
  email: string;
  role: UserRole.ADMIN | UserRole.OFFICER;
  departmentId?: string;
  departmentName?: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
  expiresAt: string;
  createdAt: string;
  inviteLink?: string;
}
