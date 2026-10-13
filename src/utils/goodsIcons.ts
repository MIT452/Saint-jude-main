// src/utils/goodsIcons.ts
// Icônes de marchandises, à 3 niveaux :
//   1) dictionnaire local (instantané)
//   2) IA (Groq via le backend) si le nom est inconnu, résultat mémorisé
//   3) icône de secours 📦 si l'IA est indisponible : aucune marchandise n'est jamais sans icône.

export const ICONS: Record<string, string> = {
  rice: "🍚",
  grain: "🌾",
  coffee: "☕",
  vanilla: "🌿",
  clove: "🌿",
  spice: "🌶️",
  fruit: "🍎",
  vegetable: "🥬",
  tuber: "🥔",
  meat: "🥩",
  livestock: "🐄",
  fish: "🐟",
  poultry: "🐔",
  sugar: "🍬",
  oil: "🛢️",
  fuel: "⛽",
  cement: "🧱",
  wood: "🪵",
  metal: "🔩",
  tools: "🔧",
  clothes: "👕",
  bag: "🎒",
  jewelry: "💍",
  watch: "⌚",
  electronics: "📱",
  appliance: "🔌",
  furniture: "🪑",
  medicine: "💊",
  cosmetic: "🧴",
  drink: "🥤",
  book: "📚",
  toy: "🧸",
  vehicle: "🚗",
  package: "📦",
};

/** Liste des catégories autorisées (à garder IDENTIQUE à ICON_KEYS dans la route backend). */
export const ICON_KEYS = Object.keys(ICONS);

// Mots-clés reconnus sans appeler l'IA (français + malgache, sans accents, minuscules)
const LOCAL: Record<string, string[]> = {
  rice: ["riz", "vary", "gony"],
  grain: ["mais", "ble", "sorgho", "cereale", "voanjo", "haricot", "pois"],
  coffee: ["cafe", "kafe"],
  vanilla: ["vanille", "vanilla"],
  clove: ["girofle", "jirofo"],
  spice: ["epice", "poivre", "cannelle", "piment", "gingembre", "saonjo"],
  fruit: ["fruit", "voankazo", "banane", "mangue", "litchi", "orange", "ananas", "citron", "avocat", "pomme"],
  vegetable: ["legume", "anana", "tomate", "carotte", "oignon", "salade", "chou", "concombre"],
  tuber: ["manioc", "mahogo", "patate", "pomme de terre", "ovy", "taro"],
  meat: ["viande", "hena", "boeuf", "porc", "saucisse"],
  livestock: ["zebu", "betail", "vache", "cochon", "mouton", "chevre", "omby"],
  fish: ["poisson", "trondro", "crevette", "langouste", "crabe"],
  poultry: ["poulet", "akoho", "poule", "canard", "dinde", "oeuf"],
  sugar: ["sucre", "siramamy"],
  oil: ["huile", "diloilo", "fut", "bidon"],
  fuel: ["carburant", "essence", "gasoil", "petrole", "fuel", "gaz"],
  cement: ["ciment", "brique", "sable", "carrelage", "gravier"],
  wood: ["bois", "planche", "hazo", "madrier"],
  metal: ["fer", "tole", "clou", "acier", "ferraille", "zinc"],
  tools: ["outil", "marteau", "scie", "tournevis", "machine"],
  clothes: ["vetement", "habit", "chaussure", "lamba", "robe", "pantalon", "chemise", "friperie"],
  bag: ["sac a dos", "valise", "sacoche", "cartable"],
  jewelry: ["bijou", "bague", "collier", "bracelet", "or", "argent"],
  watch: ["montre", "horloge", "reveil"],
  electronics: ["telephone", "portable", "smartphone", "television", "tele", "ordinateur", "laptop", "radio", "batterie", "electro", "tablette"],
  appliance: ["frigo", "refrigerateur", "ventilateur", "fer a repasser", "mixeur", "cuisiniere", "congelateur", "climatiseur"],
  furniture: ["meuble", "table", "chaise", "lit", "armoire", "canape", "matelas"],
  medicine: ["medicament", "pharmacie", "fanafody", "pansement"],
  cosmetic: ["savon", "parfum", "creme", "shampoing", "cosmetique", "maquillage"],
  drink: ["boisson", "eau", "biere", "jus", "soda", "vin", "rhum", "toaka"],
  book: ["livre", "cahier", "papier", "bokin"],
  toy: ["jouet", "poupee", "ballon", "jeu"],
  vehicle: ["voiture", "moto", "velo", "pneu", "piece auto", "scooter"],
  package: ["colis", "carton", "boite", "paquet"],
};

export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Liste à plat (mot-clé -> catégorie), préparée une seule fois
const KEYWORDS: { word: string; key: string }[] = Object.entries(LOCAL).flatMap(
  ([key, words]) => words.map((word) => ({ word: normalizeName(word), key }))
);

/**
 * Niveau 1 : catégorie reconnue localement, sinon null.
 * - Le mot-clé doit correspondre à un MOT ENTIER (pluriel "s" accepté) :
 *   "table" ne se confond pas avec "vegetable", "lit" avec "litchi", "eau" avec "tableau".
 * - Si plusieurs catégories correspondent, le mot-clé le plus long (le plus précis) gagne.
 */
export function localIconKey(name: string): string | null {
  const n = normalizeName(name);
  if (!n) return null;

  const padded = ` ${n.replace(/[^a-z0-9]+/g, " ").trim()} `;
  let best: { word: string; key: string } | null = null;

  for (const k of KEYWORDS) {
    const hit = padded.includes(` ${k.word} `) || padded.includes(` ${k.word}s `);
    if (hit && (!best || k.word.length > best.word.length)) best = k;
  }
  return best ? best.key : null;
}

// ---------------------------------------------------------------------------
// Niveau 2 : IA (backend Render -> Groq), avec mémoire côté navigateur
// ---------------------------------------------------------------------------

// Adaptez ces deux fonctions si votre projet gère l'URL / le token autrement
// (par exemple comme dans src/data/service.ts).
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

const STORAGE_KEY = "stjude_goods_icon_cache_v1";
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
    for (const [k, v] of Object.entries(obj)) if (ICONS[v]) memoryCache.set(k, v);
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

/** Icône déjà connue (dictionnaire OU réponse IA mémorisée), sinon null. Instantané. */
export function getKnownIconKey(name: string): string | null {
  const local = localIconKey(name);
  if (local) return local;
  loadStorage();
  return memoryCache.get(normalizeName(name)) ?? null;
}

async function callBackend(name: string, timeoutMs: number): Promise<string | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    if ((import.meta as any).env?.DEV) {
      console.warn("[goodsIcons] VITE_API_URL absent : icône IA impossible, icône de secours utilisée.");
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
    return ICONS[data?.icon_key] ? (data.icon_key as string) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retourne TOUJOURS une clé d'icône valide (jamais d'erreur) :
 * dictionnaire -> mémoire -> IA (2 essais, le serveur gratuit peut mettre du temps à se réveiller) -> "package".
 */
export function resolveIconKey(name: string): Promise<string> {
  const known = getKnownIconKey(name);
  if (known) return Promise.resolve(known);

  const key = normalizeName(name);
  if (!key) return Promise.resolve("package");

  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async () => {
    let icon = await callBackend(name, 25000);
    if (!icon) icon = await callBackend(name, 25000); // 2e essai (réveil de Render)
    if (icon) {
      memoryCache.set(key, icon);
      saveStorage();
      return icon;
    }
    return "package"; // niveau 3 : secours, non mémorisé pour pouvoir réessayer plus tard
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}