// src/components/AgentChat.tsx
// Chat conversationnel branché sur /api/ai/agent. Le texte est libre ; seul le bouton
// « Confirmer » (route /confirm) enregistre une réservation.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, RotateCcw, Send, User } from "lucide-react";
import { formatCurrency } from "../Tools/Tools";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { agentCancel, agentChat, agentConfirm, type PendingView } from "../services/agentService";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  success?: boolean;
}

const STORAGE_KEY = "sj_agent_conv";
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Bonjour ! Je suis l'assistant Saint-Jude. Dites-moi ce que vous souhaitez envoyer, vers où et pour quand, ou posez-moi une question sur les voyages, les tarifs et les bateaux.",
};

export default function AgentChat({ onReservationCreated }: { onReservationCreated?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingView | null>(null);
  const [convId, setConvId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, pending]);

  const add = (role: Message["role"], content: string, success = false) =>
    setMessages((m) => [...m, { id: uid(), role, content, success }]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    add("user", text);
    setBusy(true);
    try {
      const out = await agentChat(text, convId);
      setConvId(out.conversationId);
      try {
        localStorage.setItem(STORAGE_KEY, out.conversationId);
      } catch {
        /* stockage indisponible : la conversation reste valable pour cette session */
      }
      setPending(out.pending);
      add("assistant", out.reply);
    } catch (error) {
      add("assistant", error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!convId || busy) return;
    setBusy(true);
    try {
      const out = await agentConfirm(convId);
      setPending(null);
      add("assistant", out.reply, true);
      onReservationCreated?.();
    } catch (error) {
      add("assistant", error instanceof Error ? error.message : "Réservation non enregistrée.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!convId) return setPending(null);
    setPending(null);
    try {
      await agentCancel(convId);
    } catch {
      /* le brouillon expire de toute façon après 30 min */
    }
    add("assistant", "D'accord, la réservation n'est pas enregistrée.");
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignoré */
    }
    setConvId(undefined);
    setPending(null);
    setMessages([WELCOME]);
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-blue-100 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Assistant IA – Saint-Jude</h2>
            <p className="text-xs text-emerald-600">En ligne</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={reset} aria-label="Nouvelle conversation">
          <RotateCcw className="mr-1.5 h-4 w-4" /> Nouvelle
        </Button>
      </CardHeader>

      <CardContent className="flex h-[560px] flex-col gap-3 p-0">
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pt-5">
          {messages.map((m) => {
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex items-end gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    mine ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {mine ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>
                <div
                  className={`max-w-[78%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    mine
                      ? "rounded-br-md bg-blue-600 text-white"
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
                </div>
              </div>
            );
          })}

          {pending && (
            <div className="ml-10 max-w-[78%] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
              <div className="bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Récapitulatif
              </div>
              <dl className="divide-y text-sm">
                {(
                  [
                    ["Marchandise", `${pending.quantite} ${pending.unite ?? ""} ${pending.marchandise}`.replace(/\s+/g, " ").trim()],
                    ["Poids total", `${pending.poidsTotalKg} kg`],
                    ["Trajet", `${pending.depart} → ${pending.arrivee}`],
                    ["Date", pending.date],
                    ...(pending.bateau ? [["Navire", pending.bateau]] : []),
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
                {pending.prix != null && (
                  <div className="flex justify-between gap-4 bg-slate-50 px-4 py-2.5">
                    <dt className="font-medium">Prix total</dt>
                    <dd className="font-semibold text-blue-700">{formatCurrency(pending.prix)}</dd>
                  </div>
                )}
              </dl>
              <div className="flex gap-2 p-3">
                <Button type="button" disabled={busy} onClick={() => void confirm()} className="bg-emerald-600 hover:bg-emerald-700">
                  Confirmer
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void cancel()}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {busy && (
            <div className="ml-10 flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-blue-100/70 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="flex items-center gap-3 border-t border-blue-100 bg-white px-5 py-4" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écrivez votre message..."
            aria-label="Message pour l'assistant"
            className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 px-5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            disabled={busy || !input.trim()}
            aria-label="Envoyer"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}