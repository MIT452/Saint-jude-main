import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import {
  Anchor,
  BellRing,
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Droplet,
  Eye,
  Filter,
  Hammer,
  Leaf,
  Lightbulb,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Ship,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Volume2,
  Wallet,
  Wrench,
  XCircle,
} from "lucide-react";
import { askAssistant, createReservationAnnouncement } from "../data/intelligenceService";
import type { Boat, Trip } from "../data/type";
import type { RootState } from "../redux";
import {
  createReservation,
  getReservations,
  updateReservationStatus,
  type NotificationChannel,
  type ReservationRecord,
} from "../services/reservationService";
import {
  createAssistantReservation,
  verifyAssistantReservation,
} from "../services/assistantReservationService";
import { formatCurrency } from "../Tools/Tools";
import AssistantReservationsPage from "./AssistantReservationsPage";
import PassengerReservation from "./PassengerReservation";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const tabs = [
  { id: "classic", label: "Réservation", icon: Ship },
  { id: "assistant", label: "Assistant IA", icon: MessageCircle },
  { id: "availability", label: "Disponibilité", icon: CalendarClock },
  { id: "recurrent", label: "Récurrente", icon: RefreshCcw },
  { id: "group", label: "Groupe", icon: Users },
  { id: "predictive", label: "Prédictive", icon: Sparkles },
  { id: "multimodal", label: "Multimodale", icon: Volume2 },
] as const;

type Tab = (typeof tabs)[number]["id"];

/* =========================
   Utilitaires
   Les montants sont affichés en Ar via formatCurrency (Tools/Tools),
   comme sur la page Gestion des Marchandises.
========================= */

const normaliserTexte = (valeur?: string) =>
  (valeur ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const estConfirmee = (statut?: string) => normaliserTexte(statut).includes("confirm");
const estAnnulee = (statut?: string) => {
  const valeur = normaliserTexte(statut);
  return valeur.includes("annul") || valeur.includes("refus");
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erreur inconnue";

const DAY_MS = 24 * 60 * 60 * 1000;

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  const date = parsed.toLocaleDateString("fr-FR");
  const time = parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
};

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

// Lecture sécurisée de champs optionnels (image, capitaine, statut du bateau...)
const readFirst = (source: unknown, keys: string[]): string => {
  const record = source as Record<string, unknown> | undefined;
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
};

const countOf = (source: unknown, keys: string[]): number => {
  const record = source as Record<string, unknown> | undefined;
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
};

// Date + heure d'une réservation (le nom exact du champ dépend de ReservationRecord)
const getReservationDateTime = (reservation: ReservationRecord) => {
  const record = reservation as unknown as Record<string, unknown>;
  const raw =
    record.date ?? record.departureDate ?? record.departDate ?? record.depart ?? record.createdAt;
  if (typeof raw !== "string" && typeof raw !== "number") return { date: "—", time: "" };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { date: "—", time: "" };
  const separateTime = typeof record.time === "string" ? record.time : "";
  const hasTime = typeof raw === "string" && /T\d|\d:\d/.test(raw);
  return {
    date: parsed.toLocaleDateString("fr-FR"),
    time:
      separateTime ||
      (hasTime ? parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""),
  };
};

const countThisWeek = (items: unknown[]) => {
  const limit = Date.now() - 7 * DAY_MS;
  return items.filter((item) => {
    const raw = (item as Record<string, unknown>)?.createdAt;
    if (typeof raw !== "string" && typeof raw !== "number") return false;
    const time = new Date(raw).getTime();
    return !Number.isNaN(time) && time >= limit;
  }).length;
};

const formatPercent = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;

const isBoatInMaintenance = (item: Boat) =>
  normaliserTexte(readFirst(item, ["status", "state", "etat", "statut"])).includes("maint");

const exportCsv = (rows: ReservationRecord[]) => {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Client",
    "Téléphone",
    "Trajet",
    "Date",
    "Marchandise",
    "Qté",
    "Poids total (kg)",
    "Prix total (Ar)",
    "Statut",
  ];
  const lines = rows.map((r) =>
    [
      r.clientName,
      r.clientPhone,
      `${r.departure} → ${r.destination}`,
      getReservationDateTime(r).date,
      `${r.cargoType ?? ""} ${r.cargo ?? ""}`.trim(),
      r.passengers,
      r.totalWeightKg,
      r.totalPrice,
      r.status,
    ]
      .map(escape)
      .join(";")
  );
  const content = "\ufeff" + [header.map(escape).join(";"), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "reservations.csv";
  link.click();
  URL.revokeObjectURL(url);
};

/* =========================
   Page principale
========================= */

export default function ReservationExperience() {
  const stJude = useSelector((state: RootState) => state.stJude);
  const { trip, boat } = stJude;
  const [activeTab, setActiveTab] = useState<Tab>("classic");
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);
  const [status, setStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [channel, setChannel] = useState<NotificationChannel>("whatsapp");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Ports connus (noms des trajets) : l'assistant les reconnaît plus sûrement
  const knownPlaces = useMemo(
    () => Array.from(new Set(trip.flatMap((item) => [item.from, item.to]).filter(Boolean))),
    [trip]
  );

  const stats = useMemo(() => {
    const total = reservations.length;
    const confirmed = reservations.filter((r) => estConfirmee(r.status)).length;
    const cancelled = reservations.filter((r) => estAnnulee(r.status)).length;
    const pending = Math.max(total - confirmed - cancelled, 0);
    const pct = (value: number) => (total ? (value * 100) / total : 0);
    return {
      total,
      confirmed,
      pending,
      cancelled,
      confirmedPct: pct(confirmed),
      pendingPct: pct(pending),
      cancelledPct: pct(cancelled),
      thisWeek: countThisWeek(reservations),
    };
  }, [reservations]);

  const availableBoats = useMemo(() => boat.filter((item) => !isBoatInMaintenance(item)).length, [boat]);

  // Axe le plus demandé (hors annulations) pour le conseil IA
  const topRoute = useMemo(() => {
    const counts = new Map<string, number>();
    reservations.forEach((r) => {
      if (estAnnulee(r.status)) return;
      const key = `${r.departure} → ${r.destination}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let best = "";
    let max = 0;
    counts.forEach((value, key) => {
      if (value > max) {
        max = value;
        best = key;
      }
    });
    return best;
  }, [reservations]);

  const refreshReservations = async () => {
    setIsLoading(true);
    setErrorStatus("");
    try {
      setReservations(await getReservations());
    } catch (error) {
      setErrorStatus(`Impossible de charger les réservations : ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshReservations();
  }, []);

  // Garde la réservation sélectionnée à jour après chaque actualisation
  useEffect(() => {
    setSelectedReservation((current) =>
      current ? reservations.find((item) => item.id === current.id) ?? current : current
    );
  }, [reservations]);

  const handleAdd = async (reservation: ReservationRecord) => {
    setErrorStatus("");
    try {
      const saved = await createReservation(reservation);
      setReservations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedReservation(saved);
      setStatus(`Réservation ajoutée en attente de confirmation : ${saved.clientName}.`);
    } catch (error) {
      setErrorStatus(`Échec de l’ajout de la réservation : ${getErrorMessage(error)}`);
    }
  };

  // Appelé par l'assistant IA : la réservation est déjà enregistrée, on met seulement l'affichage à jour
  const handleAssistantCreated = (saved: ReservationRecord) => {
    setErrorStatus("");
    setReservations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setSelectedReservation(saved);
    setStatus(`Réservation ajoutée en attente de confirmation : ${saved.clientName}.`);
  };

  const handleConfirm = async () => {
    if (!selectedReservation || isConfirming) return;
    setErrorStatus("");
    setVoiceStatus("");
    setIsConfirming(true);

    // 1) Étape principale : changer le statut (appel back inchangé)
    let finalized: ReservationRecord;
    try {
      finalized = await updateReservationStatus(selectedReservation.id, "Confirmée");
    } catch (error) {
      setErrorStatus(`Échec de la confirmation de la réservation : ${getErrorMessage(error)}`);
      setIsConfirming(false);
      return;
    }

    setReservations((current) => current.map((item) => (item.id === finalized.id ? finalized : item)));
    setSelectedReservation(finalized);
    setStatus(`Réservation confirmée : ${finalized.clientName}.`);
    setIsConfirming(false);

    // 2) Étape secondaire : annonce vocale (ne doit jamais casser la confirmation)
    const announcement = createReservationAnnouncement(finalized);

    try {
      await askAssistant({
        question: "Génère une annonce vocale de confirmation.",
        context: JSON.stringify({ reservation: finalized, announcement }),
      });
    } catch {
      // L'IA est facultative : on lit quand même l'annonce locale
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      setVoiceStatus(`Annonce vocale diffusée : ${announcement}`);
    } else {
      setVoiceStatus("La synthèse vocale n’est pas disponible dans ce navigateur.");
    }
  };

  const sendNotification = (reservation: ReservationRecord) => {
    setErrorStatus("");

    if (channel === "none") {
      setErrorStatus("Aucun canal sélectionné : choisissez WhatsApp ou e-mail.");
      return;
    }

    const message = encodeURIComponent(
      `Bonjour ${reservation.clientName}, votre réservation pour ${reservation.departure} → ${reservation.destination} est confirmée.`
    );

    if (channel === "whatsapp" || channel === "both") {
      const phone = (reservation.clientPhone ?? "").replace(/[^0-9]/g, "");
      if (phone) {
        window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
      } else {
        setErrorStatus("Numéro de téléphone manquant pour l’envoi WhatsApp.");
      }
    }

    if (channel === "email" || channel === "both") {
      if (reservation.clientEmail) {
        window.location.href = `mailto:${reservation.clientEmail}?subject=${encodeURIComponent(
          "Confirmation de réservation"
        )}&body=${message}`;
      } else {
        setErrorStatus("Adresse e-mail manquante pour l’envoi par e-mail.");
      }
    }
  };

  const goToClassic = (message: string) => {
    setStatus(message);
    setActiveTab("classic");
  };

  const openAssistant = () => setActiveTab("assistant");

  const table = (
    <ReservationsTable
      reservations={reservations}
      selectedId={selectedReservation?.id}
      onSelect={setSelectedReservation}
      onNew={() => setActiveTab("classic")}
    />
  );

  const fullWidth = activeTab === "assistant" || activeTab === "availability";

  return (
    <div className="space-y-5">
      {/* ===== En-tête ===== */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white shadow-md">
            <Ship className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Expérience de réservation multimodale</h1>
            <p className="text-sm text-muted-foreground">
              Réservation, IA, voix, disponibilité, notifications et prévisions.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={refreshReservations} disabled={isLoading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      {/* ===== Onglets ===== */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium shadow-sm transition-colors ${
              activeTab === id
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-border bg-white text-blue-900 hover:bg-blue-50"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" /> {label}
          </button>
        ))}
      </div>

      {fullWidth ? (
        <>
          {activeTab === "assistant" && (
            <AssistantReservationsPage
              reservations={reservations}
              reservation={selectedReservation ?? undefined}
              knownPlaces={knownPlaces}
              verifyReservation={verifyAssistantReservation}
              createReservation={createAssistantReservation}
              cancelReservation={(id) => updateReservationStatus(id, "Annulée")}
              onReservationCreated={handleAssistantCreated}
              onReservationUpdated={(updated) =>
                setReservations((current) => current.map((item) => (item.id === updated.id ? updated : item)))
              }
            />
          )}
          {activeTab === "availability" && (
            <AvailabilityPanel
              trip={trip}
              boat={boat}
              reservations={reservations}
              onOpenAssistant={openAssistant}
            />
          )}
          {table}
        </>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            {activeTab === "classic" && (
              <>
                <PassengerReservation onAdd={handleAdd} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-blue-900">État de la réservation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedReservation ? (
                        <>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Statut</span>
                            <StatusBadge status={selectedReservation.status} />
                          </div>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Voyage</span>
                            <span className="text-right font-medium">
                              {selectedReservation.departure} → {selectedReservation.destination}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Bateau</span>
                            <span className="text-right font-medium">{selectedReservation.boatName}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune réservation sélectionnée.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-blue-900">Notifications disponibles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Label>Canal</Label>
                      <Select value={channel} onValueChange={(value) => setChannel(value as NotificationChannel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="both">WhatsApp et e-mail</SelectItem>
                          <SelectItem value="none">Aucun canal</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedReservation && (
                        <>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleConfirm}
                            disabled={
                              isConfirming ||
                              estConfirmee(selectedReservation.status) ||
                              estAnnulee(selectedReservation.status)
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {isConfirming ? "Confirmation en cours..." : "Confirmer réservation"}
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => sendNotification(selectedReservation)}
                            disabled={!estConfirmee(selectedReservation.status)}
                          >
                            <Send className="mr-2 h-4 w-4" /> Envoyer la confirmation
                          </Button>
                          {!estConfirmee(selectedReservation.status) && (
                            <p className="text-xs text-muted-foreground">
                              La confirmation ne peut être envoyée qu’après la confirmation de la réservation.
                            </p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {activeTab === "recurrent" && (
              <RecurrentPanel
                onPlan={(resume) => goToClassic(`Réservation récurrente préparée (${resume}). Finalisez-la ci-dessous.`)}
              />
            )}
            {activeTab === "group" && (
              <GroupPanel
                onCreate={(resume) => goToClassic(`Réservation de groupe préparée (${resume}). Finalisez-la ci-dessous.`)}
              />
            )}
            {activeTab === "predictive" && (
              <PredictivePanel
                reservation={selectedReservation ?? undefined}
                topRoute={topRoute}
                onNew={() => setActiveTab("classic")}
                onDetails={openAssistant}
              />
            )}
            {activeTab === "multimodal" && <MultimodalPanel reservation={selectedReservation ?? undefined} />}

            {/* ===== Cartes de statistiques ===== */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                tone="blue"
                icon={<Ship className="h-6 w-6" />}
                label="Total réservations"
                value={stats.total}
                footer={
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" /> +{stats.thisWeek} cette semaine
                  </span>
                }
              />
              <StatCard
                tone="green"
                icon={<CheckCircle2 className="h-6 w-6" />}
                label="Confirmées"
                value={stats.confirmed}
                percent={stats.confirmedPct}
              />
              <StatCard
                tone="orange"
                icon={<Clock className="h-6 w-6" />}
                label="En attente"
                value={stats.pending}
                percent={stats.pendingPct}
              />
              <StatCard
                tone="red"
                icon={<XCircle className="h-6 w-6" />}
                label="Annulées"
                value={stats.cancelled}
                percent={stats.cancelledPct}
              />
              <StatCard
                tone="purple"
                icon={<Ship className="h-6 w-6" />}
                label="Bateaux disponibles"
                value={availableBoats}
                footer={<span className="text-xs text-muted-foreground">sur {boat.length}</span>}
              />
            </div>

            {table}
          </div>

          <SideColumn
            boats={boat}
            tripCount={trip.length}
            goodsCount={countOf(stJude, ["goods"])}
            cashCount={countOf(stJude, ["cashMovements", "cash", "movements", "transactions", "caisse"])}
            fuelCount={countOf(stJude, ["fuel", "fuels", "fuelConsumptions", "carburant"])}
            showAssistantSearch={activeTab === "predictive" || activeTab === "multimodal"}
            onOpenAssistant={openAssistant}
          />
        </div>
      )}

      {errorStatus && (
        <StatusMessage
          tone="error"
          icon={<BellRing className="h-5 w-5 text-red-600" />}
          title="Erreur"
          text={errorStatus}
        />
      )}
      {status && (
        <StatusMessage
          icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
          title="Information"
          text={status}
        />
      )}
      {voiceStatus && (
        <StatusMessage
          icon={<Volume2 className="h-5 w-5 text-primary" />}
          title="Message vocal IA"
          text={voiceStatus}
        />
      )}
    </div>
  );
}

/* =========================
   Petits composants
========================= */

function StatusBadge({ status }: { status: string }) {
  const valeur = normaliserTexte(status);

  let classes = "bg-orange-100 text-orange-700"; // En attente (par défaut)
  let icon = <Clock className="h-3.5 w-3.5" />;
  if (valeur.includes("confirm")) {
    classes = "bg-sky-100 text-blue-700";
    icon = <CheckCircle2 className="h-3.5 w-3.5" />;
  } else if (valeur.includes("annul") || valeur.includes("refus")) {
    classes = "bg-red-100 text-red-700";
    icon = <XCircle className="h-3.5 w-3.5" />;
  } else if (valeur.includes("termin")) {
    classes = "bg-green-100 text-green-700";
    icon = <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  return (
    <Badge className={`gap-1 whitespace-nowrap rounded-full font-medium ${classes}`}>
      {icon}
      {status}
    </Badge>
  );
}

function StatusMessage({
  icon,
  title,
  text,
  tone = "info",
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone?: "info" | "error";
}) {
  const classes = tone === "error" ? "border-red-200 bg-red-50" : "border-primary/20 bg-primary/5";
  return (
    <div className={`rounded-lg border p-4 text-sm ${classes}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}

const STAT_TONES = {
  blue: { box: "bg-blue-50 border-blue-100", circle: "bg-blue-600", label: "text-blue-700", bar: "bg-blue-500" },
  green: { box: "bg-green-50 border-green-100", circle: "bg-green-700", label: "text-green-700", bar: "bg-green-600" },
  orange: { box: "bg-orange-50 border-orange-100", circle: "bg-orange-400", label: "text-orange-600", bar: "bg-orange-400" },
  red: { box: "bg-red-50 border-red-100", circle: "bg-red-500", label: "text-red-600", bar: "bg-red-500" },
  purple: { box: "bg-purple-50 border-purple-100", circle: "bg-purple-600", label: "text-purple-700", bar: "bg-purple-500" },
} as const;

function StatCard({
  tone,
  icon,
  label,
  value,
  percent,
  footer,
}: {
  tone: keyof typeof STAT_TONES;
  icon: ReactNode;
  label: string;
  value: number;
  percent?: number;
  footer?: ReactNode;
}) {
  const colors = STAT_TONES[tone];
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${colors.box}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${colors.circle}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${colors.label}`}>{label}</p>
          <p className="text-2xl font-bold leading-tight text-blue-950">{value}</p>
        </div>
      </div>
      {percent !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
            <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(percent, 100)}%` }} />
          </div>
          <span className={`text-xs ${colors.label}`}>{formatPercent(percent)}</span>
        </div>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

function CargoIcon({ type }: { type?: string }) {
  const valeur = normaliserTexte(type);
  if (valeur.includes("agri")) return <Leaf className="h-5 w-5 text-amber-500" />;
  if (valeur.includes("petrol") || valeur.includes("carbur") || valeur.includes("gasoil"))
    return <Droplet className="h-5 w-5 text-blue-900" />;
  if (valeur.includes("construct")) return <Hammer className="h-5 w-5 text-red-500" />;
  return <Package className="h-5 w-5 text-blue-600" />;
}

/* =========================
   Tableau des réservations
========================= */

const PAGE_SIZE = 5;

function ReservationsTable({
  reservations,
  selectedId,
  onSelect,
  onNew,
}: {
  reservations: ReservationRecord[];
  selectedId?: string;
  onSelect: (reservation: ReservationRecord) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reservations.filter((reservation) => {
      if (statusFilter === "confirmed" && !estConfirmee(reservation.status)) return false;
      if (statusFilter === "cancelled" && !estAnnulee(reservation.status)) return false;
      if (
        statusFilter === "pending" &&
        (estConfirmee(reservation.status) || estAnnulee(reservation.status))
      )
        return false;
      return `${reservation.clientName} ${reservation.clientPhone} ${reservation.cargo} ${reservation.cargoType} ${reservation.destination} ${reservation.departure} ${reservation.boatName}`
        .toLowerCase()
        .includes(term);
    });
  }, [reservations, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const from = visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, visible.length);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white">
              <Ship className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-blue-900">Tableau des réservations</h2>
              <p className="text-xs text-muted-foreground">Liste et gestion de toutes les réservations</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-[220px] sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher un client ou un voyage..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters((current) => !current)}>
              <Filter className="mr-2 h-4 w-4" /> Filtres
            </Button>
            <Button variant="outline" onClick={() => exportCsv(visible)} disabled={visible.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exporter
            </Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={onNew}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle réservation
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 border-t bg-blue-50/50 px-4 py-3">
            <Label className="text-sm">Statut</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-52 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmées</SelectItem>
                <SelectItem value="cancelled">Annulées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="overflow-x-auto px-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-800 hover:bg-blue-800 [&>th]:text-white">
                <TableHead className="rounded-l-lg">Client</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Marchandise</TableHead>
                <TableHead>Qté</TableHead>
                <TableHead>Poids total</TableHead>
                <TableHead>Prix total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="rounded-r-lg">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((reservation) => {
                const when = getReservationDateTime(reservation);
                const showCargoLine = reservation.cargo && reservation.cargo !== reservation.cargoType;
                return (
                  <TableRow
                    key={reservation.id}
                    onClick={() => onSelect(reservation)}
                    className={`cursor-pointer hover:bg-blue-50/60 ${
                      selectedId === reservation.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <User className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-blue-900">{reservation.clientName}</p>
                          <p className="text-xs text-muted-foreground">{reservation.clientPhone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
                        {reservation.departure} → {reservation.destination}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">{when.date}</p>
                          {when.time && <p className="text-xs text-muted-foreground">{when.time}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CargoIcon type={reservation.cargoType} />
                        <div>
                          <p>{reservation.cargoType}</p>
                          {showCargoLine && (
                            <p className="text-xs text-muted-foreground">{reservation.cargo}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{reservation.passengers}</TableCell>
                    <TableCell className="whitespace-nowrap">{reservation.totalWeightKg} kg</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCurrency(Number(reservation.totalPrice) || 0)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={reservation.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(reservation);
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" /> Voir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Aucune réservation n’est disponible.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 p-4 text-sm text-muted-foreground sm:flex-row">
          <span>
            {visible.length === 0
              ? "Aucune réservation"
              : `Affichage de ${from} à ${to} sur ${visible.length} réservation(s)`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <Button
                key={number}
                size="icon"
                variant={number === currentPage ? "default" : "outline"}
                className={`h-8 w-8 ${number === currentPage ? "bg-blue-700 hover:bg-blue-800" : ""}`}
                onClick={() => setPage(number)}
              >
                {number}
              </Button>
            ))}
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================
   Colonne de droite
========================= */

function SideColumn({
  boats,
  tripCount,
  goodsCount,
  cashCount,
  fuelCount,
  showAssistantSearch,
  onOpenAssistant,
}: {
  boats: Boat[];
  tripCount: number;
  goodsCount: number;
  cashCount: number;
  fuelCount: number;
  showAssistantSearch: boolean;
  onOpenAssistant: () => void;
}) {
  const quick = [
    { label: "Trajets disponibles", value: tripCount, icon: <MapPin className="h-4 w-4 text-blue-700" /> },
    { label: "Marchandises", value: goodsCount, icon: <Package className="h-4 w-4 text-blue-700" /> },
    { label: "Mouvements de caisse", value: cashCount, icon: <Wallet className="h-4 w-4 text-blue-700" /> },
    { label: "Consommations de carburant", value: fuelCount, icon: <Droplet className="h-4 w-4 text-blue-700" /> },
  ];

  return (
    <div className="space-y-4">
      {showAssistantSearch && (
        <Card className="bg-blue-50/60">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-blue-900">Assistant IA</p>
                <p className="text-xs text-muted-foreground">Posez vos questions sur les réservations.</p>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                readOnly
                onFocus={onOpenAssistant}
                placeholder='Ex: "Disponibilité Antalaha → Toamasina"'
                className="bg-white pl-9 text-xs"
              />
            </div>
            <Button className="w-full bg-blue-700 hover:bg-blue-800" onClick={onOpenAssistant}>
              Ouvrir l’assistant
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-blue-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 text-white">
              <Ship className="h-4 w-4" />
            </span>
            Disponibilité des bateaux
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{boats.length} bateaux</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {boats.map((item) => {
            const image = readFirst(item, ["image", "photo", "imageUrl", "picture"]);
            const etat = readFirst(item, ["status", "state", "etat", "statut"]);
            const maintenance = isBoatInMaintenance(item);
            return (
              <div key={String(item.id)} className="flex items-center gap-3 rounded-lg border p-2">
                {image ? (
                  <img src={image} alt={item.name} className="h-16 w-20 shrink-0 rounded-md object-cover" />
                ) : (
                  <ShipIllustration small />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-blue-900">{item.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Capacité : {item.capacity}
                  </p>
                  <Badge
                    className={`mt-1 gap-1 rounded-full ${
                      maintenance
                        ? "bg-orange-100 text-orange-700 hover:bg-orange-100"
                        : "bg-green-100 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {maintenance ? <Wrench className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {etat || "Disponible"}
                  </Badge>
                </div>
              </div>
            );
          })}
          {boats.length === 0 && <p className="text-sm text-muted-foreground">Aucun bateau enregistré.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-blue-900">
            <Lightbulb className="h-5 w-5" /> Informations rapides
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {quick.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                {row.icon} {row.label}
              </span>
              <span className="font-semibold text-blue-900">{row.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 p-4 text-white shadow-md">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Bot className="h-7 w-7" />
          </span>
          <div>
            <p className="text-lg font-semibold">Besoin d’aide ?</p>
            <p className="text-sm text-blue-100">L’assistant IA est disponible pour vos réservations.</p>
          </div>
        </div>
        <Button className="mt-4 w-full bg-white text-blue-800 hover:bg-blue-50" onClick={onOpenAssistant}>
          <ChevronRight className="mr-2 h-4 w-4" /> Ouvrir l’assistant
        </Button>
      </div>
    </div>
  );
}

/* =========================
   Onglet Disponibilité
========================= */

const ALL = "all";
// Places déjà prises par défaut sur chaque voyage (capacité - 2)
const PLACES_RESERVEES_PAR_DEFAUT = 2;
const PERIODE_PAR_DEFAUT_JOURS = 14;

interface AvailabilityFilters {
  from: string;
  to: string;
  start: string;
  end: string;
  boatId: string;
  captain: string;
}

function AvailabilityPanel({
  trip,
  boat,
  reservations = [],
  onOpenAssistant,
}: {
  trip: Trip[];
  boat: Boat[];
  reservations?: ReservationRecord[];
  onOpenAssistant?: () => void;
}) {
  const [draft, setDraft] = useState<AvailabilityFilters>(() => {
    const now = new Date();
    return {
      from: ALL,
      to: ALL,
      start: toInputDate(now),
      end: toInputDate(new Date(now.getTime() + PERIODE_PAR_DEFAUT_JOURS * DAY_MS)),
      boatId: ALL,
      captain: ALL,
    };
  });
  const [applied, setApplied] = useState<AvailabilityFilters>(draft);

  // La période par défaut démarre au premier voyage (et non à aujourd'hui)
  const periodInitialised = useRef(false);
  useEffect(() => {
    if (periodInitialised.current || trip.length === 0) return;
    const times = trip
      .map((item) => new Date(item.depart).getTime())
      .filter((value) => !Number.isNaN(value));
    if (times.length === 0) return;
    periodInitialised.current = true;
    const first = new Date(Math.min(...times));
    const period = {
      start: toInputDate(first),
      end: toInputDate(new Date(first.getTime() + PERIODE_PAR_DEFAUT_JOURS * DAY_MS)),
    };
    setDraft((current) => ({ ...current, ...period }));
    setApplied((current) => ({ ...current, ...period }));
  }, [trip]);

  const ports = useMemo(
    () => Array.from(new Set(trip.flatMap((item) => [item.from, item.to]).filter(Boolean))),
    [trip]
  );

  const captains = useMemo(
    () =>
      Array.from(
        new Set(boat.map((item) => readFirst(item, ["captain", "captainName"])).filter(Boolean))
      ),
    [boat]
  );

  const boatById = useMemo(() => new Map(boat.map((item) => [String(item.id), item])), [boat]);

  // Places restantes = capacité - places par défaut - passagers des réservations non annulées sur le trajet
  const placesLeft = (item: Trip) => {
    const current = boatById.get(String(item.boatId));
    if (!current) return 0;
    const taken = reservations
      .filter((r) => r.departure === item.from && r.destination === item.to && !estAnnulee(r.status))
      .reduce((sum, r) => sum + (Number(r.passengers) || 0), 0);
    return Math.max(0, current.capacity - PLACES_RESERVEES_PAR_DEFAUT - taken);
  };

  const filteredTrips = useMemo(() => {
    const start = applied.start ? new Date(`${applied.start}T00:00:00`) : null;
    const end = applied.end ? new Date(`${applied.end}T23:59:59`) : null;

    return trip
      .filter((item) => {
        const departDate = new Date(item.depart);
        const current = boatById.get(String(item.boatId));
        const captain = current ? readFirst(current, ["captain", "captainName"]) : "";

        if (applied.from !== ALL && item.from !== applied.from) return false;
        if (applied.to !== ALL && item.to !== applied.to) return false;
        if (applied.boatId !== ALL && String(item.boatId) !== applied.boatId) return false;
        if (applied.captain !== ALL && captain !== applied.captain) return false;
        if (!Number.isNaN(departDate.getTime())) {
          if (start && departDate < start) return false;
          if (end && departDate > end) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.depart).getTime() - new Date(b.depart).getTime());
  }, [trip, applied, boatById]);

  const totalPlaces = filteredTrips.reduce((sum, item) => sum + placesLeft(item), 0);
  const activeBoats = new Set(filteredTrips.map((item) => String(item.boatId))).size;
  const reservationDays = Math.max(
    0,
    Math.round(
      (new Date(`${applied.end}T00:00:00`).getTime() - new Date(`${applied.start}T00:00:00`).getTime()) /
        DAY_MS
    )
  );

  const portSelect = (value: string, onChange: (value: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-white">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tous les ports</SelectItem>
        {ports.map((port) => (
          <SelectItem key={port} value={port}>
            {port}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      <Card className="bg-blue-50/60">
        <CardContent className="grid items-end gap-3 p-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1.2fr_1.2fr_auto]">
          <div className="space-y-1">
            <Label className="font-semibold">Départ</Label>
            {portSelect(draft.from, (value) => setDraft({ ...draft, from: value }))}
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Arrivée</Label>
            {portSelect(draft.to, (value) => setDraft({ ...draft, to: value }))}
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Période</Label>
            <div className="flex h-10 items-center gap-2 rounded-md border bg-white px-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <input
                type="date"
                value={draft.start}
                max={draft.end}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={draft.end}
                min={draft.start}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Bateau</Label>
            <Select value={draft.boatId} onValueChange={(value) => setDraft({ ...draft, boatId: value })}>
              <SelectTrigger className="bg-white">
                <span className="flex items-center gap-2">
                  <Ship className="h-4 w-4 text-primary" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les bateaux</SelectItem>
                {boat.map((item) => (
                  <SelectItem key={String(item.id)} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Capitaine</Label>
            <Select value={draft.captain} onValueChange={(value) => setDraft({ ...draft, captain: value })}>
              <SelectTrigger className="bg-white">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les capitaines</SelectItem>
                {captains.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="h-10 bg-blue-600 px-6 hover:bg-blue-700" onClick={() => setApplied(draft)}>
            <Search className="mr-2 h-4 w-4" /> Rechercher
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 text-white">
                <CalendarClock className="h-5 w-5" />
              </span>
              <span>
                Réservations par disponibilité
                <span className="block text-xs font-normal text-muted-foreground">
                  Les voyages disponibles sont filtrés automatiquement selon les bateaux et les capacités.
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTrips.slice(0, 4).map((item) => {
                const current = boatById.get(String(item.boatId));
                const image = readFirst(current, ["image", "photo", "imageUrl", "picture"]);
                const places = placesLeft(item);
                return (
                  <div key={String(item.id)} className="flex gap-3 rounded-lg border bg-card p-3 shadow-sm">
                    {image ? (
                      <img
                        src={image}
                        alt={current?.name ?? "Bateau"}
                        className="h-24 w-32 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <ShipIllustration />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 font-semibold">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-4 w-4 shrink-0 text-primary" /> {item.from} → {item.to}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                        <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(item.depart)}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Anchor className="h-3.5 w-3.5" /> Bateau : {current?.name ?? "Non disponible"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge
                          className={
                            places > 0
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-red-100 text-red-700 hover:bg-red-100"
                          }
                        >
                          {places > 0 ? "Places disponibles" : "Complet"}
                        </Badge>
                        <span className="rounded-md bg-blue-900 px-2 py-1 text-xs font-semibold text-white">
                          {places}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredTrips.length === 0 && (
                <p className="text-sm text-muted-foreground md:col-span-2">
                  Aucun voyage disponible pour ces critères.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-900 text-white">
                  <Ship className="h-4 w-4" />
                </span>
                Aperçu rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <StatBox
                value={filteredTrips.length}
                label="Trajets disponibles"
                box="bg-sky-50"
                circle="bg-sky-400"
                valueColor="text-sky-600"
                icon={<Ship className="h-5 w-5" />}
              />
              <StatBox
                value={reservationDays}
                label="Jours de réservation"
                box="bg-green-50"
                circle="bg-green-500"
                valueColor="text-green-600"
                icon={<CalendarDays className="h-5 w-5" />}
              />
              <StatBox
                value={totalPlaces}
                label="Places disponibles (total)"
                box="bg-purple-50"
                circle="bg-purple-500"
                valueColor="text-purple-600"
                icon={<Users className="h-5 w-5" />}
              />
              <StatBox
                value={activeBoats}
                label="Bateau actif"
                box="bg-orange-50"
                circle="bg-orange-400"
                valueColor="text-orange-600"
                icon={<Anchor className="h-5 w-5" />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5 text-blue-900" /> Prochains départs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredTrips.slice(0, 4).map((item) => (
                <div key={String(item.id)} className="grid grid-cols-[1.5fr_1fr_auto] items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> {item.from} → {item.to}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(item.depart)}</span>
                  <span className="text-primary">{capitalize(boatById.get(String(item.boatId))?.name ?? "—")}</span>
                </div>
              ))}
              {filteredTrips.length === 0 && <p className="text-xs text-muted-foreground">Aucun départ prévu.</p>}
            </CardContent>
          </Card>

          <Card className="bg-blue-50/60">
            <CardContent className="relative flex items-center justify-between gap-3 p-4">
              <Badge className="absolute right-4 top-3 bg-green-100 text-green-700 hover:bg-green-100">Groq</Badge>
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-5 w-5 text-blue-900" /> Assistant IA – Disponibilité
                </p>
                <p className="max-w-[230px] text-xs text-muted-foreground">
                  Posez une question sur la disponibilité des bateaux, les itinéraires ou les places restantes.
                </p>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onOpenAssistant}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Discuter avec l’assistant
                </Button>
              </div>
              <RobotIllustration />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  value,
  label,
  box,
  circle,
  valueColor,
  icon,
}: {
  value: number;
  label: string;
  box: string;
  circle: string;
  valueColor: string;
  icon: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 ${box}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${circle}`}>
        {icon}
      </span>
      <div>
        <p className={`text-xl font-bold leading-none ${valueColor}`}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Illustration utilisée quand le bateau n'a pas de photo
function ShipIllustration({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 128 96"
      className={`shrink-0 rounded-md ${small ? "h-16 w-20" : "h-24 w-32"}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ship-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f9bf0" />
          <stop offset="1" stopColor="#c4e6fb" />
        </linearGradient>
      </defs>
      <rect width="128" height="96" fill="url(#ship-sky)" />
      <ellipse cx="28" cy="20" rx="16" ry="6" fill="#fff" opacity="0.85" />
      <ellipse cx="98" cy="13" rx="14" ry="5" fill="#fff" opacity="0.75" />
      <rect y="64" width="128" height="32" fill="#1b6fd0" />
      <path d="M0 72 Q16 66 32 72 T64 72 T96 72 T128 72 V96 H0Z" fill="#2f86e8" />
      <path d="M14 56 H114 L104 72 H26Z" fill="#1e3a8a" />
      <rect x="16" y="52" width="96" height="5" fill="#ef4444" />
      <rect x="28" y="40" width="68" height="12" fill="#ffffff" />
      <rect x="38" y="30" width="48" height="10" fill="#f1f5f9" />
      <rect x="52" y="22" width="22" height="8" fill="#ffffff" />
      <rect x="60" y="13" width="6" height="9" fill="#1e3a8a" />
      <g fill="#1e3a8a" opacity="0.8">
        <rect x="34" y="44" width="6" height="4" />
        <rect x="46" y="44" width="6" height="4" />
        <rect x="58" y="44" width="6" height="4" />
        <rect x="70" y="44" width="6" height="4" />
        <rect x="82" y="44" width="6" height="4" />
      </g>
    </svg>
  );
}

function RobotIllustration() {
  return (
    <svg viewBox="0 0 80 96" className="h-24 w-20 shrink-0" aria-hidden="true">
      <line x1="40" y1="6" x2="40" y2="16" stroke="#1d4ed8" strokeWidth="3" />
      <circle cx="40" cy="5" r="4" fill="#3b82f6" />
      <rect x="14" y="16" width="52" height="36" rx="14" fill="#e0f2fe" stroke="#1d4ed8" strokeWidth="3" />
      <rect x="22" y="26" width="36" height="16" rx="8" fill="#1e3a8a" />
      <circle cx="32" cy="34" r="3.5" fill="#38bdf8" />
      <circle cx="48" cy="34" r="3.5" fill="#38bdf8" />
      <rect x="20" y="56" width="40" height="28" rx="10" fill="#e0f2fe" stroke="#1d4ed8" strokeWidth="3" />
      <circle cx="40" cy="70" r="5" fill="#3b82f6" />
      <rect x="6" y="60" width="10" height="18" rx="5" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="2" />
      <rect x="64" y="60" width="10" height="18" rx="5" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="2" />
    </svg>
  );
}

/* =========================
   Onglets Récurrente / Groupe / Prédictive / Multimodale
========================= */

function PanelTitle({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-blue-900">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function FieldBox({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-blue-50/50 px-3 py-2">
      <p className="text-xs text-blue-700">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-blue-700">{icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

const bareTrigger = "h-8 border-0 bg-transparent p-0 shadow-none focus:ring-0";

function RecurrentPanel({ onPlan }: { onPlan: (resume: string) => void }) {
  const [frequency, setFrequency] = useState("hebdomadaire");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("2 heures");
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <PanelTitle icon={<RefreshCcw className="h-6 w-6" />} title="Réservation récurrente" />
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <FieldBox icon={<CalendarDays className="h-4 w-4" />} label="Fréquence">
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className={bareTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quotidienne">Quotidienne</SelectItem>
                <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                <SelectItem value="mensuelle">Mensuelle</SelectItem>
              </SelectContent>
            </Select>
          </FieldBox>
          <FieldBox icon={<Clock className="h-4 w-4" />} label="Heure">
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="h-8 w-full bg-transparent text-sm outline-none"
            />
          </FieldBox>
          <FieldBox icon={<Clock className="h-4 w-4" />} label="Durée">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className={bareTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1 heure">1 heure</SelectItem>
                <SelectItem value="2 heures">2 heures</SelectItem>
                <SelectItem value="1 jour">1 jour</SelectItem>
              </SelectContent>
            </Select>
          </FieldBox>
          <Button
            className="h-full min-h-12 bg-blue-700 hover:bg-blue-800"
            onClick={() => onPlan(`${frequency}, ${time}, ${duration}`)}
          >
            <CalendarClock className="mr-2 h-4 w-4" /> Planifier la réservation récurrente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const PASSENGER_OPTIONS = Array.from({ length: 20 }, (_, index) => String(index + 1));
const CARGO_OPTIONS = ["1", "2", "5", "10", "12", "20", "50"];
const DURATION_OPTIONS = ["1 heure", "2 heures", "3 heures", "6 heures", "1 jour"];

function GroupPanel({ onCreate }: { onCreate: (resume: string) => void }) {
  const [passengers, setPassengers] = useState("5");
  const [cargo, setCargo] = useState("12");
  const [duration, setDuration] = useState("2 heures");
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <PanelTitle
          icon={<Users className="h-6 w-6" />}
          title="Réservation de groupe"
          subtitle="Gérez vos réservations par groupe et optimisez vos trajets."
          action={
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              onClick={() => onCreate(`${passengers} passagers, ${cargo} colis, ${duration}`)}
            >
              <Plus className="mr-2 h-4 w-4" /> Créer une réservation de groupe
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-3">
          <FieldBox icon={<User className="h-4 w-4" />} label="Nombre de passagers">
            <Select value={passengers} onValueChange={setPassengers}>
              <SelectTrigger className={bareTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PASSENGER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBox>
          <FieldBox icon={<Package className="h-4 w-4" />} label="Quantité de colis">
            <Select value={cargo} onValueChange={setCargo}>
              <SelectTrigger className={bareTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARGO_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBox>
          <FieldBox icon={<Clock className="h-4 w-4" />} label="Durée du voyage">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className={bareTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBox>
        </div>
      </CardContent>
    </Card>
  );
}

function PredictivePanel({
  reservation,
  topRoute,
  onNew,
  onDetails,
}: {
  reservation?: ReservationRecord;
  topRoute: string;
  onNew: () => void;
  onDetails: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardContent className="space-y-4 p-5">
          <PanelTitle icon={<TrendingUp className="h-6 w-6" />} title="Prévisions de réservation" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-sky-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm font-medium text-blue-900">Période recommandée</p>
              <p className="text-xl font-bold text-blue-900">12 au 18 octobre</p>
              <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-100">+ 35 % de demandes</Badge>
            </div>
            <div className="rounded-xl border bg-sky-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Users className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm font-medium text-blue-900">Demande future</p>
              <p className="text-xl font-bold text-blue-900">Plus de 80 %</p>
              <p className="text-xs text-muted-foreground">de demandes pour le week-end</p>
            </div>
            <div className="rounded-xl border bg-amber-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-white">
                <Lightbulb className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm font-medium text-blue-900">Conseil IA</p>
              <p className="text-xs text-muted-foreground">
                {topRoute
                  ? `Augmenter la capacité sur l’axe ${topRoute}`
                  : "Aucun axe prioritaire pour le moment."}
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={onDetails}>
                Voir les détails
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <PanelTitle icon={<Bot className="h-6 w-6" />} title="Contexte actif" />
          {reservation ? (
            <div className="space-y-1 rounded-lg bg-blue-50/60 p-3 text-sm">
              <p className="font-semibold text-blue-900">{reservation.clientName}</p>
              <p className="text-muted-foreground">
                {reservation.departure} → {reservation.destination}
              </p>
              <StatusBadge status={reservation.status} />
            </div>
          ) : (
            <div className="rounded-lg bg-blue-50/60 p-3 text-sm">
              <p className="font-semibold text-blue-900">Aucune réservation en cours</p>
              <p className="text-muted-foreground">
                Configurez une réservation ou consultez les disponibilités.
              </p>
            </div>
          )}
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={onNew}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle réservation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MultimodalPanel({ reservation }: { reservation?: ReservationRecord }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-900">Interface multimodale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <MessageCircle className="text-primary" />
            <div>
              <p className="font-medium">Chat IA</p>
              <p className="text-sm text-muted-foreground">Posez une question au voyageur.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Volume2 className="text-primary" />
            <div>
              <p className="font-medium">Voix IA</p>
              <p className="text-sm text-muted-foreground">Annonce automatique de la réservation.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <MapPin className="text-primary" />
            <div>
              <p className="font-medium">Carte & localisation</p>
              <p className="text-sm text-muted-foreground">Itinéraire et position du bateau.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-900">Contexte actif</CardTitle>
        </CardHeader>
        <CardContent>
          {reservation ? (
            <div className="space-y-3 text-sm">
              <p>
                <strong>Client :</strong> {reservation.clientName}
              </p>
              <p>
                <strong>Itinéraire :</strong> {reservation.departure} → {reservation.destination}
              </p>
              <p>
                <strong>Statut :</strong> {reservation.status}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Confirmez une réservation pour activer le contexte multimodal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}