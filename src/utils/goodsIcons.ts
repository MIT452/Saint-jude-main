// src/utils/goodsIcons.ts
// Icône de marchandise 100 % automatique : l'IA (Groq via le backend) choisit UN emoji selon le nom.
// Aucun dictionnaire, aucune catégorie prédéfinie.
// Le résultat est mémorisé (navigateur + Neon) : un même nom n'est demandé qu'une fois à l'IA.
// Icône de secours : 📦 (pendant le chargement, ou si l'IA est indisponible).

export const FALLBACK_ICON = "📦";

export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Vérifie qu'on a bien un emoji (et pas du texte quelconque renvoyé par erreur)
const EMOJI_RE = new RegExp("\\p{Extended_Pictographic}", "u");
const isEmoji = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 16 && EMOJI_RE.test(v);

// --- Configuration de l'appel au backend (Render) ---
const getApiUrl = (): string => {
  const env = (import.meta as any).env ?? {};
  return String(env.VITE_API_URL ?? env.VITE_API_BASE_URL ?? "");
};
const getToken = (): string => {
  try {
    return localStorage.getItem("token") ?? "";
  } catch {
    return "";
  }
};

// --- Mémoire côté navigateur ---
const STORAGE_KEY = "stjude_goods_icon_cache_v2";
const memoryCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
let storageLoaded = false;

function loadStorage() {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) if (isEmoji(v)) memoryCache.set(k, v);
  } catch {
    /* stockage indisponible : on continue sans */
  }
}
function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memoryCache)));
  } catch {
    /* ignoré */
  }
}

/** Icône déjà connue (mémorisée), sinon null. Instantané, sans appel réseau. */
export function getKnownIcon(name: string): string | null {
  loadStorage();
  return memoryCache.get(normalizeName(name)) ?? null;
}

async function callBackend(name: string, timeoutMs: number): Promise<string | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    if ((import.meta as any).env?.DEV) {
      console.warn("[goodsIcons] VITE_API_URL absent : l'IA ne peut pas être appelée.");
    }
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${apiUrl}/api/ai/goods-icon`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name }),
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const data = await r.json();
    return isEmoji(data?.icon) ? (data.icon as string) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retourne TOUJOURS un emoji (jamais d'erreur) :
 * mémoire -> IA (2 essais : le serveur gratuit Render peut mettre du temps à se réveiller) -> 📦.
 */
export function resolveIcon(name: string): Promise<string> {
  const known = getKnownIcon(name);
  if (known) return Promise.resolve(known);

  const key = normalizeName(name);
  if (!key) return Promise.resolve(FALLBACK_ICON);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async () => {
    let icon = await callBackend(name, 25000);
    if (!icon) icon = await callBackend(name, 25000);
    if (icon) {
      memoryCache.set(key, icon);
      saveStorage();
      return icon;
    }
    return FALLBACK_ICON; // non mémorisé : on réessaiera plus tard
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}