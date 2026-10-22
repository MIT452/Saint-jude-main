// src/services/agentService.ts
// Appels HTTP vers l'assistant conversationnel (/api/ai/agent/*).
// IMPORTANT : copiez ici la même gestion d'authentification que dans ../data/intelligenceService
// (cookie de session ou en-tête Authorization), sinon requireAuth refusera les appels.

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface PendingView {
  marchandise: string;
  quantite: number;
  unite: string | null;
  poidsTotalKg: number;
  depart: string;
  arrivee: string;
  date: string;
  prix: number | null;
  bateau: string | null;
}

export interface AgentReply {
  conversationId: string;
  reply: string;
  pending: PendingView | null;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // const token = localStorage.getItem("token");           // ← adaptez à votre auth
  // if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/ai/agent/${path}`, {
    method: "POST",
    headers: headers(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? `Erreur ${res.status}`);
  return data as T;
}

export const agentChat = (message: string, conversationId?: string) =>
  post<AgentReply>("chat", { message, conversationId });

export const agentConfirm = (conversationId: string) =>
  post<{ ok: true; reply: string; reservationId: string; reservation: unknown }>("confirm", {
    conversationId,
  });

export const agentCancel = (conversationId: string) =>
  post<{ ok: true }>("cancel", { conversationId });