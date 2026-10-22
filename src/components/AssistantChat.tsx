import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bot,
  CheckCheck,
  CheckCircle2,
  HelpCircle,
  Mic,
  MicOff,
  Paperclip,
  PlusSquare,
  Send,
  Ship,
  User,
  Zap,
  ClipboardList,
} from "lucide-react";
import type { ReservationRecord } from "../services/reservationService";
import { agentCancel, agentChat, agentConfirm, type PendingView } from "../services/agentService";
import { formatCurrency } from "../Tools/Tools";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { detectIntent, strip } from "./reservationParser";

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

const isCancelled = (status?: string) => strip(status ?? "").includes("annul");

/* =========================================================
   Composant
   Toute la conversation (collecte, vérification du trajet, tarif, mémoire) est gérée
   par l'agent du backend (/api/ai/agent). Ce composant affiche, écoute, parle,
   et déclenche les actions humaines : Confirmer / Annuler.
========================================================= */
export interface AssistantChatProps {
  /** Réservation actuellement sélectionnée (annulation d'une réservation existante). */
  reservation?: ReservationRecord;
  onReservationCreated?: (reservation: ReservationRecord) => void;
  /** Appelé après une annulation (réservation mise à jour par le backend). */
  onReservationUpdated?: (reservation: ReservationRecord) => void;
  /** Backend : passe la réservation à « Annulée » sans effacer les paiements. */
  cancelReservation?: (reservationId: string) => Promise<ReservationRecord>;
  /** Anciennes props : conservées pour ne pas casser la page parente, désormais inutiles. */
  knownPlaces?: string[];
  verifyReservation?: unknown;
  createReservation?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  choices?: string[];
  success?: boolean;
  welcome?: boolean;
}

interface PushOptions {
  choices?: string[];
  success?: boolean;
}

const WELCOME_EXAMPLES = [
  "Quelle est la disponibilité du bateau Arcanum ?",
  "Montre-moi les réservations en attente",
  "Comment ajouter une nouvelle réservation ?",
];

const QUICK_SUGGESTIONS: Array<{ label: string; message: string; icon: typeof Ship }> = [
  { label: "Vérifier un autre bateau", message: "Vérifier la disponibilité d'un autre bateau", icon: Ship },
  { label: "Voir les réservations en attente", message: "Montre-moi les réservations en attente", icon: ClipboardList },
  { label: "Ajouter une réservation", message: "Je veux faire une réservation", icon: PlusSquare },
  { label: "Aide / Guide", message: "Comment ça marche ?", icon: HelpCircle },
];

const makeWelcome = (): ChatMessage => ({
  id: newId(),
  role: "assistant",
  content: "Bonjour ! 👋 Je suis votre assistant IA pour les réservations.",
  time: nowLabel(),
  welcome: true,
});

export default function AssistantChat({
  reservation,
  onReservationCreated,
  onReservationUpdated,
  cancelReservation,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeWelcome()]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState<PendingView | null>(null);

  const convIdRef = useRef<string | undefined>(undefined); // identifiant de conversation côté backend
  const pendingRef = useRef<PendingView | null>(null); // récapitulatif en attente de confirmation
  const pendingCancel = useRef<ReservationRecord | null>(null); // annulation d'une réservation existante
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastReply = useRef("");
  const voiceMode = useRef(false);
  const submitRef = useRef<(m: string, byVoice: boolean) => Promise<void>>(async () => {});

  const setPend = (p: PendingView | null) => {
    pendingRef.current = p;
    setPending(p);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pending]);

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

  /* ---------- Voix ---------- */
  const speak = (text: string) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[✅•]/g, "").replace(/\n+/g, ". "));
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
      if (spoken && voiceMode.current) void submitRef.current(spoken, true);
      else voiceMode.current = false;
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const toggleMic = () => {
    if (listening) {
      voiceMode.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      return;
    }
    voiceMode.current = true;
    startListening();
  };

  /* ---------- Actions humaines : Confirmer / Annuler le récapitulatif ---------- */
  const confirmPending = async () => {
    const id = convIdRef.current;
    if (!id) return push("assistant", "Il n’y a rien à confirmer pour le moment.");
    try {
      const out = await agentConfirm(id);
      setPend(null);
      push("assistant", out.reply, { success: true });
      // le backend renvoie un résumé de la réservation créée
      onReservationCreated?.(out.reservation as unknown as ReservationRecord);
    } catch (error) {
      push(
        "assistant",
        `La réservation n’a pas été enregistrée : ${getErrorMessage(error)}`,
        pendingRef.current ? { choices: ["Oui, confirmer", "Annuler"] } : {},
      );
    }
  };

  const cancelPending = async () => {
    const id = convIdRef.current;
    setPend(null);
    if (id) await agentCancel(id).catch(() => undefined); // le brouillon expire de toute façon après 30 min
    push("assistant", "D’accord, rien n’est enregistré.");
  };

  /* ---------- Annulation d'une réservation EXISTANTE (statut Annulée, paiements conservés) ---------- */
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

  /* ---------- Traitement d'un message ---------- */
  const handle = async (message: string) => {
    const intent = detectIntent(message);

    // A. Réponse à « Voulez-vous annuler cette réservation existante ? »
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

    // B. Récapitulatif affiché : « oui » = confirmation de l'utilisateur, « annuler » = abandon.
    // Tout le reste (« non, plutôt vendredi ») est envoyé à l'agent, qui prépare un nouveau récapitulatif.
    if (pendingRef.current) {
      if (intent === "confirmer") return confirmPending();
      if (intent === "annuler") return cancelPending();
    }

    // C. « Annuler la réservation » avec une réservation sélectionnée → annulation de celle-ci
    if (intent === "annuler" && reservation && /reserv/.test(strip(message)) && !pendingRef.current) {
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

    // D. Tout le reste : conversation avec l'agent (mémoire, outils, vérification SQL)
    const out = await agentChat(message, convIdRef.current);
    convIdRef.current = out.conversationId;
    setPend(out.pending);
    push("assistant", out.reply);
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
        // Échange encore ouvert (récapitulatif ou annulation en attente) → on réécoute
        const open = pendingRef.current !== null || pendingCancel.current !== null;
        if (open && voiceMode.current) startListening();
        else voiceMode.current = false;
      }
    } catch (error) {
      voiceMode.current = false;
      push("assistant", getErrorMessage(error) || "Je n’ai pas pu traiter la demande. Vérifiez votre connexion.");
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

  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

  const recapRows = (p: PendingView): Array<[string, string]> => [
    ["Marchandise", `${p.quantite} ${p.unite ?? ""} ${p.marchandise}`.replace(/\s+/g, " ").trim()],
    ["Poids total", `${p.poidsTotalKg} kg`],
    ["Trajet", `${p.depart} → ${p.arrivee}`],
    ["Date", p.date],
    ...(p.bateau ? ([["Navire", p.bateau]] as Array<[string, string]>) : []),
  ];

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/40 shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-4 ring-blue-50">
              <Bot className="h-8 w-8" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight text-slate-900">
                Assistant IA – Réservations
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  En ligne
                </span>
                <span>
                  Je peux vous aider à gérer vos réservations, vérifier la disponibilité des bateaux
                  et répondre à vos questions.
                </span>
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-bold text-slate-800 shadow-sm">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                G
              </span>
              Groq
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              Mode conversationnel
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex h-[560px] flex-col gap-3 p-0">
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-2 pt-5">
          {messages.map((m) => {
            const mine = m.role === "user";
            const isLast = m.id === lastMessageId;
            const showChoices = !isLoading && isLast && !!m.choices?.length;
            return (
              <div key={m.id} className={`flex items-end gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    mine ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {mine ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </span>

                <div className={`flex max-w-[78%] flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`relative whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      mine
                        ? "rounded-br-md bg-blue-600 text-white shadow-md"
                        : m.success
                          ? "rounded-bl-md border border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "rounded-bl-md bg-blue-100/70 text-slate-800"
                    }`}
                  >
                    {m.success && (
                      <span className="mb-1 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Terminé
                      </span>
                    )}
                    {m.content}

                    {m.welcome && (
                      <div className="mt-2">
                        <p>Vous pouvez me poser des questions comme :</p>
                        <ul className="my-1.5 list-disc space-y-1 pl-5">
                          {WELCOME_EXAMPLES.map((ex) => (
                            <li key={ex}>“{ex}”</li>
                          ))}
                        </ul>
                        <p>Je suis là pour vous aider !</p>
                      </div>
                    )}

                    <span
                      className={`mt-1 block text-right text-[11px] ${
                        mine ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {m.time}
                    </span>
                  </div>

                  {mine && (
                    <span className="flex items-center gap-1 px-1 text-[11px] text-slate-400">
                      {m.time}
                      <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                    </span>
                  )}

                  {showChoices && (
                    <div className="flex flex-wrap gap-2">
                      {m.choices!.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => void submitMessage(c, false)}
                          className="rounded-full border border-blue-300 bg-white px-3.5 py-1.5 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-600 hover:text-white"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Récapitulatif préparé par l'agent : seul ce bouton enregistre la réservation */}
          {pending && !isLoading && (
            <div className="ml-[52px] w-full max-w-[78%] min-w-[280px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
              <div className="bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Récapitulatif
              </div>
              <dl className="divide-y text-sm">
                {recapRows(pending).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 bg-slate-50 px-4 py-2.5">
                  <dt className="font-medium">Prix total</dt>
                  <dd className="text-right font-semibold text-blue-700">
                    {pending.prix != null ? formatCurrency(pending.prix) : "calculé par le système"}
                  </dd>
                </div>
              </dl>
              <div className="flex gap-2 p-3">
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isLoading}
                  onClick={() => void submitMessage("Oui, confirmer", false)}
                >
                  Confirmer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => void submitMessage("Annuler", false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-end gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Bot className="h-5 w-5" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-blue-100/70 px-4 py-3.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Zap className="h-4 w-4 fill-blue-600 text-blue-600" />
            Suggestions rapides
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map(({ label, message, icon: Icon }) => (
              <button
                key={label}
                type="button"
                disabled={isLoading}
                onClick={() => void submitMessage(message, false)}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <form
          className="flex items-center gap-3 border-t border-blue-100 bg-white px-5 py-4"
          onSubmit={sendMessage}
        >
          <button
            type="button"
            className="text-slate-400 transition hover:text-blue-600"
            aria-label="Joindre un fichier"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={listening ? "Je vous écoute…" : "Écrivez votre question ici..."}
            aria-label="Message pour l’IA"
            className="h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <Button
            type="button"
            size="icon"
            variant={listening ? "destructive" : "ghost"}
            className="h-10 w-10 rounded-full"
            onClick={toggleMic}
            aria-label={listening ? "Arrêter la dictée" : "Dicter un message"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="submit"
            size="icon"
            className="h-12 w-12 rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700"
            disabled={isLoading || !question.trim()}
            aria-label="Envoyer"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}