import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { askAssistant } from "../data/intelligenceService";
import type { ReservationRecord } from "../services/reservationService";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

// ───────── Parseur déterministe (sans IA) ─────────
// Parseur déterministe (sans IA) : comprend une demande de réservation en français.
// Aucune hallucination possible : si une info manque, on la demande.

interface ReservationDraft {
  depart?: string;
  arrivee?: string;
  date?: string; // YYYY-MM-DD
  passagers?: number;
  marchandise?: string;
  poidsKg?: number;
}

type Intent = "reserver" | "disponibilite" | "annuler" | "aide" | "confirmer" | "inconnu";

const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MONTHS = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const DAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

function detectIntent(text: string): Intent {
  const t = strip(text);
  if (/^(oui|ok|d'accord|confirme|confirmer|valide|valider)\b/.test(t)) return "confirmer";
  if (/annul/.test(t)) return "annuler";
  if (/disponib|place|reste|libre/.test(t) && !/reserv|book/.test(t)) return "disponibilite";
  if (/reserv|book|voyage|envoy|transport|expedi|reserve/.test(t)) return "reserver";
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

  // 2) motifs "de X à Y" / "X -> Y" / "vers Y"
  const word = "([A-ZÀ-Ý][\\p{L}'-]+(?:\\s[A-ZÀ-Ý][\\p{L}'-]+)?)";
  const m1 = raw.match(new RegExp(`\\bde\\s+${word}\\s+(?:à|a|vers|pour|jusqu'à)\\s+${word}`, "u"));
  if (m1) return { depart: m1[1], arrivee: m1[2] };
  const m2 = raw.match(new RegExp(`${word}\\s*(?:->|→|=>|-)\\s*${word}`, "u"));
  if (m2) return { depart: m2[1], arrivee: m2[2] };
  const m3 = raw.match(new RegExp(`\\b(?:vers|pour|à)\\s+${word}`, "u"));
  if (m3) return { arrivee: m3[1] };
  return {};
}

function parseQuantities(text: string): Pick<ReservationDraft, "passagers" | "poidsKg" | "marchandise"> {
  const t = strip(text);
  const out: Pick<ReservationDraft, "passagers" | "poidsKg" | "marchandise"> = {};

  const pax = t.match(/\b(\d{1,3})\s*(personnes?|passagers?|pers\b|adultes?)/);
  if (pax) out.passagers = +pax[1];

  const kg = t.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilos?|tonnes?|t\b)/);
  if (kg) {
    const v = parseFloat(kg[1].replace(",", "."));
    out.poidsKg = /^t/.test(kg[2]) ? v * 1000 : v;
  }

  const goods = t.match(/\b(\d+\s*)?(sacs?|cartons?|colis|caisses?|fûts?|futs?|bidons?|marchandises?|riz|ciment|meubles?|motos?)\b(?:\s+de\s+([a-z]+))?/);
  if (goods) out.marchandise = goods[0].trim();
  return out;
}

function mergeDraft(prev: ReservationDraft, text: string, knownPlaces: string[] = []): ReservationDraft {
  const route = parseRoute(text, knownPlaces);
  const q = parseQuantities(text);
  const date = parseDate(text);
  const next: ReservationDraft = { ...prev };
  if (route.depart) next.depart = route.depart;
  if (route.arrivee) next.arrivee = route.arrivee;
  if (date) next.date = date;
  if (q.passagers !== undefined) next.passagers = q.passagers;
  if (q.poidsKg !== undefined) next.poidsKg = q.poidsKg;
  if (q.marchandise) next.marchandise = q.marchandise;
  return next;
}

function missingFields(d: ReservationDraft): string[] {
  const miss: string[] = [];
  if (!d.depart) miss.push("le port de départ");
  if (!d.arrivee) miss.push("la destination");
  if (!d.date) miss.push("la date");
  if (!d.passagers && !d.poidsKg && !d.marchandise) miss.push("les passagers ou la marchandise (type / poids)");
  return miss;
}

function summarize(d: ReservationDraft): string {
  const parts = [
    `Trajet : ${d.depart ?? "?"} → ${d.arrivee ?? "?"}`,
    `Date : ${d.date ?? "?"}`,
  ];
  if (d.passagers) parts.push(`Passagers : ${d.passagers}`);
  if (d.marchandise) parts.push(`Marchandise : ${d.marchandise}`);
  if (d.poidsKg) parts.push(`Poids : ${d.poidsKg} kg`);
  return parts.join("\n");
}

// ───────── Composant ─────────

export interface AssistantChatProps {
  reservation?: ReservationRecord;
  onReservationCreated?: (reservation: ReservationRecord) => void;
  /** Ports / destinations connus (ex: noms des trajets) pour une détection fiable. */
  knownPlaces?: string[];
  /** À brancher sur votre service : crée vraiment la réservation côté backend. */
  createReservation?: (draft: ReservationDraft) => Promise<ReservationRecord>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const HELP =
  "Je peux préparer une réservation. Exemple : « Réserver de Toamasina à Mahajanga demain, 20 sacs de riz, 1000 kg ». Je vous demande ce qui manque, puis vous confirmez.";

export default function AssistantChat({
  reservation,
  onReservationCreated,
  knownPlaces = [],
  createReservation,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const draftRef = useRef<ReservationDraft>({});
  const awaitingConfirm = useRef(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Défilement automatique vers le dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Arrêt du micro quand le composant est démonté
  useEffect(
    () => () => {
      voiceMode.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const lastReply = useRef("");
  const voiceMode = useRef(false); // true tant que l'échange se fait à la voix
  const submitRef = useRef<(m: string, byVoice: boolean) => Promise<void>>(async () => {});

  const push = (role: ChatMessage["role"], content: string) => {
    if (role === "assistant") lastReply.current = content;
    setMessages((c) => [...c, { id: crypto.randomUUID(), role, content }]);
  };

  // Lecture vocale de la réponse (retourne quand la phrase est terminée)
  const speak = (text: string) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[✅]/g, "").replace(/\n+/g, ". "));
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

  const handle = async (message: string) => {
    const intent = detectIntent(message);

    // Confirmation ou annulation d'une réservation préparée
    if (awaitingConfirm.current && (intent === "confirmer" || intent === "annuler")) {
      if (intent === "annuler") {
        draftRef.current = {};
        awaitingConfirm.current = false;
        return push("assistant", "Réservation annulée. Dites-moi si vous voulez recommencer.");
      }
      if (!createReservation) {
        return push(
          "assistant",
          "Brouillon prêt, mais la création n'est pas encore branchée (prop createReservation).",
        );
      }
      const created = await createReservation(draftRef.current);
      onReservationCreated?.(created);
      draftRef.current = {};
      awaitingConfirm.current = false;
      return push("assistant", "✅ Réservation créée avec succès.");
    }

    if (intent === "aide") return push("assistant", HELP);

    // Annulation d'un brouillon incomplet
    if (intent === "annuler" && Object.keys(draftRef.current).length > 0) {
      draftRef.current = {};
      return push("assistant", "Brouillon supprimé.");
    }

    // Collecte des informations (nouvelle réservation ou compléments)
    const hasDraft = Object.keys(draftRef.current).length > 0;
    if (intent === "reserver" || (hasDraft && intent !== "disponibilite")) {
      draftRef.current = mergeDraft(draftRef.current, message, knownPlaces);
      const miss = missingFields(draftRef.current);
      if (miss.length) {
        awaitingConfirm.current = false;
        return push("assistant", `${summarize(draftRef.current)}\n\nIl me manque : ${miss.join(", ")}.`);
      }
      awaitingConfirm.current = true;
      return push(
        "assistant",
        `${summarize(draftRef.current)}\n\nConfirmez-vous la réservation ? (oui / annuler)`,
      );
    }

    // Questions ouvertes (disponibilité, explications) → service IA, avec contexte
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
        // Brouillon ouvert (info manquante ou confirmation attendue) → on réécoute
        const open = Object.keys(draftRef.current).length > 0;
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