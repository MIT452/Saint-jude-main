export type ServerLog = {
  id: string | number;
  created_at: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  details: { body?: unknown; httpStatus?: number; email?: string; event?: string } | null;
  ip_address: string | null;
  result: string;
  status: string;
};

export type ServerAlert = {
  id: string | number;
  log_id: string | number;
  rule: string;
  severity: string;
  reviewed: boolean;
  false_positive: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  ip_address: string | null;
};

export type ChainState = { ok: boolean; count?: number; brokenAtId?: string };

const root = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "https://saint-jude-back.onrender.com"
).replace(/\/+$/, "");
const API = root.endsWith("/api") ? root : `${root}/api`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = init?.body ? { "Content-Type": "application/json" } : {};
  const res = await fetch(`${API}${path}`, { credentials: "include", ...init, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const fetchAuditLogs = (limit = 500) => call<ServerLog[]>(`/audit/logs?limit=${limit}`);

export const fetchAuditAlerts = (reviewed?: boolean) =>
  call<ServerAlert[]>(`/audit/alerts${reviewed === undefined ? "" : `?reviewed=${reviewed}`}`);

export const verifyAuditChain = () => call<ChainState>("/audit/verify");

export const reviewAuditAlert = (id: string | number, falsePositive: boolean) =>
  call<{ ok: boolean }>(`/audit/alerts/${encodeURIComponent(String(id))}/review`, {
    method: "PATCH",
    body: JSON.stringify({ falsePositive }),
  });