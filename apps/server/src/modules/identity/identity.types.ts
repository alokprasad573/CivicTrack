import { UserRole } from "@civictrack/contracts";

export interface IAuthUser {
  id: string; // MongoDB _id string
  clerkUserId?: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
      rawBody?: string;
    }
  }
}
