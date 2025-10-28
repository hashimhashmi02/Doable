export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function authHeaders(
  extra?: Record<string, string>
): HeadersInit {
  const token = getToken();
  const hdrs: Record<string, string> = { ...(extra ?? {}) };
  if (token) hdrs["Authorization"] = `Bearer ${token}`;
  return hdrs;
}

export async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}
