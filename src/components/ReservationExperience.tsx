import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import {
  Anchor,
  BellRing,
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Eye,
  MapPin,
  MessageCircle,
  Package,
  RefreshCcw,
  Search,
  Send,
  Ship,
  Sparkles,
  User,
  Users,
  Volume2,
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

// Normalise un statut (sans accent, en minuscules) pour comparer sans risque d'écart
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

// Le nom exact du champ date dépend de ReservationRecord : on essaie les plus courants.
// Si vous connaissez le vrai nom, remplacez cette fonction par `reservation.tonChamp`.
const getReservationDate = (reservation: ReservationRecord): string => {
  const record = reservation as unknown as Record<string, unknown>;
  const raw =
    record.date ??
    record.departureDate ??
    record.departDate ??
    record.depart ??
    record.createdAt;
  if (typeof raw !== "string" && typeof raw !== "number") return "—";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("fr-FR");
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erreur inconnue";

const DAY_MS = 24 * 60 * 60 * 1000;

// Date locale au format yyyy-mm-dd pour les champs <input type="date">
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

// Champs optionnels selon vos types (image, capitaine...) : lecture sécurisée
const readField = (source: unknown, key: string): string => {
  const value = (source as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" ? value : "";
};

export default function ReservationExperience() {
  const { trip, boat } = useSelector((state: RootState) => state.stJude);
  const [activeTab, setActiveTab] = useState<Tab>("classic");
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);
  const [status, setStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<NotificationChannel>("whatsapp");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const visibleReservations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reservations.filter((reservation) =>
      `${reservation.clientName} ${reservation.clientPhone} ${reservation.cargo} ${reservation.destination} ${reservation.departure} ${reservation.boatName}`
        .toLowerCase()
        .includes(term)
    );
  }, [reservations, search]);

  // Ports connus (noms des trajets) : l'assistant les reconnaît plus sûrement
  const knownPlaces = useMemo(
    () => Array.from(new Set(trip.flatMap((item) => [item.from, item.to]).filter(Boolean))),
    [trip]
  );

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

  // Chargement automatique au premier affichage
  useEffect(() => {
    void refreshReservations();
  }, []);

  // Garde la réservation sélectionnée à jour après chaque actualisation de la liste
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

  // Appelé par l'assistant IA : la réservation est déjà enregistrée (backend + liste), on met seulement l'affichage à jour
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold">Expérience de réservation multimodale</h1>
          <p className="text-sm text-muted-foreground">
            Réservation, IA, voix, disponibilité, notifications et prévisions.
          </p>
        </div>
        <Button variant="outline" onClick={refreshReservations} disabled={isLoading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
              activeTab === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "classic" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <PassengerReservation onAdd={handleAdd} />
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>État de la réservation</CardTitle>
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
                <CardTitle>Notifications disponibles</CardTitle>
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
        </div>
      )}

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
          onOpenAssistant={() => setActiveTab("assistant")}
        />
      )}
      {activeTab === "recurrent" && <RecurrentPanel />}
      {activeTab === "group" && <GroupPanel />}
      {activeTab === "predictive" && <PredictivePanel />}
      {activeTab === "multimodal" && <MultimodalPanel reservation={selectedReservation ?? undefined} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 text-white">
              <Package className="h-5 w-5" />
            </span>
            Tableau des réservations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b p-4">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un client ou un voyage..."
                className="pl-9"
              />
            </div>
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {visibleReservations.length} réservation(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Marchandise</TableHead>
                  <TableHead>Qté</TableHead>
                  <TableHead>Poids total</TableHead>
                  <TableHead>Prix total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReservations.map((reservation) => (
                  <TableRow
                    key={reservation.id}
                    onClick={() => setSelectedReservation(reservation)}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedReservation?.id === reservation.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <User className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-medium">{reservation.clientName}</p>
                          <p className="text-xs text-muted-foreground">{reservation.clientPhone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {reservation.departure} → {reservation.destination}
                    </TableCell>
                    <TableCell>{getReservationDate(reservation)}</TableCell>
                    <TableCell>
                      {reservation.cargoType}
                      <br />
                      <span className="text-xs text-muted-foreground">{reservation.cargo}</span>
                    </TableCell>
                    <TableCell>{reservation.passengers}</TableCell>
                    <TableCell>{reservation.totalWeightKg} kg</TableCell>
                    <TableCell>{formatCurrency(Number(reservation.totalPrice) || 0)}</TableCell>
                    <TableCell>
                      <StatusBadge status={reservation.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReservation(reservation);
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" /> Voir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleReservations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Aucune réservation n’est disponible.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

function StatusBadge({ status }: { status: string }) {
  const valeur = normaliserTexte(status);

  let classes = "bg-orange-100 text-orange-800"; // En attente (par défaut)
  if (valeur.includes("confirm")) classes = "bg-green-100 text-green-800";
  else if (valeur.includes("annul") || valeur.includes("refus")) classes = "bg-red-100 text-red-800";
  else if (valeur.includes("termin")) classes = "bg-blue-100 text-blue-800";

  return <Badge className={classes}>{status}</Badge>;
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
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50"
      : "border-primary/20 bg-primary/5";
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

/* =========================
   Onglet Disponibilité
========================= */

const ALL = "all";
// Places déjà prises par défaut sur chaque voyage (comme l'ancien affichage : capacité - 2)
const PLACES_RESERVEES_PAR_DEFAUT = 2;
// Durée de la période par défaut, en jours (03/10 → 17/10 sur la maquette)
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

  // La période par défaut démarre au premier voyage (et non à aujourd'hui),
  // pour afficher les voyages dès l'ouverture comme sur la maquette.
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
        new Set(
          boat
            .map((item) => readField(item, "captain") || readField(item, "captainName"))
            .filter(Boolean)
        )
      ),
    [boat]
  );

  const boatById = useMemo(() => new Map(boat.map((item) => [String(item.id), item])), [boat]);

  // Places restantes = capacité - places par défaut - passagers des réservations non annulées sur le trajet
  const placesLeft = (item: Trip) => {
    const current = boatById.get(String(item.boatId));
    if (!current) return 0;
    const taken = reservations
      .filter(
        (r) => r.departure === item.from && r.destination === item.to && !estAnnulee(r.status)
      )
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
        const captain = current
          ? readField(current, "captain") || readField(current, "captainName")
          : "";

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

  return (
    <div className="space-y-5">
      {/* ===== Filtres ===== */}
      <Card className="bg-blue-50/60">
        <CardContent className="grid items-end gap-3 p-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1.2fr_1.2fr_auto]">
          <div className="space-y-1">
            <Label className="font-semibold">Départ</Label>
            <Select value={draft.from} onValueChange={(value) => setDraft({ ...draft, from: value })}>
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
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Arrivée</Label>
            <Select value={draft.to} onValueChange={(value) => setDraft({ ...draft, to: value })}>
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
        {/* ===== Réservations par disponibilité ===== */}
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
                const image = readField(current, "image") || readField(current, "photo");
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
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
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

        {/* ===== Colonne de droite ===== */}
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
              <span className="text-sm text-primary">Voir tous</span>
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
              {filteredTrips.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun départ prévu.</p>
              )}
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

// Illustration de bateau utilisée quand le bateau n'a pas de photo (champ image/photo)
function ShipIllustration() {
  return (
    <svg viewBox="0 0 128 96" className="h-24 w-32 shrink-0 rounded-md" aria-hidden="true">
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

function RecurrentPanel() {
  const [frequency, setFrequency] = useState("hebdomadaire");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("2 heures");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Réservation récurrente</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Fréquence</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quotidien">Quotidien</SelectItem>
              <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
              <SelectItem value="mensuel">Mensuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Heure</Label>
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Durée</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1 heure">1 heure</SelectItem>
              <SelectItem value="2 heures">2 heures</SelectItem>
              <SelectItem value="1 jour">1 jour</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="md:col-span-3">Planifier la réservation récurrente</Button>
      </CardContent>
    </Card>
  );
}

function GroupPanel() {
  const [passengers, setPassengers] = useState(5);
  const [cargo, setCargo] = useState(12);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Réservation de groupe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre de passagers</Label>
            <Input
              type="number"
              min={0}
              value={passengers}
              onChange={(event) => setPassengers(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label>Quantité de colis</Label>
            <Input
              type="number"
              min={0}
              value={cargo}
              onChange={(event) => setCargo(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
        </div>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm font-medium">Quantité totale</p>
          <p className="text-2xl font-semibold">
            {passengers} passagers · {cargo} colis
          </p>
        </div>
        <Button>Créer la réservation de groupe</Button>
      </CardContent>
    </Card>
  );
}

function PredictivePanel() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Prévisions de réservation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-medium">Période recommandée</p>
            <p className="mt-1 text-sm text-muted-foreground">Semaine du 12 au 18 octobre</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Demande future</p>
            <p className="mt-1 text-sm text-muted-foreground">Plus de 80 % de demandes pour le week-end.</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alertes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 rounded-lg bg-orange-50 p-4 text-orange-700">
            <BellRing className="h-5 w-5 shrink-0" />
            <p className="text-sm">Capacité disponible : 3 places supplémentaires sur le prochain voyage.</p>
          </div>
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
          <CardTitle>Interface multimodale</CardTitle>
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
          <CardTitle>Contexte actif</CardTitle>
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