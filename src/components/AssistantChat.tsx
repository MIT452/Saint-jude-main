import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { askAssistant } from "../data/intelligenceService";
import type { ReservationRecord } from "../services/reservationService";
import { formatCurrency } from "../Tools/Tools";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

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

const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MONTHS = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const DAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

const UNITS = "sacs?|cartons?|colis|caisses?|futs?|bidons?";
const GOODS = "marchandises?|riz|ciment|meubles?|motos?";

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

function detectIntent(text: string): Intent {
  const t = strip(text);
  if (/^(oui|ok|d'accord|confirme|confirmer|valide|valider)\b/.test(t)) return "confirmer";
  if (/^(non|no|nope)\b/.test(t)) return "refuser";
  if (/annul/.test(t)) return "annuler";
  if (/disponib|place|reste|libre/.test(t) && !/reserv|book/.test(t)) return "disponibilite";
  if (/reserv|book|voyage|envoy|transport|expedi/.test(t)) return "reserver";
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

  const num = t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
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

function parseRoute(text: string, knownPlaces: string[] = []): Pick<ReservationDraft, "depart" | "arrivee"> {
  const raw = text.replace(/\s+/g, " ");
  const places = knownPlaces.map((p) => ({ p, k: strip(p) }));
  const t = strip(raw);

  // 1) lieux connus, dans l'ordre d'apparition
  if (places.length) {
    const found = places
      .map(({ p, k }) => ({ p, i: t.indexOf(k) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i);
    if (found.length >= 2) return { depart: found[0].p, arrivee: found[1].p };
    if (found.length === 1) {
      const isDest = new RegExp(`\\b(vers|pour|a|au|jusqu'a)\\s+${strip(found[0].p)}`).test(t);
      return isDest ? { arrivee: found[0].p } : { depart: found[0].p };
    }
  }

  // 2) motifs "de X à Y" / "d'X à Y" / "X -> Y" / "vers Y"
  const word = "([A-ZÀ-Ý][\\p{L}'-]+(?:\\s[A-ZÀ-Ý][\\p{L}'-]+)?)";
  const m1 = raw.match(
    new RegExp(`(?:\\bde\\s+|\\bd['’])${word}\\s+(?:à|a|vers|pour|jusqu'à)\\s+${word}`, "u")
  );
  if (m1) return { depart: m1[1], arrivee: m1[2] };
  const m2 = raw.match(new RegExp(`${word}\\s*(?:->|→|=>|-)\\s*${word}`, "u"));
  if (m2) return { depart: m2[1], arrivee: m2[2] };
  // "\b" ne fonctionne pas devant "à" : on utilise un début de mot explicite
  const m3 = raw.match(new RegExp(`(?:^|\\s)(?:vers|pour|à)\\s+${word}`, "u"));
  if (m3) return { arrivee: m3[1] };
  return {};
}

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
  if (/\bpar\s+(colis|sac|carton|caisse|fut|bidon|piece|unite)|\bchacun|\bchacune|\bchaque\b|l'unite/.test(t)) {
    return "unitaire";
  }
  if (/au total|poids total|\btotal\b|en tout|\bensemble\b/.test(t)) return "total";
  return undefined;
}

function mergeDraft(prev: ReservationDraft, text: string, knownPlaces: string[] = []): ReservationDraft {
  const route = parseRoute(text, knownPlaces);
  const q = parseQuantities(text);
  const date = parseDate(text);
  const mode = parseWeightMode(text);
  const next: ReservationDraft = { ...prev };
  if (route.depart) next.depart = route.depart;
  if (route.arrivee) next.arrivee = route.arrivee;
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

// Poids total réel (null tant que l'ambiguïté « par colis / total » n'est pas levée)
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

function summarize(d: ReservationDraft): string {
  const lines = [
    `• Trajet : ${d.depart ?? "?"} → ${d.arrivee ?? "?"}`,
    `• Date : ${d.date ? formatDateFr(d.date) : "?"}`,
  ];
  if (d.passagers) lines.push(`• Passagers : ${d.passagers}`);
  if (d.marchandise || d.unite) lines.push(`• Marchandise : ${d.marchandise ?? d.unite}`);
  if (d.quantite) lines.push(`• Quantité : ${d.quantite}${d.unite ? ` ${d.unite}` : ""}`);
  const total = getPoidsTotal(d);
  if (total !== undefined) lines.push(`• Poids total : ${total} kg`);
  return lines.join("\n");
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const HELP =
  "Je peux préparer une réservation. Exemple : « Réserver 2 colis de riz de 10 kg d’Antananarivo à Mahajanga le 12 octobre 2026 ». Je vous demande ce qui manque, je vous présente un récapitulatif, puis vous confirmez. La réservation n’est enregistrée qu’après validation par le système.";

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

  const push = (role: ChatMessage["role"], content: string) => {
    if (role === "assistant") lastReply.current = content;
    setMessages((c) => [...c, { id: newId(), role, content }]);
  };

  const hasDraft = () => Object.values(draftRef.current).some((v) => v !== undefined);

  const resetDraft = () => {
    draftRef.current = {};
    collecting.current = false;
    awaitingConfirm.current = false;
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
        );
      }
      if (!quote.available) {
        awaitingConfirm.current = false;
        return push(
          "assistant",
          `${quote.message ?? "Ce trajet n’est pas disponible pour cette demande."}\nModifiez la date ou le trajet, ou dites « annuler ».`,
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
      `Récapitulatif de votre réservation\n${summarize(draft)}\n• Prix total : ${price}\n\nSouhaitez-vous confirmer cette réservation ? (oui / annuler)`,
    );
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
      );
    }

    onReservationCreated?.(created);
    resetDraft();

    const lines = [
      "✅ Réservation enregistrée par le système.",
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
    push("assistant", lines.join("\n"));
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
      );
    } catch (error) {
      push(
        "assistant",
        `L’annulation n’a pas pu être enregistrée : ${getErrorMessage(error)}. Rien n’a été modifié. Dites « oui » pour réessayer ou « non » pour conserver la réservation.`,
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
      return push("assistant", "Répondez « oui » pour annuler la réservation ou « non » pour la conserver.");
    }

    if (intent === "aide") return push("assistant", HELP);

    // B. Confirmation du récapitulatif → création par le backend
    if (awaitingConfirm.current && intent === "confirmer") {
      return createFromDraft();
    }

    // C. Le client refuse le récapitulatif : il peut corriger ou annuler
    if (awaitingConfirm.current && intent === "refuser") {
      awaitingConfirm.current = false;
      return push("assistant", "Que souhaitez-vous modifier ? Indiquez la nouvelle information ou dites « annuler ».");
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
          `Voulez-vous annuler la réservation de ${reservation.clientName} (${reservation.departure} → ${reservation.destination}) ?\nLes paiements déjà effectués seront conservés. (oui / non)`,
        );
      }
      return push("assistant", "Il n’y a aucune réservation en cours ni sélectionnée à annuler.");
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
        return push("assistant", `${summarize(merged)}\n\nLa date indiquée est déjà passée. Quelle est la date du voyage ?`);
      }

      draftRef.current = merged;

      const miss = missingFields(merged);
      if (miss.length) {
        awaitingConfirm.current = false;
        return push("assistant", `${summarize(merged)}\n\nIl me manque : ${miss.join(", ")}.`);
      }

      // Ambiguïté « poids par unité » ou « poids total » à lever avant le récapitulatif
      if (needsWeightClarification(merged)) {
        awaitingConfirm.current = false;
        return push(
          "assistant",
          `Les ${merged.poidsKg} kg correspondent-ils au poids de chaque ${merged.unite ?? "colis"} ou au poids total des ${merged.quantite} ${merged.unite ?? "colis"} ?`,
        );
      }

      return presentRecap();
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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> Assistant conversationnel IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-[420px] flex-col gap-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" />
              Demandez-moi de proposer un voyage, d’expliquer la disponibilité ou de préparer une réservation.
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[90%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">L’IA réfléchit…</div>
          )}
          <div ref={bottomRef} />
        </div>
        <form className="flex gap-2" onSubmit={sendMessage}>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={listening ? "Je vous écoute…" : "Demandez une réservation…"}
            aria-label="Message pour l’IA"
          />
          <Button
            type="button"
            size="icon"
            variant={listening ? "destructive" : "outline"}
            onClick={toggleMic}
            aria-label={listening ? "Arrêter la dictée" : "Dicter un message"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !question.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}