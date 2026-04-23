const TOKEN_KEY = "dealseal_token";
const TX_KEY = "dealseal_last_transaction_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getLastTransactionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TX_KEY);
}

export function setLastTransactionId(id: string): void {
  window.localStorage.setItem(TX_KEY, id);
}
