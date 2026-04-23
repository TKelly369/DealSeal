import { clearToken, getToken, setToken } from "./session";
import { api } from "./api-client";

export type Me = {
  user: {
    id: string;
    email: string;
    displayName: string;
    orgId: string;
    roles: string[];
    createdAt: string;
  };
};

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ token: string; userId: string; orgId: string }> {
  return api<{ token: string; userId: string; orgId: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
  organizationSlug: string;
}): Promise<{ token: string; userId: string; orgId: string }> {
  return api("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchMe(): Promise<Me> {
  return api<Me>("/auth/me", { method: "GET" });
}

export async function logoutServerThenLocal(): Promise<void> {
  try {
    if (getToken()) {
      await api("/auth/logout", { method: "POST" });
    }
  } catch {
    /* still clear */
  } finally {
    clearToken();
  }
}

export function saveSessionFromLogin(l: { token: string }): void {
  setToken(l.token);
}
