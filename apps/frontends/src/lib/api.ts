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

export function previewUrl() {
  return `${API}/preview?v=${Date.now()}`;
}

export async function renameProject(projectId: string, title: string) {
  const r = await fetch(`${API}/api/project/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title }),
  });
  return j<{ ok: boolean; project: any }>(r);
}

export async function deleteProject(projectId: string) {
  const r = await fetch(`${API}/api/project/${projectId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return j<{ ok: boolean }>(r);
}

export async function hideMessage(messageId: string, hidden: boolean) {
  const r = await fetch(`${API}/api/message/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ hidden }),
  });
  return j<{ ok: boolean; message: any }>(r);
}