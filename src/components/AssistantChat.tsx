import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, Mic, MicOff, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import { askAssistant } from "../data/intelligenceService";
import type { ReservationRecord } from "../services/reservationService";
import { formatCurrency } from "../Tools/Tools";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  DAYS,
  GUIDED,
  GUIDED_CHOICES,
  correctionNote,
  detectIntent,
  draftRows,
  getPoidsTotal,
  hasInfo,
  inferKind,
  iso,
  mergeDraft,
  nextQuestion,
  parseDate,
  parseDateInfo,
  formatDateLong,
  pluralUnit,
  strip,
  summarize,
  wordsToDigits,
  type Field,
  type RequestKind,
  type ReservationDraft,
  type ReservationQuote,
} from "./reservationParser";

// Les types restent importables depuis ce fichier, comme avant
export type { ReservationDraft, ReservationQuote } from "./reservationParser";

/* =========================================================
   Utilitaires
========================================================= */
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "erreur inconnue";

const nowLabel = () =>
  new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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
  /** Backend : vérifie trajet, capacité et tarif réels (avant le récapitulatif). */
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
  "Je peux préparer une réservation : dites-moi librement ce que vous souhaitez (billet passager ou envoi de marchandises, ports, date, quantité, poids), dans l’ordre que vous voulez. Je vous demande seulement ce qui manque, une information à la fois, puis je vérifie le trajet, la capacité et le tarif, et je vous présente un récapitulatif. La réservation n’est enregistrée qu’après votre confirmation et la validation par le système.";

// Aucune valeur imposée : le client choisit sa marchandise, ses ports, sa quantité...
const EXAMPLE_HINT =
  "Parlez librement : dites ce que vous voulez envoyer, d’où, vers où, la quantité, le poids et la date, dans l’ordre que vous voulez. Je vous demanderai seulement ce qui manque.";

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
  const awaitingWeight = useRef(false); // question « poids par unité ou total ? » posée
  const pendingDate = useRef(false); // date relative ambiguë en attente de confirmation
  const asked = useRef<Field | null>(null); // dernière question posée (pour les réponses courtes)
  const pendingCancel = useRef<ReservationRecord | null>(null); // annulation d'une réservation existante
  const requestKind = useRef<RequestKind | null>(null); // type de demande (passager / marchandise)
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

  const hasDraft = () => hasInfo(draftRef.current);

  const resetDraft = () => {
    draftRef.current = {};
    collecting.current = false;
    awaitingConfirm.current = false;
    awaitingWeight.current = false;
    pendingDate.current = false;
    asked.current = null;
    requestKind.current = null;
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

  // Le backend vérifie trajet, capacité et tarif ; puis l'assistant présente le récapitulatif
  const presentRecap = async () => {
    asked.current = null;
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

  // Suite de la collecte : UNE question ciblée à la fois, puis vérification backend et récapitulatif
  const continueCollecting = async (merged: ReservationDraft, prefix = "") => {
    awaitingWeight.current = false;
    draftRef.current = merged;
    if (!requestKind.current) requestKind.current = inferKind(merged);

    const q = nextQuestion(merged, requestKind.current);
    if (q) {
      awaitingConfirm.current = false;
      asked.current = q.field;
      awaitingWeight.current = q.field === "poidsMode";
      return push("assistant", `${prefix}${q.text}`, q.choices ? { choices: q.choices } : {});
    }

    // Tout est connu : on annonce, puis le backend vérifie avant tout résultat
    asked.current = null;
    if (verifyReservation) {
      const total = getPoidsTotal(merged);
      const what =
        total !== undefined
          ? `, ainsi que le tarif correspondant à vos ${total} kg`
          : merged.passagers
            ? `, ainsi que le tarif pour ${merged.passagers} passager${merged.passagers > 1 ? "s" : ""}`
            : "";
      push(
        "assistant",
        `${prefix}Très bien, ${formatDateLong(merged.date!)}. Je vais vérifier les possibilités de transport entre ${merged.depart} et ${merged.arrivee} pour cette date${what}.`,
      );
    } else if (prefix) {
      push("assistant", prefix.trim());
    }
    return presentRecap();
  };

  // Démarrage guidé : on garde ce que le client a déjà dit, on pose la question suivante
  const startGuided = (kind: RequestKind) => {
    requestKind.current = kind;
    collecting.current = true;
    awaitingConfirm.current = false;
    awaitingWeight.current = false;
    pendingDate.current = false;
    const prefix =
      kind === "passager"
        ? "Très bien, réservons un billet passager. "
        : "Très bien, préparons un transport de marchandises. ";
    return continueCollecting(draftRef.current, prefix);
  };

  // Création par le backend. L'IA ne dit « enregistrée » qu'après sa réponse.
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
    // Démarrage guidé choisi par bouton (« Billet passager » / « Transport de marchandises »)
    const guided = GUIDED[message];
    if (guided && !awaitingConfirm.current && !pendingCancel.current) return startGuided(guided);

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

    // A'. Réponse à « Parlez-vous de vendredi 16 octobre ? » (date relative ambiguë)
    if (pendingDate.current) {
      pendingDate.current = false;
      if (intent === "confirmer") return continueCollecting(draftRef.current);
      if (intent === "refuser" && !parseDate(wordsToDigits(message))) {
        const d = { ...draftRef.current };
        delete d.date;
        return continueCollecting(d); // redemande la date
      }
      // sinon (« non, aujourd’hui », « samedi »...) : traité comme une correction plus bas
    }

    // A''. Réponse à « poids de chaque unité ou poids total ? »
    // Un simple « oui » ne répond pas à une question à deux choix : on la repose clairement.
    if (awaitingWeight.current && intent !== "annuler" && intent !== "aide") {
      const draft = draftRef.current;
      const unit = draft.unite ?? "unité";
      const merged = mergeDraft(draft, message, knownPlaces, "poidsMode");
      if (merged.poidsMode || merged.poidsKg !== draft.poidsKg) {
        return continueCollecting(merged, correctionNote(draft, merged));
      }
      if (intent === "confirmer" || intent === "refuser") {
        return push(
          "assistant",
          `« ${intent === "confirmer" ? "Oui" : "Non"} » ne me permet pas de choisir : il y a deux possibilités.\n• Chaque ${unit} pèse ${draft.poidsKg} kg\n• Les ${draft.quantite} ${pluralUnit(unit, draft.quantite ?? 2)} pèsent ${draft.poidsKg} kg au total\nLequel est correct ?`,
          { choices: [`Chaque ${unit}`, "Poids total"] },
        );
      }
      // autre information (date, port...) : fusionnée plus bas ; la question sera reposée
    }

    if (intent === "aide") return push("assistant", HELP);

    // B. Confirmation du récapitulatif → création par le backend
    if (awaitingConfirm.current && intent === "confirmer") {
      return createFromDraft();
    }

    // C. Le client refuse le récapitulatif : correction directe, sans tout redemander
    if (awaitingConfirm.current && intent === "refuser") {
      const before = draftRef.current;
      const merged = mergeDraft(before, message, knownPlaces, null);
      const note = correctionNote(before, merged);
      awaitingConfirm.current = false;
      if (note) return continueCollecting(merged, note);
      return push(
        "assistant",
        "Que souhaitez-vous modifier ? Indiquez la nouvelle information (date, trajet, quantité, poids...) ou dites « annuler ».",
        { choices: ["Annuler"] },
      );
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
        "Il n’y a rien à confirmer pour le moment. Que souhaitez-vous réserver ?",
        { choices: GUIDED_CHOICES },
      );
    }

    // E. Collecte : le client parle librement, on extrait tout ce qu'il donne
    if (intent === "reserver") collecting.current = true;
    if (collecting.current || (hasDraft() && intent !== "disponibilite")) {
      collecting.current = true;

      if (!requestKind.current) {
        const s = strip(message);
        if (/envoy|expedi|colis|marchandise|fret/.test(s)) requestKind.current = "marchandise";
        else if (/billet|passager/.test(s)) requestKind.current = "passager";
      }

      const before = draftRef.current;
      const merged = mergeDraft(before, message, knownPlaces, asked.current);

      // Une date passée est refusée
      if (merged.date && merged.date < iso(new Date())) {
        delete merged.date;
        draftRef.current = merged;
        awaitingConfirm.current = false;
        awaitingWeight.current = false;
        asked.current = "date";
        return push("assistant", `${summarize(merged)}\n\nLa date indiquée est déjà passée. Quelle est la date du voyage ?`);
      }

      // Date relative ambiguë (« vendredi » dit un vendredi) → confirmation
      const info = parseDateInfo(wordsToDigits(message));
      if (merged.date && merged.date !== before.date && info?.ambiguous) {
        draftRef.current = merged;
        pendingDate.current = true;
        awaitingConfirm.current = false;
        awaitingWeight.current = false;
        return push(
          "assistant",
          `Aujourd’hui, c’est déjà ${DAYS[new Date().getDay()]}. Parlez-vous de ${formatDateLong(merged.date)} ?`,
          { choices: ["Oui", "Non, aujourd’hui"] },
        );
      }

      return continueCollecting(merged, correctionNote(before, merged));
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Que souhaitez-vous réserver ?
                </p>
                {GUIDED_CHOICES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void submitMessage(s, false)}
                    className="rounded-xl border bg-white px-3 py-2.5 text-sm font-medium shadow-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
                <p className="mt-2 text-xs italic text-muted-foreground">{EXAMPLE_HINT}</p>
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
            placeholder={listening ? "Je vous écoute…" : "Écrivez votre demande avec vos propres mots…"}
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