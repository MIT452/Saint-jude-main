// src/data/auditAI.ts
// Appelle l'assistant IA du backend (route /api/ai/chat, protégée par requireAuth).
// Si l'appel échoue (réseau, token, format), les fonctions renvoient null :
// les pages utilisent alors une analyse locale calculée sur les vraies données.

const env = (import.meta as any).env ?? {};

const baseUrl = (): string => {
  const b = String(env.VITE_API_URL ?? env.VITE_BACKEND_URL ?? env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  return b.endsWith("/api") ? b : `${b}/api`;
};

const token = (): string | null =>
  localStorage.getItem("token") ?? localStorage.getItem("accessToken") ?? localStorage.getItem("authToken");

const pickText = (d: any): string | null => {
  if (!d) return null;
  if (typeof d === "string") return d;
  const t = d.reply ?? d.message ?? d.answer ?? d.response ?? d.content ?? d.text ?? d.data?.reply ?? d.data?.message;
  return typeof t === "string" ? t : null;
};

export async function askAI(prompt: string): Promise<string | null> {
  try {
    const t = token();
    const res = await fetch(`${baseUrl()}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ message: prompt, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    return pickText(await res.json());
  } catch {
    return null;
  }
}

export async function askAIJson<T>(prompt: string): Promise<T | null> {
  const text = await askAI(prompt);
  if (!text) return null;
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}