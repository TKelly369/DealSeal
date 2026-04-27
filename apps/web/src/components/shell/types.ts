export type ShellUser = {
  email: string;
  name: string;
  role: "ADMIN" | "USER" | "DEALER_ADMIN" | "LENDER_ADMIN" | "PLATFORM_ADMIN";
  workspaceName: string;
  workspaceId: string;
};
