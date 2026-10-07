import { useState, type FormEvent } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { askAssistant } from "../data/intelligenceService";
import type { ReservationRecord } from "../services/reservationService";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export interface AssistantChatProps {
  reservation?: ReservationRecord;
  onReservationCreated?: (reservation: ReservationRecord) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AssistantChat({ reservation, onReservationCreated }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = question.trim();
    if (!message || isLoading) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await askAssistant({
        question: message,
        context: reservation ? JSON.stringify({ reservation }) : undefined,
      });
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: typeof response === "string" ? response : JSON.stringify(response, null, 2),
      }]);
    } catch {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Je n’ai pas pu traiter la demande. Vérifiez votre connexion ou relancez-la.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Assistant conversationnel IA</CardTitle>
      </CardHeader>
      <CardContent className="flex h-[420px] flex-col gap-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" />
              Demandez-moi de proposer un voyage, d’expliquer la disponibilité ou de préparer une réservation.
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
              {message.content}
            </div>
          ))}
          {isLoading && <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">L’IA réfléchit…</div>}
        </div>
        <form className="flex gap-2" onSubmit={sendMessage}>
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Demandez une réservation…" aria-label="Message pour l’IA" />
          <Button type="submit" size="icon" disabled={isLoading || !question.trim()}><Send className="h-4 w-4" /></Button>
        </form>
        {onReservationCreated && <p className="text-xs text-muted-foreground">Les résultats de réservation peuvent être reliés à l’IA.</p>}
      </CardContent>
    </Card>
  );
}
