import { getToken } from "./session";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DEVICE_FINGERPRINT_HEADER = "x-dealseal-device-fingerprint";
let deviceFingerprintPromise: Promise<string> | null = null;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server";
  if (deviceFingerprintPromise) return deviceFingerprintPromise;
  deviceFingerprintPromise = (async () => {
    const material = [
      navigator.userAgent,
      String(window.screen?.width ?? 0),
      String(window.screen?.colorDepth ?? 0),
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown",
    ].join("|");
    const data = new TextEncoder().encode(material);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(new Uint8Array(digest));
  })();
  return deviceFingerprintPromise;
}

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
  headers.set(DEVICE_FINGERPRINT_HEADER, await getDeviceFingerprint());
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
