import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  workspaceId: z.string(),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const UserAdminRoleSchema = z.enum(["DEALER", "LENDER", "ADMIN"]);
export const UserAdminStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export const UserAdminUpdateSchema = z.object({
  userId: z.string().min(1),
  data: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: UserAdminRoleSchema,
    status: UserAdminStatusSchema,
  }),
});

export const DocumentCertificationSchema = z.object({
  docId: z.string().min(1),
  adminNotes: z.string().min(5, "Admin notes are required."),
});

export const SystemConfigSchema = z.object({
  maxDocumentsPerMonth: z.coerce.number().int().min(1),
  platformFeePercent: z.coerce.number().min(0).max(100),
  maintenanceMode: z.boolean(),
});

export type AppUser = z.infer<typeof UserSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type UserAdminUpdateInput = z.infer<typeof UserAdminUpdateSchema>;
export type DocumentCertificationInput = z.infer<typeof DocumentCertificationSchema>;
export type SystemConfigInput = z.infer<typeof SystemConfigSchema>;
