import { FC, FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Send, Loader2, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';

// URL du backend Render (jamais localhost en production).
// Vercel → Settings → Environment Variables : VITE_API_URL=https://votre-backend.onrender.com
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

// Jeton d'authentification : adaptez cette fonction si votre application le stocke ailleurs.
// Si vous utilisez un cookie de session, le `credentials: 'include'` ci-dessous suffit.
const getToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

type ChatMsg = { role: 'user' | 'assistant'; content: string; error?: boolean };
type Period = { start?: string; end?: string; label: string };

interface Props {
  /**
   * 'cash'  = page Gestion de caisse      → /api/ai/finance/chat
   * 'fuel'  = page Consommation carburant → /api/ai/finance/chat
   * 'boats' = page Gestion des bateaux    → /api/ai/chat (réponses lues dans la table des bateaux)
   */
  scope: 'cash' | 'fuel' | 'boats';
}

const SUGGESTIONS: Record<Props['scope'], string[]> = {
  cash: [
    'Pourquoi mon solde net est-il à ce montant ?',
    'Résume les mouvements de ce mois',
    'Y a-t-il des anomalies ou des doublons ?',
  ],
  boats: [
    'Quels bateaux sont disponibles ?',
    'Quels bateaux sont en maintenance ?',
    'Combien de bateaux sont enregistrés ?',
  ],
  fuel: [
    'Quel trajet consomme le plus de carburant ?',
    'Compare ce mois et le mois dernier',
    'Y a-t-il des consommations inhabituelles ?',
  ],
};

const AiFinanceChat: FC<Props> = ({ scope }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    const history = messages.filter((m) => !m.error).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);

    try {
      const token = getToken();
      const endpoint = scope === 'boats' ? '/api/ai/chat' : '/api/ai/finance/chat';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(scope === 'boats' ? { question: q } : { question: q, scope, history, period }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          res.status === 401
            ? 'Votre session a expiré. Reconnectez-vous puis réessayez.'
            : res.status === 403
              ? data?.error ?? 'Vous n’avez pas accès à cet assistant.'
              : res.status === 429
                ? 'Trop de questions en peu de temps. Réessayez dans une minute.'
                : data?.error ?? 'Le serveur n’a pas pu répondre. Réessayez dans un instant.';
        setMessages((m) => [...m, { role: 'assistant', content: msg, error: true }]);
        return;
      }

      if (data.period) setPeriod(data.period as Period);
      setMessages((m) => [...m, { role: 'assistant', content: String(data.reply ?? '') }]);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: aborted
            ? 'La réponse prend trop de temps. Réessayez dans un instant.'
            : 'Impossible de joindre le serveur. Vérifiez votre connexion.',
          error: true,
        },
      ]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600" />{' '}
              {scope === 'boats' ? 'Assistant IA – Bateaux' : 'Assistant financier SAINT-JUDE'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Posez une question sur{' '}
              {scope === 'cash'
                ? 'vos mouvements de caisse'
                : scope === 'fuel'
                  ? 'votre consommation de carburant'
                  : 'vos bateaux, leur capacité ou leur disponibilité'}
              .
            </p>
            {period && period.label !== 'toute la période enregistrée' && (
              <p className="text-[11px] text-blue-700 mt-1">Période analysée : {period.label}</p>
            )}
          </div>
          <Bot className="h-12 w-12 text-blue-500 shrink-0" />
        </div>

        {messages.length > 0 && (
          <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : m.error
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-white text-gray-800 border border-blue-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {messages.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS[scope].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                disabled={loading}
                className="text-[11px] rounded-full border border-blue-200 bg-white px-3 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question…"
            className="text-xs"
            maxLength={500}
            disabled={loading}
          />
          <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {messages.length > 0 && (
          <button
            type="button"
            className="mt-2 text-[11px] text-gray-500 hover:text-gray-700 underline"
            onClick={() => {
              setMessages([]);
              setPeriod(null);
            }}
          >
            Nouvelle conversation
          </button>
        )}
      </CardContent>
    </Card>
  );
};

export default AiFinanceChat;