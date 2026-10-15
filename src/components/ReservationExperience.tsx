import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import {
  Anchor,
  BellRing,
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
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

// Date au format yyyy-mm-dd pour les champs <input type="date">
const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  const date = parsed.toLocaleDateString("fr-FR");
  const time = parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
};

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
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Tableau des réservations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b p-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un client ou un voyage"
              className="max-w-md"
            />
            <span className="text-sm text-muted-foreground">{visibleReservations.length} réservation(s)</span>
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
                      <p className="font-medium">{reservation.clientName}</p>
                      <p className="text-xs text-muted-foreground">{reservation.clientPhone}</p>
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
                        Voir
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
  const today = new Date();
  const defaultFilters: AvailabilityFilters = {
    from: ALL,
    to: ALL,
    start: toInputDate(today),
    end: toInputDate(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)),
    boatId: ALL,
    captain: ALL,
  };

  // draft = valeurs en cours de saisie ; applied = valeurs appliquées par « Rechercher »
  const [draft, setDraft] = useState<AvailabilityFilters>(defaultFilters);
  const [applied, setApplied] = useState<AvailabilityFilters>(defaultFilters);

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

  // Places restantes = capacité du bateau - passagers des réservations non annulées sur le même trajet
  const placesLeft = (item: Trip) => {
    const current = boatById.get(String(item.boatId));
    if (!current) return 0;
    const taken = reservations
      .filter(
        (r) => r.departure === item.from && r.destination === item.to && !estAnnulee(r.status)
      )
      .reduce((sum, r) => sum + (Number(r.passengers) || 0), 0);
    return Math.max(0, current.capacity - taken);
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
      (new Date(applied.end).getTime() - new Date(applied.start).getTime()) / (24 * 60 * 60 * 1000)
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
              <SelectTrigger>
                <MapPin className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
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
              <SelectTrigger>
                <MapPin className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
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
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <Input
                type="date"
                value={draft.start}
                max={draft.end}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={draft.end}
                min={draft.start}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Bateau</Label>
            <Select value={draft.boatId} onValueChange={(value) => setDraft({ ...draft, boatId: value })}>
              <SelectTrigger>
                <Ship className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
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
              <SelectTrigger>
                <User className="mr-2 h-4 w-4 text-primary" />
                <SelectValue />
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

          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setApplied(draft)}>
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
                        className="h-24 w-32 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-32 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-blue-700 text-white">
                        <Ship className="h-8 w-8" />
                      </div>
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
                <Ship className="h-4 w-4 text-primary" /> Aperçu rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <StatBox
                value={filteredTrips.length}
                label="Trajets disponibles"
                tone="bg-sky-50 text-sky-600"
                icon={<Ship className="h-5 w-5" />}
              />
              <StatBox
                value={reservationDays}
                label="Jours de réservation"
                tone="bg-green-50 text-green-600"
                icon={<CalendarDays className="h-5 w-5" />}
              />
              <StatBox
                value={totalPlaces}
                label="Places disponibles (total)"
                tone="bg-purple-50 text-purple-600"
                icon={<Users className="h-5 w-5" />}
              />
              <StatBox
                value={activeBoats}
                label="Bateau actif"
                tone="bg-orange-50 text-orange-600"
                icon={<Anchor className="h-5 w-5" />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary" /> Prochains départs
              </CardTitle>
              <span className="text-sm text-primary">Voir tous</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredTrips.slice(0, 4).map((item) => (
                <div key={String(item.id)} className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> {item.from} → {item.to}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(item.depart)}</span>
                  <span className="text-primary">{boatById.get(String(item.boatId))?.name ?? "—"}</span>
                </div>
              ))}
              {filteredTrips.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun départ prévu.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50/60">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 text-primary" /> Assistant IA – Disponibilité
                </p>
                <p className="text-xs text-muted-foreground">
                  Posez une question sur la disponibilité des bateaux, les itinéraires ou les places restantes.
                </p>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onOpenAssistant}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Discuter avec l’assistant
                </Button>
              </div>
              <Bot className="h-14 w-14 shrink-0 text-primary" />
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
  tone,
  icon,
}: {
  value: number;
  label: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 ${tone}`}>
      {icon}
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
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