import { getToken } from "./session";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function api<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const token = init?.token ?? getToken();
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message ?? "Conflict"), {
      status: 409,
      body: err,
    });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.message === "string" ? err.message : res.statusText,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
