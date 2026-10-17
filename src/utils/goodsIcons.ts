// src/utils/goodsIcons.ts
// Icône de marchandise 100 % automatique : l'IA (Groq via le backend) choisit UN emoji selon le nom.
// Aucun dictionnaire, aucune catégorie prédéfinie.
// Le résultat est mémorisé dans le navigateur (le backend garde aussi sa propre mémoire) :
// un même nom n'est demandé qu'une fois à l'IA.
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
// Accepte « https://host », « https://host/ » et « https://host/api » :
// le chemin /api/ai/goods-icon est ajouté plus bas, il ne doit donc pas être en double.
const getApiUrl = (): string => {
  const env = (import.meta as any).env ?? {};
  const raw = String(env.VITE_API_URL ?? env.VITE_API_BASE_URL ?? "");
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
};
const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];
const getToken = (): string => {
  try {
    for (const key of TOKEN_KEYS) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
  } catch {
    /* stockage indisponible */
  }
  return "";
};

// --- Mémoire côté navigateur ---
// v3 : efface les 📦 de secours mémorisés par erreur avec les versions précédentes
const STORAGE_KEY = "stjude_goods_icon_cache_v3";
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

/* =========================
   File d'attente : au plus 3 appels à l'IA en même temps.
   Une page avec 10 marchandises différentes ne lance plus 10 appels d'un coup
   (ce qui dépassait la limite de Groq et laissait des 📦).
========================= */
const MAX_PARALLEL = 3;
let active = 0;
const waiting: Array<() => void> = [];
const acquire = () =>
  new Promise<void>((resolve) => {
    if (active < MAX_PARALLEL) {
      active++;
      resolve();
    } else {
      waiting.push(() => {
        active++;
        resolve();
      });
    }
  });
const release = () => {
  active--;
  const next = waiting.shift();
  if (next) next();
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Le serveur gratuit Render s'endort : un premier appel léger le réveille pendant que la file se prépare
let warmedUp = false;
function warmUp(apiUrl: string) {
  if (warmedUp) return;
  warmedUp = true;
  fetch(apiUrl, { mode: "no-cors" }).catch(() => {
    /* sans importance */
  });
}

async function callBackend(name: string, timeoutMs: number): Promise<string | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    if ((import.meta as any).env?.DEV) {
      console.warn("[goodsIcons] VITE_API_URL absent : l'IA ne peut pas être appelée.");
    }
    return null;
  }
  warmUp(apiUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${apiUrl}/api/ai/goods-icon`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      credentials: "include",
      body: JSON.stringify({ name }),
      signal: controller.signal,
    });
    if (!r.ok) {
      // Visible dans la console (F12) : 401 = jeton, 429 = trop d'appels, 5xx = serveur
      console.warn(`[goodsIcons] le serveur a répondu ${r.status} pour « ${name} »`);
      return null;
    }
    const data = await r.json();
    if (data?.fallback) return null; // icône de secours du serveur : ne pas mémoriser
    return isEmoji(data?.icon) ? (data.icon as string) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Pauses avant chaque essai (3 essais au total)
const RETRY_DELAYS_MS = [0, 1500, 5000];

/**
 * Retourne TOUJOURS un emoji (jamais d'erreur) :
 * mémoire -> IA (3 essais espacés, 3 appels simultanés maximum) -> 📦.
 * Un 📦 de secours n'est jamais mémorisé : on réessaiera plus tard.
 */
export function resolveIcon(name: string): Promise<string> {
  const known = getKnownIcon(name);
  if (known) return Promise.resolve(known);

  const key = normalizeName(name);
  if (!key) return Promise.resolve(FALLBACK_ICON);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async () => {
    for (const delay of RETRY_DELAYS_MS) {
      if (delay) await sleep(delay);
      await acquire();
      let icon: string | null = null;
      try {
        icon = await callBackend(name, 20000);
      } finally {
        release();
      }
      if (icon) {
        memoryCache.set(key, icon);
        saveStorage();
        return icon;
      }
    }
    return FALLBACK_ICON;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}