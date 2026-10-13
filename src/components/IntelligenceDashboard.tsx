import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { io, type Socket } from "socket.io-client";
import type { RootState } from "../redux";
import {
  askAssistant,
  classifyIntent,
  getAiStatus,
  getCapabilitiesStatus,
  getLatestPosition,
  getRealtimeOrigin,
  optimizeRoute,
  runMultiAgent,
  selectTools,
  tapRag,
} from "../data/intelligenceService";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";

const tabs = [
  { id: "gps", label: "GPS & temps réel" },
  { id: "routing", label: "Optimisation" },
  { id: "chatbot", label: "Chatbot IA" },
  { id: "tools", label: "Outils IA" },
  { id: "monitoring", label: "Monitoring Dashboard" },
] as const;

type Tab = (typeof tabs)[number]["id"];
type ApiStatus = { status?: string; [key: string]: unknown };
type Position = { boatId: string; latitude: number; longitude: number; speed?: number; createdAt?: string };

const statusLabel = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) return String((value as { message?: unknown }).message);
  return "Non disponible";
};

export default function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("gps");
  const [position, setPosition] = useState<Position | null>(null);
  const [latestMessage, setLatestMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [toolQuestion, setToolQuestion] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [multiAgentResult, setMultiAgentResult] = useState<string>("");
  const [aiStatus, setAiStatus] = useState<ApiStatus>({});
  const [capabilitiesStatus, setCapabilitiesStatus] = useState<ApiStatus>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { reservation, cashMouvement, boat, trip } = useSelector((state: RootState) => state.stJude);

  const monitoringMetrics = useMemo(() => {
    const paidReservations = reservation.filter(item => item.paymentStatus).length;
    const outstanding = reservation.reduce((sum, item) => sum + Number(item.amountToPay || 0), 0);
    const totalCredits = cashMouvement.reduce((sum, item) => sum + Number(item.credit || 0), 0);
    const totalDebits = cashMouvement.reduce((sum, item) => sum + Number(item.debit || 0), 0);

    return {
      reservations: reservation.length,
      paidReservations,
      outstanding,
      boats: boat.length,
      trips: trip.length,
      totalCredits,
      totalDebits,
      netBalance: totalCredits - totalDebits,
    };
  }, [reservation, cashMouvement, boat, trip]);

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        const latest = await getLatestPosition("BOAT-001");
        if (!cancelled) setPosition(latest);
      } catch (requestError) {
        if (!cancelled) setError("Position non disponible : " + String(requestError));
      }

      socket = io(getRealtimeOrigin(), { withCredentials: true, transports: ["websocket", "polling"] });
      socket.on("position", (payload: Position) => {
        if (!cancelled) {
          setPosition(payload);
          setLatestMessage(`Position reçu pour ${payload.boatId}`);
        }
      });
      socket.on("connect_error", () => {
        if (!cancelled) setLatestMessage("Connexion realtime temporairement indisponible");
      });
    };

    Promise.all([getAiStatus(), getCapabilitiesStatus()]).then(([ai, capabilities]) => {
      if (!cancelled) {
        setAiStatus(ai);
        setCapabilitiesStatus(capabilities);
      }
    });

    connect();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);

  const callFunction = async (callback: () => Promise<unknown>, successMessage: string) => {
    setLoading(true);
    setError("");
    try {
      await callback();
      setLatestMessage(successMessage);
    } catch (requestError) {
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleAssistant = async () => {
    if (!question.trim()) return;
    await callFunction(() => askAssistant({ question }).then((data) => setAnswer(String(data.reponse ?? JSON.stringify(data)))), "Réponse IA reçue");
  };

  const handleRag = async () => {
    if (!query.trim()) return;
    await callFunction(() => tapRag(query).then((data) => setAnswer(JSON.stringify(data, null, 2))), "Recherche RAG terminée");
  };

  const handleTools = async () => {
    if (!toolQuestion.trim()) return;
    await callFunction(async () => {
      const data = await selectTools(toolQuestion);
      setSelectedTools(data.selectedTools ?? []);
      setAnswer(JSON.stringify(data, null, 2));
    }, "Outils sélectionnés");
  };

  const handleMultiAgent = async () => {
    if (!question.trim()) return;
    await callFunction(() => runMultiAgent(question).then((data) => setMultiAgentResult(JSON.stringify(data, null, 2))), "Multi-agent terminé");
  };

  const handleOptimize = async () => {
    await callFunction(async () => {
      const data = await optimizeRoute({ depart: "Mahajanga", escales: ["Nosy Be", "Antsiranana"] });
      setAnswer(JSON.stringify(data, null, 2));
    }, "Optimisation calculée");
  };

  const handleClassify = async () => {
    if (!question.trim()) return;
    await callFunction(() => classifyIntent(question).then((data) => setAnswer(JSON.stringify(data, null, 2))), "Intent classé");
  };

  const capabilities = useMemo(() => [
    { label: "AI", value: statusLabel(aiStatus.status ?? aiStatus) },
    { label: "Capabilités", value: statusLabel(capabilitiesStatus.status ?? capabilitiesStatus) },
  ], [aiStatus, capabilitiesStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-primary">Dashboard Intelligent</h1>
        <p className="text-sm text-muted-foreground">Chatbot, GPS, monitoring, optimisation et outils IA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {tabs.map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "default" : "outline"} onClick={() => setActiveTab(tab.id)}>{tab.label}</Button>
        ))}
      </div>

      {error && <Alert variant="destructive"><AlertTitle>Erreur d’intégration</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      {activeTab === "gps" && (
        <Card>
          <CardHeader><CardTitle>Suivi GPS et temps réel</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Dernière position</div>
              <div className="mt-2 text-lg font-semibold">{position?.boatId ?? "Aucune position"}</div>
              <div className="mt-1 text-sm">Latitude : {position?.latitude ?? "—"}</div>
              <div className="text-sm">Longitude : {position?.longitude ?? "—"}</div>
              <div className="text-sm">Vitesse : {position?.speed ?? "—"} m/s</div>
            </div>
            <div className="space-y-3">
              <Badge variant="secondary">WebSocket actif</Badge>
              <p className="text-sm">Les positions arrivent du service backend via Socket.IO. Le composant écoute les événements position.</p>
              <p className="text-sm text-muted-foreground">{latestMessage || "En attente d’un message realtime"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "routing" && (
        <Card>
          <CardHeader><CardTitle>Optimisation de trajet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value="Mahajanga" readOnly aria-label="Départ" />
              <Input value="Nosy Be / Antsiranana" readOnly aria-label="Escales" />
            </div>
            <Button onClick={handleOptimize} disabled={loading}>Calculer l’optimisation</Button>
            {answer && <pre className="overflow-auto rounded-lg bg-black/5 p-4 text-sm">{answer}</pre>}
          </CardContent>
        </Card>
      )}

      {activeTab === "chatbot" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Chatbot IA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Posez une question métier…" />
              <Button onClick={handleAssistant} disabled={loading}>Interroger le chatbot</Button>
              <Button variant="outline" onClick={handleMultiAgent} disabled={loading}>Lancer les agents multiples</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Réponse</CardTitle></CardHeader>
            <CardContent>
              {answer ? <pre className="whitespace-pre-wrap rounded-lg bg-black/5 p-4 text-sm">{answer}</pre> : <p className="text-sm text-muted-foreground">Aucune réponse encore.</p>}
              {multiAgentResult && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-black/5 p-4 text-sm">{multiAgentResult}</pre>}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "tools" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>RAG et sélection JIT</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une documentation…" />
              <Button onClick={handleRag} disabled={loading}>Lancer RAG</Button>
              <Textarea value={toolQuestion} onChange={(event) => setToolQuestion(event.target.value)} placeholder="Exemples : météo, distance, bateaux…" />
              <Button variant="outline" onClick={handleTools} disabled={loading}>Sélectionner les outils JIT</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Outils et résultats</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>{selectedTools.length ? selectedTools.map((tool) => <Badge key={tool} className="mr-2">{tool}</Badge>) : <span className="text-sm text-muted-foreground">Aucun outil sélectionné.</span>}</div>
              {answer && <pre className="whitespace-pre-wrap rounded-lg bg-black/5 p-4 text-sm">{answer}</pre>}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "monitoring" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader><CardTitle>Réservations</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{monitoringMetrics.reservations}</p><p className="text-xs text-muted-foreground">{monitoringMetrics.paidReservations} payées</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Montant restant</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{monitoringMetrics.outstanding.toLocaleString("fr-FR")} Ar</p><p className="text-xs text-muted-foreground">À recouvrer</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Bateaux & voyages</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{monitoringMetrics.boats} / {monitoringMetrics.trips}</p><p className="text-xs text-muted-foreground">Bateaux / voyages actifs</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Solde caisse</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{monitoringMetrics.netBalance.toLocaleString("fr-FR")} Ar</p><p className="text-xs text-muted-foreground">Crédits moins débits</p></CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>État des services</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {capabilities.map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm">{item.label}</span>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Évaluation et intent</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Exemples : nouvelle réservation, capacité, etc." />
                <Button variant="outline" onClick={handleClassify} disabled={loading}>Classifier l’intent</Button>
                <p className="text-xs text-muted-foreground">Les données du monitoring sont calculées depuis le store Redux et les services IA.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
