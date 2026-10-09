/* =========================================================
   reservationParser.ts
   Parseur déterministe (sans IA) pour les réservations Saint-Jude.

   Principe : le client parle librement, l'assistant s'adapte.
   - AUCUNE valeur imposée : marchandise, unité, quantité, ports et dates
     viennent uniquement de ce que dit le client.
   - Plusieurs informations dans une phrase → toutes extraites.
   - Une seule question ciblée à la fois pour ce qui manque.
   - Corrections : le brouillon est mis à jour sans tout recommencer.
========================================================= */

export interface ReservationDraft {
  depart?: string;
  arrivee?: string;
  date?: string; // YYYY-MM-DD
  passagers?: number;
  marchandise?: string; // libre : ce que le client écrit (« vêtements », « farine »...)
  unite?: string; // libre, au singulier : colis, sac, palette...
  quantite?: number;
  poidsKg?: number; // poids tel que donné par le client
  poidsMode?: "unitaire" | "total"; // le poids est-il par unité ou au total ?
  poidsTotalKg?: number; // calculé avant l'envoi au backend
}

/** Réponse du backend avant le récapitulatif (disponibilité + prix réel). */
export interface ReservationQuote {
  available: boolean;
  totalPrice?: number;
  message?: string;
}

export type RequestKind = "passager" | "marchandise";

export type Field =
  | "type"
  | "marchandise"
  | "destination"
  | "depart"
  | "quantite"
  | "poids"
  | "poidsMode"
  | "date"
  | "passagers";

export type Intent =
  | "reserver"
  | "disponibilite"
  | "annuler"
  | "aide"
  | "confirmer"
  | "refuser"
  | "inconnu";

/* =========================================================
   Utilitaires de texte
========================================================= */
export const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

const isUpper = (s: string) => /^\p{Lu}/u.test(s);

export const MONTHS = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
export const DAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

// Conditionnements courants (génériques : ce ne sont PAS des marchandises).
// Un conditionnement inconnu est quand même compris dans « 5 palettes de savon ».
export const UNIT_WORDS = [
  "colis","sacs","sac","cartons","carton","caisses","caisse","futs","fut","bidons","bidon",
  "palettes","palette","balles","balle","ballots","ballot","paquets","paquet","boites","boite",
  "bouteilles","bouteille","tonneaux","tonneau","conteneurs","conteneur","valises","valise","bagages","bagage",
];
const UNITS = UNIT_WORDS.join("|");
const PEOPLE_WORDS = new Set(["personne","personnes","passager","passagers","adulte","adultes","pers"]);
const WEIGHT_WORDS = new Set(["poids", "kg", "kilo", "kilos", "tonne", "tonnes"]);
const GOODS_VERBS = new Set([
  "envoyer","envoie","envoyons","expedier","expedie","transporter","transporte","acheminer","achemine",
]);

export const formatDateFr = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatDateLong = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/* ---------- Nombres en lettres ---------- */
const NUM_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100,
};
const NUM_FR = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
export const say = (n: number) => (n >= 0 && n <= 10 ? NUM_FR[n] : String(n));

/** « trois colis » → « 3 colis », « quinze octobre » → « 15 octobre » */
export function wordsToDigits(text: string): string {
  const names = Object.keys(NUM_WORDS)
    .filter((k) => k !== "un" && k !== "une")
    .join("|");
  const big = new RegExp(`\\b(${names})(?=\\s+[a-zà-ÿ])`, "gi");
  const one = new RegExp(`\\b(?:un|une)(?=\\s+(?:${UNITS}|personnes?|passagers?|adultes?)(?![a-zà-ÿ]))`, "gi");
  return text.replace(big, (_m, w: string) => String(NUM_WORDS[w.toLowerCase()])).replace(one, "1");
}

/* ---------- Unités ---------- */
function singularUnit(raw: string): string {
  const s = raw.toLowerCase().replace(/[^\p{L}]/gu, "");
  if (s === "colis") return s;
  if (s.endsWith("eaux")) return s.slice(0, -1);
  if (s.length > 3 && s.endsWith("s")) return s.slice(0, -1);
  return s;
}

export const pluralUnit = (u: string, n: number) => {
  if (n <= 1) return u;
  if (u === "colis" || /[sx]$/.test(u)) return u;
  return u.endsWith("eau") ? `${u}x` : `${u}s`;
};

const isPluralWord = (m: string) => /[sx]$/i.test(m);
export const possessive = (m: string) => (isPluralWord(m) ? `vos ${m}` : `votre ${m}`);

/* =========================================================
   Intention
========================================================= */
export function detectIntent(text: string): Intent {
  const t = strip(text);
  if (/^(oui|ok|d'accord|confirme|confirmer|valide|valider)\b/.test(t)) return "confirmer";
  // « modifier / changer / corriger » = refuser le récapitulatif pour le corriger
  if (/^(non|no|nope|modifier|changer|corriger)\b/.test(t)) return "refuser";
  if (/annul/.test(t)) return "annuler";
  if (/disponib|place|reste|libre/.test(t) && !/reserv|book/.test(t)) return "disponibilite";
  if (/reserv|book|voyag|envoy|transport|expedi|aller|partir|trajet|billet|colis|marchandise|passager/.test(t)) {
    return "reserver";
  }
  if (/aide|help|comment|que peux/.test(t)) return "aide";
  return "inconnu";
}

/* =========================================================
   Dates (relatives → date exacte selon la date locale)
========================================================= */
export interface DateInfo {
  date: string; // YYYY-MM-DD
  /** « vendredi » dit un vendredi : aujourd'hui ou dans 7 jours ? → à faire confirmer */
  ambiguous: boolean;
}

export function parseDateInfo(text: string, now = new Date()): DateInfo | undefined {
  const t = strip(text);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/apres[- ]demain/.test(t)) { base.setDate(base.getDate() + 2); return { date: iso(base), ambiguous: false }; }
  if (/\bdemain\b/.test(t)) { base.setDate(base.getDate() + 1); return { date: iso(base), ambiguous: false }; }
  if (/aujourd/.test(t)) return { date: iso(base), ambiguous: false };

  const iso1 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso1) return { date: iso1[0], ambiguous: false };

  // 12/10/2026 ou 12-10 ; le point n'est accepté qu'avec l'année (12.10.2026),
  // pour ne pas confondre un poids « 10.5 kg » avec une date
  const num =
    t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/) ??
    t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (num) {
    const y = num[3] ? (num[3].length === 2 ? 2000 + +num[3] : +num[3]) : now.getFullYear();
    const d = new Date(y, +num[2] - 1, +num[1]);
    if (!num[3] && d < base) d.setFullYear(y + 1);
    return { date: iso(d), ambiguous: false };
  }

  const txt = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?\\b`));
  if (txt) {
    const y = txt[3] ? +txt[3] : now.getFullYear();
    const d = new Date(y, MONTHS.indexOf(txt[2]), +txt[1]);
    if (!txt[3] && d < base) d.setFullYear(y + 1);
    return { date: iso(d), ambiguous: false };
  }

  const wd = t.match(new RegExp(`\\b(${DAYS.join("|")})\\b(\\s+prochain)?`));
  if (wd) {
    const target = DAYS.indexOf(wd[1]);
    let diff = (target - base.getDay() + 7) % 7;
    let ambiguous = false;
    if (diff === 0) {
      diff = 7;
      ambiguous = !wd[2]; // « vendredi prochain » n'est pas ambigu
    }
    base.setDate(base.getDate() + diff);
    return { date: iso(base), ambiguous };
  }
  return undefined;
}

export const parseDate = (text: string, now = new Date()) => parseDateInfo(text, now)?.date;

/* =========================================================
   Trajet : départ → arrivée
========================================================= */
type Role = "depart" | "arrivee";
type RouteDraft = Pick<ReservationDraft, "depart" | "arrivee">;

// Mots qui ne sont jamais un nom de lieu (aucune marchandise n'est listée ici : le client choisit)
const STOP_WORDS = new Set<string>([
  "de","du","des","depuis","a","au","aux","vers","pour","jusqu'a","jusqua",
  "le","la","les","l","un","une","et","ou","avec","sans","sur","dans","en","ce","cette","afin","car","que","qui",
  "je","j","j'ai","jai","veux","voudrais","souhaite","aimerais","aller","rendre","reserver","reservation",
  "voyage","trajet","port","ville",
  "svp","stp","merci","bonjour","salut","ok","oui","non","annuler",
  "demain","apres","aujourd'hui","aujourdhui","aujourd","prochain","prochaine","soir","matin",
  "kg","kilo","kilos","tonne","tonnes","poids","total","chaque","chacun","chacune",
  "passager","passagers","personne","personnes","adulte","adultes",
  "marchandise","marchandises",
  ...GOODS_VERBS,
  ...DAYS,
  ...MONTHS,
  ...UNIT_WORDS,
]);

const ORIGIN_MARKS = new Set(["de", "depuis"]);
const DEST_MARKS = new Set(["a", "vers", "pour", "jusqu'a", "jusqua", "au"]);
const SKIP_AFTER_DEST = new Set(["aller", "rendre", "a", "vers", "jusqu'a", "jusqua", "au", "le", "la", "les", "l", "port", "ville"]);
const PLACE_NOUNS = new Set(["port", "ville"]);

interface Tok {
  raw: string; // texte d'origine (accents et majuscules conservés)
  norm: string; // sans accents, en minuscules
  end: boolean; // le mot termine une proposition (virgule, point...)
}

function tokenize(text: string): Tok[] {
  const prepared = text
    .replace(/\s*(->|→|=>)\s*/g, " → ")
    .replace(/\b[dD]['’]\s*(?=\p{L})/gu, "de ") // d'Antananarivo → de Antananarivo
    .replace(/\s+/g, " ")
    .trim();
  if (!prepared) return [];

  return prepared.split(" ").map((w) => {
    if (w === "→") return { raw: "→", norm: "→", end: false };
    const clean = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    return {
      raw: clean(w),
      norm: clean(strip(w).replace(/’/g, "'")),
      end: /[,;.!?:]$/.test(w),
    };
  });
}

const isStopTok = (t: Tok) => t.norm === "" || t.norm === "→" || /^\d/.test(t.norm) || STOP_WORDS.has(t.norm);

// Lit un lieu (1 mot, ou 2 si le second commence par une majuscule) vers la droite
function readPlaceForward(toks: Tok[], start: number): { name: string; next: number } | null {
  const parts: string[] = [];
  let i = start;
  while (i < toks.length && parts.length < 2 && !isStopTok(toks[i])) {
    if (parts.length === 1 && !isUpper(toks[i].raw)) break;
    parts.push(toks[i].raw);
    const ended = toks[i].end;
    i++;
    if (ended) break;
  }
  return parts.length ? { name: titleCase(parts.join(" ")), next: i } : null;
}

// Lit un lieu vers la gauche (utilisé avec la flèche « → »)
function readPlaceBackward(toks: Tok[], last: number): string | null {
  const parts: string[] = [];
  let i = last;
  while (i >= 0 && parts.length < 2 && !isStopTok(toks[i])) {
    if (parts.length === 1 && (!isUpper(toks[i].raw) || toks[i].end)) break;
    parts.unshift(toks[i].raw);
    i--;
  }
  return parts.length ? titleCase(parts.join(" ")) : null;
}

// Après « à / vers / pour » : saute « aller », « le port de »... puis lit le lieu
function readPlaceAfterDestMark(toks: Tok[], start: number): { name: string; next: number } | null {
  let k = start;
  while (k < toks.length) {
    const w = toks[k].norm;
    if (SKIP_AFTER_DEST.has(w)) { k++; continue; }
    if ((w === "de" || w === "du") && k > 0 && PLACE_NOUNS.has(toks[k - 1].norm)) { k++; continue; }
    break;
  }
  return readPlaceForward(toks, k);
}

// « 2 colis de vêtements » : ce « de » introduit une marchandise, pas un départ
function originAllowed(toks: Tok[], i: number): boolean {
  const prev = toks[i - 1];
  if (!prev) return true;
  const blocked = UNIT_WORDS.includes(prev.norm) || /^\d/.test(prev.norm) || WEIGHT_WORDS.has(prev.norm);
  if (!blocked) return true;
  const next = toks[i + 1];
  return !!next && isUpper(next.raw);
}

function roleFromText(before: string): Role | undefined {
  const b = before.replace(/\s+/g, " ").trimEnd();
  if (/(?:^|\s)(?:de|depuis)$/.test(b) || /(?:^|\s)d'$/.test(b)) return "depart";
  if (/(?:^|\s)(?:a|vers|pour|jusqu'a|jusqua|au)(?:\s+(?:aller|rendre))?$/.test(b)) return "arrivee";
  return undefined;
}

export function parseRoute(
  text: string,
  knownPlaces: string[] = [],
  context: RouteDraft = {},
): RouteDraft {
  // 1) Lieux connus (ports des trajets en base) : détection la plus fiable
  const t = strip(text).replace(/’/g, "'").replace(/\s+/g, " ");
  const known = knownPlaces
    .filter(Boolean)
    .map((place) => ({ place, key: strip(place).replace(/’/g, "'") }))
    .filter((x) => x.key)
    .sort((a, b) => b.key.length - a.key.length); // les noms longs d'abord

  const taken: Array<[number, number]> = [];
  const found: Array<{ place: string; index: number; role?: Role }> = [];
  for (const { place, key } of known) {
    const m = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escapeRegExp(key)})(?=$|[^\\p{L}\\p{N}])`, "u").exec(t);
    if (!m) continue;
    const index = m.index + m[0].length - m[1].length;
    const end = index + key.length;
    if (taken.some(([s, e]) => index < e && end > s)) continue; // chevauchement
    taken.push([index, end]);
    found.push({ place, index, role: roleFromText(t.slice(0, index)) });
  }

  if (found.length) {
    found.sort((a, b) => a.index - b.index);
    let depart = found.find((f) => f.role === "depart")?.place;
    let arrivee = found.find((f) => f.role === "arrivee")?.place;
    for (const f of found.filter((x) => !x.role)) {
      if (!depart && !context.depart) depart = f.place;
      else if (!arrivee && !context.arrivee) arrivee = f.place;
    }
    return { depart, arrivee };
  }

  // 2) Texte libre, sans dépendre des majuscules (utile pour la dictée vocale)
  const toks = tokenize(text);

  // 2a. « X → Y »
  const arrow = toks.findIndex((x) => x.raw === "→");
  if (arrow > 0) {
    const from = readPlaceBackward(toks, arrow - 1);
    const to = readPlaceForward(toks, arrow + 1);
    if (from || to) return { depart: from ?? undefined, arrivee: to?.name };
  }

  // 2b. « de X à Y », « d'X vers Y », « depuis X jusqu'à Y », « de X pour aller à Y »
  for (let i = 0; i < toks.length; i++) {
    if (!ORIGIN_MARKS.has(toks[i].norm) || !originAllowed(toks, i)) continue;
    const from = readPlaceForward(toks, i + 1);
    if (!from) continue; // « de 10 kg »... n'est pas un lieu
    const k = from.next;
    if (k >= toks.length || !DEST_MARKS.has(toks[k].norm)) continue;
    const to = readPlaceAfterDestMark(toks, k + 1);
    if (to) return { depart: from.name, arrivee: to.name };
  }

  // 2c. Destination seule : « vers Y », « à Y », « pour aller à Y », « pour Y »
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].norm;
    const isDestMark =
      w === "vers" || w === "pour" || w === "jusqu'a" || w === "jusqua" || (w === "a" && toks[i].raw === "à");
    if (!isDestMark) continue;
    const to = readPlaceAfterDestMark(toks, i + 1);
    if (to) return { arrivee: to.name };
  }

  // 2d. Départ seul : « de X », « depuis X »
  for (let i = 0; i < toks.length; i++) {
    if (!ORIGIN_MARKS.has(toks[i].norm) || !originAllowed(toks, i)) continue;
    const from = readPlaceForward(toks, i + 1);
    if (from) return { depart: from.name };
  }

  return {};
}

// Réponse courte du type « Toamasina » à la question « quel port de départ ? »
function parseLonePlace(text: string): string | undefined {
  const toks = tokenize(text);
  if (toks.length === 0 || toks.length > 2) return undefined;
  if (toks.some(isStopTok)) return undefined;
  return titleCase(toks.map((x) => x.raw).join(" "));
}

// Réponse courte à « Quelle quantité ? » : « 3 », « trois », « un seul »
function parseLoneNumber(text: string): number | undefined {
  const t = strip(text).replace(/[.!?]+$/, "");
  const d = t.match(/\b(\d{1,4})\b/);
  if (d) return +d[1];
  const w = t.match(new RegExp(`\\b(${Object.keys(NUM_WORDS).join("|")})\\b`));
  if (w) return NUM_WORDS[w[1]];
  if (/\bseule?\b/.test(t)) return 1;
  return undefined;
}

/* =========================================================
   Marchandise : texte LIBRE (rien n'est imposé)
   Comprend « envoyer du <X> », « 3 colis de <X> », « 5 palettes de <X> »,
   « 20 kg de <X> »... pour n'importe quel <X> choisi par le client.
========================================================= */
interface WTok {
  raw: string;
  norm: string;
  end: boolean;
}

function wtokens(text: string): WTok[] {
  const prepared = text
    .replace(/\b[dD]['’]\s*(?=\p{L})/gu, "de ")
    .replace(/\b[lL]['’]\s*(?=\p{L})/gu, "le ")
    .replace(/\s+/g, " ")
    .trim();
  if (!prepared) return [];
  const clean = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return prepared.split(" ").map((w) => ({
    raw: w,
    norm: clean(strip(w).replace(/’/g, "'")),
    end: /[,;.!?:]$/.test(w),
  }));
}

const ARTICLES = new Set([
  "du","de","des","d","la","le","les","l","un","une","mon","ma","mes","son","sa","ses","notre","nos","quelques","plusieurs",
]);
const GOODS_BOUNDARY = new Set<string>([...STOP_WORDS, "pesant", "pese", "pesent", "par", "environ", "ensemble", "global", "quelque", "chose", "truc", "machin"]);

// Après un verbe d'envoi : saute articles, nombres, conditionnements et poids (« 3 colis de 20 kg de … »)
function skipForGoods(toks: WTok[], i: number): number {
  while (i < toks.length) {
    const n = toks[i].norm;
    if (
      ARTICLES.has(n) ||
      /^\d/.test(n) ||
      UNIT_WORDS.includes(n) ||
      WEIGHT_WORDS.has(n) ||
      n === "marchandise" ||
      n === "marchandises"
    ) {
      i++;
    } else break;
  }
  return i;
}

// Lit la marchandise (1 à 3 mots) jusqu'à un mot-frontière (à, vers, depuis, nombre, jour...)
function readGoods(toks: WTok[], start: number): { value: string; from: number; to: number } | null {
  let i = start;
  while (i < toks.length && ARTICLES.has(toks[i].norm)) i++;
  const from = i;
  const parts: string[] = [];
  while (i < toks.length && parts.length < 3) {
    const t = toks[i];
    if (t.norm === "" || /^\d/.test(t.norm) || GOODS_BOUNDARY.has(t.norm)) break;
    parts.push(t.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
    i++;
    if (t.end) break;
  }
  return parts.length ? { value: parts.join(" ").toLowerCase(), from, to: i } : null;
}

export interface ParsedGoods {
  marchandise?: string;
  unite?: string; // singulier
  quantite?: number;
  /** Le texte sans la marchandise lue (pour que « riz » ne soit jamais pris pour un port). */
  rest: string;
}

export function parseGoods(text: string, knownPlaces: string[] = []): ParsedGoods {
  const toks = wtokens(wordsToDigits(text));
  const known = new Set(knownPlaces.map((p) => strip(p).replace(/’/g, "'")));
  const out: ParsedGoods = { rest: "" };
  const drop = new Set<number>();

  // Une marchandise n'est jamais un port connu ni un mot capitalisé (« colis de Toamasina »)
  const accept = (g: { value: string; from: number; to: number }) => {
    for (let k = g.from; k < g.to; k++) {
      if (isUpper(toks[k].raw) || known.has(toks[k].norm)) return false;
    }
    return !known.has(strip(g.value));
  };
  const take = (g: { value: string; from: number; to: number }) => {
    out.marchandise = g.value;
    for (let k = g.from; k < g.to; k++) drop.add(k);
  };

  // 1) « 3 colis de <X> », « 5 palettes de <X> », « 10 litres d'<X> »
  for (let i = 0; i < toks.length; i++) {
    const n = toks[i].norm;
    const prevNum = i > 0 && /^\d+$/.test(toks[i - 1].norm);
    const nextDe = toks[i + 1]?.norm === "de";
    const isUnit =
      UNIT_WORDS.includes(n) ||
      (prevNum && nextDe && /^[a-z]{3,}$/.test(n) && !STOP_WORDS.has(n) && !PEOPLE_WORDS.has(n));
    if (!isUnit) continue;
    if (!out.unite) {
      out.unite = singularUnit(toks[i].raw);
      if (prevNum) out.quantite = parseInt(toks[i - 1].norm, 10);
    }
    if (!out.marchandise && nextDe) {
      const g = readGoods(toks, i + 2);
      if (g && accept(g)) take(g);
    }
  }

  // 2) « envoyer du <X> », « expédier 20 kg de <X> »
  if (!out.marchandise) {
    for (let i = 0; i < toks.length; i++) {
      if (!GOODS_VERBS.has(toks[i].norm)) continue;
      const g = readGoods(toks, skipForGoods(toks, i + 1));
      if (g && accept(g)) {
        take(g);
        break;
      }
    }
  }

  out.rest = toks.filter((_, k) => !drop.has(k)).map((t) => t.raw).join(" ");
  return out;
}

/* =========================================================
   Quantités, poids, passagers
========================================================= */
type Quantities = Pick<ReservationDraft, "passagers" | "poidsKg">;

export function parseQuantities(text: string): Quantities {
  const t = strip(wordsToDigits(text));
  const out: Quantities = {};

  const pax = t.match(/\b(\d{1,3})\s*(personnes?|passagers?|pers\b|adultes?)/);
  if (pax) out.passagers = +pax[1];

  const kg = t.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilos?|tonnes?|t\b)/);
  if (kg) {
    const v = parseFloat(kg[1].replace(",", "."));
    out.poidsKg = /^t/.test(kg[2]) ? v * 1000 : v;
  }
  return out;
}

// Le poids donné est-il par unité ("10 kg par colis") ou au total ?
export function parseWeightMode(text: string): ReservationDraft["poidsMode"] {
  const t = strip(text);
  if (
    /\bpar\s+(colis|sac|carton|caisse|fut|bidon|palette|paquet|ballot|piece|unite)|\bchacun|\bchacune|\bchaque\b|l'unite|\bunitaire\b|\bindividuel/.test(
      t,
    )
  ) {
    return "unitaire";
  }
  if (/au total|poids total|\btotal\b|en tout|\bensemble\b|\bglobal/.test(t)) return "total";
  return undefined;
}

/* =========================================================
   Fusion du brouillon : le client parle librement
========================================================= */
export function mergeDraft(
  prev: ReservationDraft,
  text: string,
  knownPlaces: string[] = [],
  expecting: Field | null = null,
): ReservationDraft {
  // Marchandise (texte libre). Si on vient de la demander, toute réponse courte est acceptée.
  const goods = parseGoods(text, knownPlaces);
  let marchandise = goods.marchandise;
  if (!marchandise && expecting === "marchandise") {
    marchandise = parseGoods(`envoyer ${text.toLowerCase()}`, knownPlaces).marchandise;
    if (!marchandise) {
      const bare = text
        .trim()
        .replace(/[.!?,;]+$/g, "")
        .toLowerCase()
        .replace(/^(?:du|de la|de l['’]|des|de|d['’]|un|une|le|la|les)\s*/, "")
        .trim();
      if (bare && bare.split(" ").length <= 3 && !/\d/.test(bare) && detectIntent(bare) === "inconnu") {
        marchandise = bare;
      }
    }
  }

  const route = parseRoute(goods.rest, knownPlaces, { depart: prev.depart, arrivee: prev.arrivee });
  const q = parseQuantities(text);
  const date = parseDate(wordsToDigits(text));
  const mode = parseWeightMode(text);
  const next: ReservationDraft = { ...prev };

  // Réponse « Mahajanga » sans préposition : on l'affecte à la question posée
  let { depart, arrivee } = route;
  const explicit = /\b(depuis|de|vers|pour|jusqu)\b|\bd['’]/.test(strip(goods.rest));
  if (!explicit) {
    if (expecting === "destination" && depart && !arrivee && !prev.arrivee) { arrivee = depart; depart = undefined; }
    else if (expecting === "depart" && arrivee && !depart && !prev.depart) { depart = arrivee; arrivee = undefined; }
  }
  if (depart) next.depart = depart;
  if (arrivee) next.arrivee = arrivee;

  // Réponse très courte : affectée à la question qui vient d'être posée
  const gotGoods = !!(marchandise || goods.unite || goods.quantite !== undefined);
  const nothingElse =
    !depart && !arrivee && !date && !mode && q.passagers === undefined && q.poidsKg === undefined && !gotGoods;
  if (nothingElse) {
    const lone = parseLonePlace(text);
    const n = parseLoneNumber(text);
    if (expecting === "depart" && lone) next.depart = lone;
    else if (expecting === "destination" && lone) next.arrivee = lone;
    else if (expecting === "quantite" && n !== undefined) next.quantite = n;
    else if (expecting === "passagers" && n !== undefined) next.passagers = n;
    else if (expecting === "poids" && n !== undefined) { next.poidsKg = n; next.poidsMode = undefined; }
    else if (!expecting && lone) {
      if (!prev.depart && prev.arrivee) next.depart = lone;
      else if (prev.depart && !prev.arrivee) next.arrivee = lone;
    }
  }

  if (date) next.date = date;
  if (marchandise) next.marchandise = marchandise;
  if (goods.unite) next.unite = goods.unite;
  if (goods.quantite !== undefined) next.quantite = goods.quantite;
  if (q.passagers !== undefined) next.passagers = q.passagers;
  if (q.poidsKg !== undefined) {
    next.poidsKg = q.poidsKg;
    // nouveau poids sans précision → on redemandera s'il est par unité ou total
    next.poidsMode = mode;
  } else if (mode) {
    next.poidsMode = mode;
  }
  return next;
}

/* =========================================================
   Poids, questions, récapitulatif
========================================================= */
// Poids total réel (undefined tant que l'ambiguïté « par unité / total » n'est pas levée)
export function getPoidsTotal(d: ReservationDraft): number | undefined {
  if (d.poidsKg === undefined) return undefined;
  if (d.quantite && d.quantite > 1) {
    if (d.poidsMode === "unitaire") return d.poidsKg * d.quantite;
    if (d.poidsMode === "total") return d.poidsKg;
    return undefined;
  }
  return d.poidsKg;
}

export const needsWeightClarification = (d: ReservationDraft) =>
  !!d.quantite && d.quantite > 1 && d.poidsKg !== undefined && !d.poidsMode;

export const hasInfo = (d: ReservationDraft) => Object.values(d).some((v) => v !== undefined);

export const inferKind = (d: ReservationDraft): RequestKind | null =>
  d.passagers
    ? "passager"
    : d.marchandise || d.unite || d.quantite || d.poidsKg !== undefined
      ? "marchandise"
      : null;

// Démarrage guidé : aucune valeur imposée, c'est le client qui donne ses informations
export const GUIDED: Record<string, RequestKind> = {
  "Billet passager": "passager",
  "Transport de marchandises": "marchandise",
};
export const GUIDED_CHOICES = Object.keys(GUIDED);

/** « Compris, trois colis de 20 kg, soit 60 kg au total. » (uniquement avec les valeurs du client) */
export function ackWeight(d: ReservationDraft): string {
  const total = getPoidsTotal(d);
  if (total === undefined) return "";
  const unit = d.unite ?? "unité";
  const qty = d.quantite ?? 1;
  if (qty === 1) return `Compris, ${d.unite ? `1 ${unit} de` : "un envoi de"} ${total} kg.`;
  const each = d.poidsMode === "unitaire" ? d.poidsKg! : Math.round((total / qty) * 100) / 100;
  return `Compris, ${say(qty)} ${pluralUnit(unit, qty)} de ${each} kg, soit ${total} kg au total.`;
}

export interface Question {
  field: Field;
  text: string;
  choices?: string[];
}

/** UNE seule question ciblée, dans l'ordre du dialogue. null = tout est connu. */
export function nextQuestion(d: ReservationDraft, kind: RequestKind | null): Question | null {
  if (!kind) {
    return {
      field: "type",
      text: "D’accord ! Souhaitez-vous réserver un billet passager ou envoyer des marchandises ?",
      choices: GUIDED_CHOICES,
    };
  }

  if (kind === "passager") {
    if (!d.depart) return { field: "depart", text: "D’accord ! Depuis quel port souhaitez-vous partir ?" };
    if (!d.arrivee) return { field: "destination", text: `Très bien, au départ de ${d.depart}. Quelle est votre destination ?` };
    if (!d.passagers) return { field: "passagers", text: "Combien de passagers voyageront ?" };
    if (!d.date) return { field: "date", text: "Pour quelle date souhaitez-vous voyager ?" };
    return null;
  }

  // Marchandises : ordre du dialogue attendu
  const goods = d.marchandise ? possessive(d.marchandise) : "votre marchandise";
  const pron = d.marchandise && isPluralWord(d.marchandise) ? "les" : "l’";
  const unit = d.unite ?? "unité";

  if (!d.marchandise) return { field: "marchandise", text: "D’accord ! Quelle marchandise souhaitez-vous envoyer ?" };
  if (!d.arrivee) {
    return { field: "destination", text: `D’accord pour ${goods} ! Vers quelle destination souhaitez-vous ${pron}envoyer ?` };
  }
  if (!d.depart) return { field: "depart", text: `D’accord ! Depuis quel port souhaitez-vous envoyer ${goods} ?` };
  if (!d.quantite) return { field: "quantite", text: "Très bien. Quelle quantité souhaitez-vous envoyer ?" };
  if (d.poidsKg === undefined) {
    return {
      field: "poids",
      text:
        d.quantite > 1
          ? `Compris pour ${say(d.quantite)} ${pluralUnit(unit, d.quantite)}. Connaissez-vous le poids de chaque ${unit} ou le poids total ?`
          : "Quel est le poids de votre envoi (en kg) ?",
    };
  }
  if (needsWeightClarification(d)) {
    return {
      field: "poidsMode",
      text: `Les ${d.poidsKg} kg correspondent-ils au poids de chaque ${unit} ou au poids total des ${d.quantite} ${pluralUnit(unit, d.quantite!)} ?`,
      choices: [`Chaque ${unit}`, "Poids total"],
    };
  }
  if (!d.date) {
    return { field: "date", text: `${ackWeight(d)} Pour quelle date souhaitez-vous organiser le transport ?`.trim() };
  }
  return null;
}

/** Le client corrige une info déjà donnée → on le signale, sans recommencer. */
export function correctionNote(before: ReservationDraft, after: ReservationDraft): string {
  const parts: string[] = [];
  if (before.depart && after.depart && before.depart !== after.depart) parts.push(`départ : ${after.depart}`);
  if (before.arrivee && after.arrivee && before.arrivee !== after.arrivee) parts.push(`destination : ${after.arrivee}`);
  if (before.date && after.date && before.date !== after.date) parts.push(`date : ${formatDateLong(after.date)}`);
  if (before.marchandise && after.marchandise && before.marchandise !== after.marchandise) parts.push(`marchandise : ${after.marchandise}`);
  if (before.quantite && after.quantite && before.quantite !== after.quantite) parts.push(`quantité : ${after.quantite}`);
  if (before.poidsKg !== undefined && after.poidsKg !== undefined && before.poidsKg !== after.poidsKg) parts.push(`poids : ${after.poidsKg} kg`);
  if (before.passagers && after.passagers && before.passagers !== after.passagers) parts.push(`passagers : ${after.passagers}`);
  return parts.length ? `C’est corrigé (${parts.join(", ")}). ` : "";
}

/** Lignes lisibles du brouillon (texte et carte récapitulatif). */
export function draftRows(d: ReservationDraft): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Trajet", `${d.depart ?? "?"} → ${d.arrivee ?? "?"}`],
    ["Date", d.date ? formatDateFr(d.date) : "?"],
  ];
  if (d.passagers) rows.push(["Passagers", String(d.passagers)]);
  if (d.marchandise) rows.push(["Marchandise", d.marchandise]);
  if (d.quantite) rows.push(["Quantité", d.unite ? `${d.quantite} ${pluralUnit(d.unite, d.quantite)}` : String(d.quantite)]);
  const total = getPoidsTotal(d);
  if (total !== undefined) rows.push(["Poids total", `${total} kg`]);
  return rows;
}

export function summarize(d: ReservationDraft): string {
  return draftRows(d)
    .map(([label, value]) => `• ${label} : ${value}`)
    .join("\n");
}