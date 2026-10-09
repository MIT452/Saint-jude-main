import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, Mic, MicOff, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import { askAssistant } from "../data/intelligenceService";
import type { ReservationRecord } from "../services/reservationService";
import { formatCurrency } from "../Tools/Tools";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/* =========================================================
   Utilitaires de texte
========================================================= */
const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

const isUpper = (s: string) => /^\p{Lu}/u.test(s);

/* =========================================================
   Statuts (voir la logique Saint-Jude)
   - Statut de RÉSERVATION : En attente / Confirmée / Annulée
   - Statut de PAIEMENT    : Crédit / Partiellement payé / Payé
   Le montant payé détermine le statut du paiement, pas celui de la réservation.
   Le calcul officiel est fait par le BACKEND ; ce fichier ne sert qu'à l'affichage.
========================================================= */
type PaymentStatus = "CREDIT" | "PARTIAL" | "PAID";

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  CREDIT: "Crédit",
  PARTIAL: "Partiellement payé",
  PAID: "Payé",
};

function getPaymentStatus(amountPaid: number, totalAmount: number): PaymentStatus {
  if (amountPaid < 0 || totalAmount < 0) {
    throw new Error("Montant invalide");
  }
  if (amountPaid === 0) return "CREDIT";
  if (amountPaid < totalAmount) return "PARTIAL";
  return "PAID";
}

// Statut de paiement lisible, uniquement si le backend renvoie le montant payé
function readPaymentLabel(record: ReservationRecord): string | null {
  const data = record as unknown as Record<string, unknown>;
  if (data.amountPaid === undefined || data.amountPaid === null) return null;
  const paid = Number(data.amountPaid);
  const total = Number(data.totalPrice);
  if (!Number.isFinite(paid) || !Number.isFinite(total)) return null;
  try {
    return PAYMENT_LABEL[getPaymentStatus(paid, total)];
  } catch {
    return null;
  }
}

const isCancelled = (status?: string) => strip(status ?? "").includes("annul");

/* =========================================================
   Parseur déterministe (sans IA)
   Comprend une demande de réservation en français.
   Aucune hallucination possible : si une info manque, on la demande.
========================================================= */
export interface ReservationDraft {
  depart?: string;
  arrivee?: string;
  date?: string; // YYYY-MM-DD
  passagers?: number;
  marchandise?: string; // type : riz, ciment...
  unite?: string; // colis, sacs...
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

type Intent =
  | "reserver"
  | "disponibilite"
  | "annuler"
  | "aide"
  | "confirmer"
  | "refuser"
  | "inconnu";

const MONTHS = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const DAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

const UNIT_WORDS = ["sacs","sac","cartons","carton","colis","caisses","caisse","futs","fut","bidons","bidon"];
const GOOD_WORDS = ["marchandises","marchandise","riz","ciment","meubles","meuble","motos","moto"];
const UNITS = UNIT_WORDS.join("|");
const GOODS = GOOD_WORDS.join("|");
const WEIGHT_WORDS = new Set(["poids", "kg", "kilo", "kilos", "tonne", "tonnes"]);

const formatDateFr = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "erreur inconnue";

const nowLabel = () =>
  new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function detectIntent(text: string): Intent {
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

function parseDate(text: string, now = new Date()): string | undefined {
  const t = strip(text);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/apres[- ]demain/.test(t)) { base.setDate(base.getDate() + 2); return iso(base); }
  if (/\bdemain\b/.test(t)) { base.setDate(base.getDate() + 1); return iso(base); }
  if (/aujourd/.test(t)) return iso(base);

  const iso1 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso1) return iso1[0];

  // 12/10/2026 ou 12-10 ; le point n'est accepté qu'avec l'année (12.10.2026),
  // pour ne pas confondre un poids « 10.5 kg » avec une date
  const num =
    t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/) ??
    t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (num) {
    const y = num[3] ? (num[3].length === 2 ? 2000 + +num[3] : +num[3]) : now.getFullYear();
    const d = new Date(y, +num[2] - 1, +num[1]);
    if (!num[3] && d < base) d.setFullYear(y + 1);
    return iso(d);
  }

  const txt = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?\\b`));
  if (txt) {
    const y = txt[3] ? +txt[3] : now.getFullYear();
    const d = new Date(y, MONTHS.indexOf(txt[2]), +txt[1]);
    if (!txt[3] && d < base) d.setFullYear(y + 1);
    return iso(d);
  }

  const wd = t.match(new RegExp(`\\b(${DAYS.join("|")})\\b(\\s+prochain)?`));
  if (wd) {
    const target = DAYS.indexOf(wd[1]);
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    base.setDate(base.getDate() + diff);
    return iso(base);
  }
  return undefined;
}

/* ---------- Trajet : départ → arrivée ---------- */

type Role = "depart" | "arrivee";
type RouteDraft = Pick<ReservationDraft, "depart" | "arrivee">;

// Mots qui ne sont jamais un nom de lieu
const STOP_WORDS = new Set<string>([
  "de","du","des","depuis","a","au","aux","vers","pour","jusqu'a","jusqua",
  "le","la","les","l","un","une","et","ou","avec","sans","sur","dans","en","ce","cette","afin","car","que","qui",
  "je","j","j'ai","jai","veux","voudrais","souhaite","aimerais","aller","rendre","reserver","reservation",
  "envoyer","expedier","transporter","voyage","trajet","port","ville",
  "svp","stp","merci","bonjour","salut","ok","oui","non","annuler",
  "demain","apres","aujourd'hui","aujourdhui","aujourd","prochain","prochaine","soir","matin",
  "kg","kilo","kilos","tonne","tonnes","poids","total","chaque","chacun","chacune",
  "passager","passagers","personne","personnes","adulte","adultes",
  ...DAYS,
  ...MONTHS,
  ...UNIT_WORDS,
  ...GOOD_WORDS,
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

function parseRoute(
  text: string,
  knownPlaces: string[] = [],
  context: RouteDraft = {},
): RouteDraft {
  // 1) Lieux connus (ex. ports des trajets) : détection la plus fiable
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
    if (!from) continue; // « de riz », « de 10 kg »... ne sont pas des lieux
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

/* ---------- Quantités, poids, marchandise ---------- */

type Quantities = Pick<
  ReservationDraft,
  "passagers" | "poidsKg" | "marchandise" | "unite" | "quantite"
>;

function parseQuantities(text: string): Quantities {
  const t = strip(text);
  const out: Quantities = {};

  const pax = t.match(/\b(\d{1,3})\s*(personnes?|passagers?|pers\b|adultes?)/);
  if (pax) out.passagers = +pax[1];

  const kg = t.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilos?|tonnes?|t\b)/);
  if (kg) {
    const v = parseFloat(kg[1].replace(",", "."));
    out.poidsKg = /^t/.test(kg[2]) ? v * 1000 : v;
  }

  // "2 colis de riz", "20 sacs de ciment", "colis"
  const unit = t.match(new RegExp(`\\b(\\d{1,4})?\\s*(${UNITS})\\b(?:\\s+(?:de|d')\\s*([a-z]+))?`));
  if (unit) {
    if (unit[1]) out.quantite = +unit[1];
    out.unite = unit[2];
    if (unit[3]) out.marchandise = unit[3];
  }

  if (!out.marchandise) {
    const goods = t.match(new RegExp(`\\b(${GOODS})\\b`));
    if (goods) out.marchandise = goods[1];
  }
  return out;
}

// Le poids donné est-il par unité ("10 kg par colis") ou au total ?
function parseWeightMode(text: string): ReservationDraft["poidsMode"] {
  const t = strip(text);
  if (
    /\bpar\s+(colis|sac|carton|caisse|fut|bidon|piece|unite)|\bchacun|\bchacune|\bchaque\b|l'unite|\bunitaire\b|\bindividuel/.test(
      t,
    )
  ) {
    return "unitaire";
  }
  if (/au total|poids total|\btotal\b|en tout|\bensemble\b|\bglobal/.test(t)) return "total";
  return undefined;
}

function mergeDraft(prev: ReservationDraft, text: string, knownPlaces: string[] = []): ReservationDraft {
  const route = parseRoute(text, knownPlaces, { depart: prev.depart, arrivee: prev.arrivee });
  const q = parseQuantities(text);
  const date = parseDate(text);
  const mode = parseWeightMode(text);
  const next: ReservationDraft = { ...prev };

  if (route.depart) next.depart = route.depart;
  if (route.arrivee) next.arrivee = route.arrivee;

  // Réponse d'un seul mot (« Toamasina ») quand il ne manque que le départ ou l'arrivée
  if (!route.depart && !route.arrivee && !date && !mode && Object.keys(q).length === 0) {
    const lone = parseLonePlace(text);
    if (lone) {
      if (!prev.depart && prev.arrivee) next.depart = lone;
      else if (prev.depart && !prev.arrivee) next.arrivee = lone;
    }
  }

  if (date) next.date = date;
  if (q.passagers !== undefined) next.passagers = q.passagers;
  if (q.marchandise) next.marchandise = q.marchandise;
  if (q.unite) next.unite = q.unite;
  if (q.quantite !== undefined) next.quantite = q.quantite;
  if (q.poidsKg !== undefined) {
    next.poidsKg = q.poidsKg;
    // nouveau poids sans précision → on redemandera s'il est par unité ou total
    next.poidsMode = mode;
  } else if (mode) {
    next.poidsMode = mode;
  }
  return next;
}

// Poids total réel (undefined tant que l'ambiguïté « par colis / total » n'est pas levée)
function getPoidsTotal(d: ReservationDraft): number | undefined {
  if (d.poidsKg === undefined) return undefined;
  if (d.quantite && d.quantite > 1) {
    if (d.poidsMode === "unitaire") return d.poidsKg * d.quantite;
    if (d.poidsMode === "total") return d.poidsKg;
    return undefined;
  }
  return d.poidsKg;
}

const needsWeightClarification = (d: ReservationDraft) =>
  !!d.quantite && d.quantite > 1 && d.poidsKg !== undefined && !d.poidsMode;

function missingFields(d: ReservationDraft): string[] {
  const miss: string[] = [];
  if (!d.depart) miss.push("le port de départ");
  if (!d.arrivee) miss.push("la destination");
  if (!d.date) miss.push("la date");

  const hasGoods = !!(d.marchandise || d.quantite || d.poidsKg);
  if (!d.passagers && !hasGoods) {
    miss.push("les passagers ou la marchandise (type, quantité, poids)");
  } else if (hasGoods) {
    if (!d.marchandise && !d.unite) miss.push("le type de marchandise");
    if (!d.quantite) miss.push("la quantité");
    if (d.poidsKg === undefined) miss.push("le poids");
  }
  return miss;
}

/** Lignes lisibles du brouillon (utilisées pour le texte et pour la carte récapitulatif). */
function draftRows(d: ReservationDraft): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Trajet", `${d.depart ?? "?"} → ${d.arrivee ?? "?"}`],
    ["Date", d.date ? formatDateFr(d.date) : "?"],
  ];
  if (d.passagers) rows.push(["Passagers", String(d.passagers)]);
  if (d.marchandise || d.unite) rows.push(["Marchandise", d.marchandise ?? d.unite ?? ""]);
  if (d.quantite) rows.push(["Quantité", `${d.quantite}${d.unite ? ` ${d.unite}` : ""}`]);
  const total = getPoidsTotal(d);
  if (total !== undefined) rows.push(["Poids total", `${total} kg`]);
  return rows;
}

function summarize(d: ReservationDraft): string {
  return draftRows(d)
    .map(([label, value]) => `• ${label} : ${value}`)
    .join("\n");
}

/* =========================================================
   Composant
========================================================= */
export interface AssistantChatProps {
  /** Réservation actuellement sélectionnée (contexte + annulation). */
  reservation?: ReservationRecord;
  onReservationCreated?: (reservation: ReservationRecord) => void;
  /** Appelé après une annulation (réservation mise à jour par le backend). */
  onReservationUpdated?: (reservation: ReservationRecord) => void;
  /** Ports / destinations connus (ex: noms des trajets) pour une détection fiable. */
  knownPlaces?: string[];
  /** Backend : vérifie le trajet, la disponibilité et calcule le prix réel (avant le récapitulatif). */
  verifyReservation?: (draft: ReservationDraft) => Promise<ReservationQuote>;
  /** Backend : crée vraiment la réservation et détermine ses statuts. */
  createReservation?: (draft: ReservationDraft) => Promise<ReservationRecord>;
  /** Backend : passe la réservation à « Annulée » sans effacer les paiements. */
  cancelReservation?: (reservationId: string) => Promise<ReservationRecord>;
}

interface RecapData {
  rows: Array<[string, string]>;
  price: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  /** Boutons de réponse rapide affichés sous le dernier message de l'assistant. */
  choices?: string[];
  /** Carte récapitulatif (avant confirmation). */
  recap?: RecapData;
  /** Message de succès (réservation enregistrée / annulée). */
  success?: boolean;
}

interface PushOptions {
  choices?: string[];
  recap?: RecapData;
  success?: boolean;
}

const HELP =
  "Je peux préparer une réservation. Exemple : « Réserver 2 colis de riz de 10 kg d’Antananarivo à Mahajanga le 12 octobre 2026 ». Je vous demande ce qui manque, je vous présente un récapitulatif, puis vous confirmez. La réservation n’est enregistrée qu’après validation par le système.";

const STARTERS = [
  "Réserver 2 colis de riz de 10 kg d’Antananarivo à Mahajanga demain",
  "Réserver pour 3 passagers de Toamasina à Mahajanga",
  "Quelles places sont disponibles ?",
];

export default function AssistantChat({
  reservation,
  onReservationCreated,
  onReservationUpdated,
  knownPlaces = [],
  verifyReservation,
  createReservation,
  cancelReservation,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const draftRef = useRef<ReservationDraft>({});
  const collecting = useRef(false); // une demande de réservation est en cours de collecte
  const awaitingConfirm = useRef(false); // récapitulatif présenté, attente de « oui »
  const awaitingWeight = useRef(false); // question « poids par colis ou total ? » posée
  const pendingCancel = useRef<ReservationRecord | null>(null); // annulation d'une réservation existante
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastReply = useRef("");
  const voiceMode = useRef(false); // true tant que l'échange se fait à la voix
  const submitRef = useRef<(m: string, byVoice: boolean) => Promise<void>>(async () => {});

  // Défilement automatique vers le dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Arrêt du micro et de la voix quand le composant est démonté
  useEffect(
    () => () => {
      voiceMode.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const push = (role: ChatMessage["role"], content: string, options: PushOptions = {}) => {
    if (role === "assistant") lastReply.current = content;
    setMessages((c) => [...c, { id: newId(), role, content, time: nowLabel(), ...options }]);
  };

  const hasDraft = () => Object.values(draftRef.current).some((v) => v !== undefined);

  const resetDraft = () => {
    draftRef.current = {};
    collecting.current = false;
    awaitingConfirm.current = false;
    awaitingWeight.current = false;
  };

  // Lecture vocale de la réponse (retourne quand la phrase est terminée)
  const speak = (text: string) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        text.replace(/[✅•]/g, "").replace(/\n+/g, ". "),
      );
      u.lang = "fr-FR";
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      voiceMode.current = false;
      push("assistant", "Le micro n'est pas supporté par ce navigateur. Utilisez Chrome ou Edge.");
      return;
    }
    const rec = new SR();
    let transcript = "";
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      transcript = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setQuestion(transcript);
    };
    rec.onerror = (e: any) => {
      voiceMode.current = false;
      if (e?.error === "not-allowed") {
        push("assistant", "Accès au micro refusé. Autorisez le micro dans votre navigateur.");
      }
    };
    rec.onend = () => {
      setListening(false);
      const spoken = transcript.trim();
      if (spoken && voiceMode.current) {
        // envoi automatique : pas besoin de cliquer sur la flèche
        void submitRef.current(spoken, true);
      } else {
        voiceMode.current = false;
      }
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const toggleMic = () => {
    if (listening) {
      voiceMode.current = false; // arrêt manuel
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      return;
    }
    voiceMode.current = true;
    startListening();
  };

  // Étape 3-4 : le backend vérifie, puis l'assistant présente le récapitulatif
  const presentRecap = async () => {
    const draft = draftRef.current;
    const payload: ReservationDraft = { ...draft, poidsTotalKg: getPoidsTotal(draft) };

    let quote: ReservationQuote | undefined;
    if (verifyReservation) {
      try {
        quote = await verifyReservation(payload);
      } catch (error) {
        awaitingConfirm.current = false;
        return push(
          "assistant",
          `Je n’ai pas pu vérifier la disponibilité : ${getErrorMessage(error)}. Réessayez dans un instant.`,
          { choices: ["Réessayer", "Annuler"] },
        );
      }
      if (!quote.available) {
        awaitingConfirm.current = false;
        return push(
          "assistant",
          `${quote.message ?? "Ce trajet n’est pas disponible pour cette demande."}\nModifiez la date ou le trajet, ou dites « annuler ».`,
          { choices: ["Annuler"] },
        );
      }
    }

    awaitingConfirm.current = true;
    const price =
      quote?.totalPrice !== undefined
        ? formatCurrency(quote.totalPrice)
        : "calculé par le système lors de l’enregistrement";
    push(
      "assistant",
      "Voici le récapitulatif de votre réservation. Souhaitez-vous la confirmer ?",
      {
        recap: { rows: draftRows(draft), price },
        choices: ["Oui, confirmer", "Modifier", "Annuler"],
      },
    );
  };

  // Suite de la collecte : champs manquants → ambiguïté du poids → récapitulatif
  const continueCollecting = async (merged: ReservationDraft) => {
    awaitingWeight.current = false;
    draftRef.current = merged;

    const miss = missingFields(merged);
    if (miss.length) {
      awaitingConfirm.current = false;
      return push("assistant", `${summarize(merged)}\n\nIl me manque : ${miss.join(", ")}.`);
    }

    // Ambiguïté « poids par unité » ou « poids total » à lever avant le récapitulatif
    if (needsWeightClarification(merged)) {
      awaitingConfirm.current = false;
      awaitingWeight.current = true;
      const unit = merged.unite ?? "colis";
      return push(
        "assistant",
        `Les ${merged.poidsKg} kg correspondent-ils au poids de chaque ${unit} ou au poids total des ${merged.quantite} ${unit} ?`,
        { choices: [`Chaque ${unit}`, "Poids total"] },
      );
    }

    return presentRecap();
  };

  // Étape 5 : création par le backend. L'IA ne dit « enregistrée » qu'après sa réponse.
  const createFromDraft = async () => {
    if (!createReservation) {
      return push(
        "assistant",
        "Le récapitulatif est prêt, mais l’enregistrement n’est pas encore branché sur le système (prop createReservation).",
      );
    }
    let created: ReservationRecord;
    try {
      created = await createReservation({
        ...draftRef.current,
        poidsTotalKg: getPoidsTotal(draftRef.current),
      });
    } catch (error) {
      // Rien n'a été enregistré : on garde le brouillon pour réessayer
      return push(
        "assistant",
        `La réservation n’a pas été enregistrée : ${getErrorMessage(error)}.\nDites « oui » pour réessayer ou « annuler ».`,
        { choices: ["Oui, réessayer", "Annuler"] },
      );
    }

    onReservationCreated?.(created);
    resetDraft();

    const lines = [
      "Réservation enregistrée par le système.",
      `• Statut de la réservation : ${created.status}`,
    ];
    const payment = readPaymentLabel(created);
    lines.push(
      payment
        ? `• Statut du paiement : ${payment}`
        : "• Le statut du paiement est calculé par le système selon les montants payés.",
    );
    if (Number.isFinite(Number(created.totalPrice))) {
      lines.push(`• Prix total : ${formatCurrency(Number(created.totalPrice))}`);
    }
    push("assistant", lines.join("\n"), { success: true });
  };

  // Annulation d'une réservation EXISTANTE (statut Annulée, paiements conservés)
  const cancelExisting = async (target: ReservationRecord) => {
    if (!cancelReservation) {
      pendingCancel.current = null;
      return push(
        "assistant",
        "L’annulation n’est pas encore branchée sur le système (prop cancelReservation). Aucune modification n’a été faite.",
      );
    }
    try {
      const updated = await cancelReservation(target.id);
      pendingCancel.current = null;
      onReservationUpdated?.(updated);
      push(
        "assistant",
        `Réservation annulée : ${updated.clientName} (${updated.departure} → ${updated.destination}).\n• Statut de la réservation : ${updated.status}\n• Les paiements déjà effectués sont conservés.`,
        { success: true },
      );
    } catch (error) {
      push(
        "assistant",
        `L’annulation n’a pas pu être enregistrée : ${getErrorMessage(error)}. Rien n’a été modifié. Dites « oui » pour réessayer ou « non » pour conserver la réservation.`,
        { choices: ["Oui", "Non"] },
      );
    }
  };

  const handle = async (message: string) => {
    const intent = detectIntent(message);

    // A. Réponse à une demande d'annulation d'une réservation existante
    if (pendingCancel.current) {
      if (intent === "confirmer") return cancelExisting(pendingCancel.current);
      if (intent === "refuser") {
        pendingCancel.current = null;
        return push("assistant", "D’accord, la réservation est conservée.");
      }
      return push("assistant", "Répondez « oui » pour annuler la réservation ou « non » pour la conserver.", {
        choices: ["Oui", "Non"],
      });
    }

    // A'. Réponse à « poids par colis ou poids total ? »
    // Un simple « oui » ne répond pas à une question à deux choix : on la repose clairement.
    if (awaitingWeight.current && intent !== "annuler" && intent !== "aide") {
      const mode = parseWeightMode(message);
      const draft = draftRef.current;
      const unit = draft.unite ?? "colis";
      if (mode) {
        return continueCollecting({ ...draft, poidsMode: mode });
      }
      if (intent === "confirmer" || intent === "refuser") {
        return push(
          "assistant",
          `« ${intent === "confirmer" ? "Oui" : "Non"} » ne me permet pas de choisir : il y a deux possibilités.\n• Chaque ${unit} pèse ${draft.poidsKg} kg\n• Les ${draft.quantite} ${unit} pèsent ${draft.poidsKg} kg au total\nLequel est correct ?`,
          { choices: [`Chaque ${unit}`, "Poids total"] },
        );
      }
      // Le client donne une autre information (nouveau poids, date...) : on la fusionne
      // plus bas ; si le poids change, la question sera reposée automatiquement.
    }

    if (intent === "aide") return push("assistant", HELP);

    // B. Confirmation du récapitulatif → création par le backend
    if (awaitingConfirm.current && intent === "confirmer") {
      return createFromDraft();
    }

    // C. Le client refuse le récapitulatif : il peut corriger ou annuler
    if (awaitingConfirm.current && intent === "refuser") {
      awaitingConfirm.current = false;
      return push("assistant", "Que souhaitez-vous modifier ? Indiquez la nouvelle information (date, trajet, quantité, poids...) ou dites « annuler ».", {
        choices: ["Annuler"],
      });
    }

    // D. Annulation
    if (intent === "annuler") {
      // Abandon avant la création : aucune réservation n'existe, rien à annuler côté système
      if (collecting.current || hasDraft()) {
        resetDraft();
        return push("assistant", "Demande abandonnée : aucune réservation n’a été créée.");
      }
      // Annulation d'une réservation existante (celle sélectionnée)
      if (reservation) {
        if (isCancelled(reservation.status)) {
          return push("assistant", "Cette réservation est déjà annulée.");
        }
        pendingCancel.current = reservation;
        return push(
          "assistant",
          `Voulez-vous annuler la réservation de ${reservation.clientName} (${reservation.departure} → ${reservation.destination}) ?\nLes paiements déjà effectués seront conservés.`,
          { choices: ["Oui", "Non"] },
        );
      }
      return push("assistant", "Il n’y a aucune réservation en cours ni sélectionnée à annuler.");
    }

    // « oui » / « non » alors que rien n'est en attente de confirmation
    if ((intent === "confirmer" || intent === "refuser") && !collecting.current && !hasDraft()) {
      return push(
        "assistant",
        "Il n’y a rien à confirmer pour le moment. Dites-moi quel trajet vous souhaitez réserver.",
        { choices: STARTERS.slice(0, 2) },
      );
    }

    // E. Collecte des informations (nouvelle réservation ou compléments)
    if (intent === "reserver") collecting.current = true;
    if (collecting.current || (hasDraft() && intent !== "disponibilite")) {
      collecting.current = true;
      const merged = mergeDraft(draftRef.current, message, knownPlaces);

      // Une date passée est refusée
      if (merged.date && merged.date < iso(new Date())) {
        delete merged.date;
        draftRef.current = merged;
        awaitingConfirm.current = false;
        awaitingWeight.current = false;
        return push("assistant", `${summarize(merged)}\n\nLa date indiquée est déjà passée. Quelle est la date du voyage ?`);
      }

      return continueCollecting(merged);
    }

    // F. Questions ouvertes (disponibilité, explications) → service IA, avec contexte
    const response = await askAssistant({
      question: message,
      context: JSON.stringify({ reservation, draft: draftRef.current }),
    });
    push("assistant", typeof response === "string" ? response : JSON.stringify(response, null, 2));
  };

  const submitMessage = async (message: string, byVoice: boolean) => {
    if (!message || isLoading) return;
    push("user", message);
    setQuestion("");
    setIsLoading(true);
    try {
      await handle(message);
      if (byVoice) {
        await speak(lastReply.current);
        // Échange encore ouvert (info manquante, confirmation attendue) → on réécoute
        const open = collecting.current || hasDraft() || pendingCancel.current !== null;
        if (open && voiceMode.current) startListening();
        else voiceMode.current = false;
      }
    } catch {
      voiceMode.current = false;
      push("assistant", "Je n’ai pas pu traiter la demande. Vérifiez votre connexion ou relancez-la.");
    } finally {
      setIsLoading(false);
    }
  };
  submitRef.current = submitMessage;

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (listening) {
      voiceMode.current = false;
      recognitionRef.current?.stop();
    }
    await submitMessage(question.trim(), false);
  };

  // Les boutons de réponse rapide ne s'affichent que sous le tout dernier message
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

  return (
    <Card className="flex h-full flex-col overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-4">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <Bot className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold leading-tight">Assistant Saint-Jude</span>
            <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              En ligne
              <span className="mx-1">·</span>
              <ShieldCheck className="h-3.5 w-3.5" />
              Confirmation requise avant enregistrement
            </span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex h-[520px] flex-col gap-3 bg-slate-50/60 p-4">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <p className="font-medium">Bonjour, comment puis-je vous aider ?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Je prépare votre réservation, je vérifie les données et vous confirmez.
                </p>
              </div>
              <div className="flex w-full max-w-md flex-col gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void submitMessage(s, false)}
                    className="rounded-xl border bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const mine = m.role === "user";
            const showChoices = !isLoading && m.id === lastMessageId && !!m.choices?.length;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    mine ? "bg-primary text-primary-foreground" : "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                  }`}
                >
                  {mine ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>

                <div className={`flex max-w-[82%] flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : m.success
                          ? "rounded-bl-sm border border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200"
                    }`}
                  >
                    {m.success && (
                      <span className="mb-1 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Terminé
                      </span>
                    )}
                    {m.content}
                  </div>

                  {m.recap && (
                    <div className="w-full min-w-[260px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                      <div className="bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
                        Récapitulatif
                      </div>
                      <dl className="divide-y text-sm">
                        {m.recap.rows.map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-4 px-4 py-2">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="text-right font-medium">{value}</dd>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 bg-slate-50 px-4 py-2.5">
                          <dt className="font-medium">Prix total</dt>
                          <dd className="text-right font-semibold text-primary">{m.recap.price}</dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {showChoices && (
                    <div className="flex flex-wrap gap-2">
                      {m.choices!.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => void submitMessage(c, false)}
                          className="rounded-full border border-primary/40 bg-white px-3.5 py-1.5 text-sm font-medium text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="px-1 text-[11px] text-muted-foreground">{m.time}</span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-end gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-slate-200">
                <Bot className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex items-center gap-2 rounded-full border bg-white py-1.5 pl-4 pr-1.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
          onSubmit={sendMessage}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={listening ? "Je vous écoute…" : "Écrivez votre demande de réservation…"}
            aria-label="Message pour l’IA"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            size="icon"
            variant={listening ? "destructive" : "ghost"}
            className="h-9 w-9 rounded-full"
            onClick={toggleMic}
            aria-label={listening ? "Arrêter la dictée" : "Dicter un message"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-full"
            disabled={isLoading || !question.trim()}
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}