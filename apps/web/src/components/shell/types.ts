import type { UserRole } from "@/generated/prisma";

export type ShellUser = {
  email: string;
  name: string;
  role: UserRole;
  workspaceName: string;
  workspaceId: string;
};
