import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCcw,
  Send,
  Ship,
  Sparkles,
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
import AssistantChat from "./AssistantChat";
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

const formatCurrency = (value: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
}).format(value);

export default function ReservationExperience() {
  const { trip, boat } = useSelector((state: RootState) => state.stJude);
  const [activeTab, setActiveTab] = useState<Tab>("classic");
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);
  const [status, setStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<NotificationChannel>("whatsapp");
  const [isLoading, setIsLoading] = useState(false);

  const visibleReservations = useMemo(() => reservations.filter((reservation) =>
    `${reservation.clientName} ${reservation.cargo} ${reservation.destination} ${reservation.boatName}`
      .toLowerCase()
      .includes(search.toLowerCase())
  ), [reservations, search]);

  const refreshReservations = async () => {
    setIsLoading(true);
    try {
      setReservations(await getReservations());
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (reservation: ReservationRecord) => {
    const saved = await createReservation(reservation);
    setReservations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setSelectedReservation(saved);
    setStatus(`Réservation ajoutée en attente de confirmation : ${saved.clientName}.`);
  };

  const handleConfirm = async () => {
    if (!selectedReservation) return;
    const finalized = await updateReservationStatus(selectedReservation.id, "Confirmée");
    setReservations((current) => current.map((item) => item.id === finalized.id ? finalized : item));
    setSelectedReservation(finalized);

    const announcement = createReservationAnnouncement(finalized);
    const aiResult = await askAssistant({
      question: "Génère une annonce vocale de confirmation.",
      context: JSON.stringify({ reservation: finalized, announcement }),
    });

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      setVoiceStatus(`Announce vocale diffusée : ${announcement}`);
    } else {
      setVoiceStatus("La synthèse vocale n’est pas disponible dans ce navigateur.");
    }
    setStatus(`Réservation confirmée. Réponse IA : ${JSON.stringify(aiResult).slice(0, 180)}`);
  };

  const sendNotification = (reservation: ReservationRecord) => {
    const message = encodeURIComponent(
      `Bonjour ${reservation.clientName}, votre réservation pour ${reservation.departure} → ${reservation.destination} est confirmée.`
    );
    if (channel === "whatsapp" || channel === "both") {
      window.open(`https://wa.me/${reservation.clientPhone.replace(/[^0-9]/g, "")}?text=${message}`, "_blank", "noopener,noreferrer");
    }
    if (channel === "email" || channel === "both") {
      window.location.href = `mailto:${reservation.clientEmail}?subject=${encodeURIComponent("Confirmation de réservation")}&body=${message}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold">Expérience de réservation multimodale</h1>
          <p className="text-sm text-muted-foreground">Réservation, IA, voix, disponibilité, notifications et prévisions.</p>
        </div>
        <Button variant="outline" onClick={refreshReservations} disabled={isLoading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${activeTab === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "classic" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <PassengerReservation onAdd={handleAdd} />
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>État de la réservation</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {selectedReservation ? (
                  <>
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Statut</span><Badge className="bg-green-100 text-green-800">{selectedReservation.status}</Badge></div>
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Voyage</span><span className="text-right font-medium">{selectedReservation.departure} → {selectedReservation.destination}</span></div>
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Bateau</span><span className="text-right font-medium">{selectedReservation.boatName}</span></div>
                  </>
                ) : <p className="text-sm text-muted-foreground">Aucune réservation confirmée.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Notifications disponibles</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={(value) => setChannel(value as NotificationChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="both">WhatsApp et e-mail</SelectItem>
                    <SelectItem value="none">Aucun canal</SelectItem>
                  </SelectContent>
                </Select>
                {selectedReservation && (
                  <>
                    <Button variant="outline" className="w-full" onClick={handleConfirm} disabled={selectedReservation.status === "Confirmée"}><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmer réservation</Button>
                    <Button variant="ghost" className="w-full" onClick={() => sendNotification(selectedReservation)}><Send className="mr-2 h-4 w-4" /> Envoyer la confirmation</Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "assistant" && <AssistantChat reservation={selectedReservation ?? undefined} />}
      {activeTab === "availability" && <AvailabilityPanel trip={trip} boat={boat} />}
      {activeTab === "recurrent" && <RecurrentPanel />}
      {activeTab === "group" && <GroupPanel />}
      {activeTab === "predictive" && <PredictivePanel />}
      {activeTab === "multimodal" && <MultimodalPanel reservation={selectedReservation ?? undefined} />}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Tableau des réservations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b p-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un client ou un voyage" className="max-w-md" />
            <span className="text-sm text-muted-foreground">{visibleReservations.length} réservation(s)</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Marchandise</TableHead><TableHead>Caissier</TableHead><TableHead>Quantité</TableHead><TableHead>Poids unitaire (kg)</TableHead><TableHead>Poids total (kg)</TableHead><TableHead>Prix unitaire</TableHead><TableHead>Prix total</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleReservations.map((reservation) => (
                  <TableRow key={reservation.id} onClick={() => setSelectedReservation(reservation)}>
                    <TableCell><p className="font-medium">{reservation.clientName}</p><p className="text-xs text-muted-foreground">{reservation.clientPhone}</p></TableCell>
                    <TableCell>{reservation.cargoType}<br /><span className="text-xs text-muted-foreground">{reservation.cargo}</span></TableCell>
                    <TableCell>{reservation.clientName}</TableCell>
                    <TableCell>{reservation.passengers}</TableCell>
                    <TableCell>{reservation.unitWeightKg} kg</TableCell>
                    <TableCell>{reservation.totalWeightKg} kg</TableCell>
                    <TableCell>{formatCurrency(reservation.unitPrice)}</TableCell>
                    <TableCell>{formatCurrency(reservation.totalPrice)}</TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setSelectedReservation(reservation); }}>Voir</Button></TableCell>
                  </TableRow>
                ))}
                {visibleReservations.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune réservation n’est disponible.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {status && <StatusMessage icon={<CheckCircle2 className="h-5 w-5 text-primary" />} title="Confirmation automatique" text={status} />}
      {voiceStatus && <StatusMessage icon={<Volume2 className="h-5 w-5 text-primary" />} title="Message vocal IA" text={voiceStatus} />}
    </div>
  );
}

function StatusMessage({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"><div className="flex items-start gap-3">{icon}<div><p className="font-medium">{title}</p><p className="text-muted-foreground">{text}</p></div></div></div>;
}

function AvailabilityPanel({ trip, boat }: { trip: Trip[]; boat: Boat[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Réservation par disponibilité</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Les voyages disponibles sont filtrés automatiquement.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {trip.slice(0, 4).map((item) => {
            const currentBoat = boat.find((candidate) => candidate.id === item.boatId);
            return (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" /> {item.from} → {item.to}</div>
                <p className="mt-2 text-sm text-muted-foreground">{new Date(item.depart).toLocaleString("fr-FR")}</p>
                <p className="mt-1 text-sm">Bateau : {currentBoat?.name ?? "Non disponible"}</p>
                <div className="mt-3 flex justify-between"><span className="text-sm">Places disponibles</span><Badge>{currentBoat ? Math.max(0, currentBoat.capacity - 2) : 0}</Badge></div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RecurrentPanel() {
  const [frequency, setFrequency] = useState("hebdomadaire");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("2 heures");
  return <Card><CardHeader><CardTitle>Réservation récurrente</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Fréquence</Label><Select value={frequency} onValueChange={setFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quotidien">Quotidien</SelectItem><SelectItem value="hebdomadaire">Hebdomadaire</SelectItem><SelectItem value="mensuel">Mensuel</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Heure</Label><Input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div><div className="space-y-2"><Label>Durée</Label><Select value={duration} onValueChange={setDuration}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1 heure">1 heure</SelectItem><SelectItem value="2 heures">2 heures</SelectItem><SelectItem value="1 jour">1 jour</SelectItem></SelectContent></Select></div><Button className="md:col-span-3">Planifier la réservation récurrente</Button></CardContent></Card>;
}

function GroupPanel() {
  const [passengers, setPassengers] = useState(5);
  const [cargo, setCargo] = useState(12);
  return <Card><CardHeader><CardTitle>Réservation de groupe</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Nombre de passagers</Label><Input type="number" value={passengers} onChange={(event) => setPassengers(Number(event.target.value))} /></div><div className="space-y-2"><Label>Quantité de colis</Label><Input type="number" value={cargo} onChange={(event) => setCargo(Number(event.target.value))} /></div></div><div className="rounded-lg bg-muted p-4"><p className="text-sm font-medium">Quantité totale</p><p className="text-2xl font-semibold">{passengers} passagers · {cargo} colis</p></div><Button>Créer la réservation de groupe</Button></CardContent></Card>;
}

function PredictivePanel() {
  return <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Prévisions de réservation</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border p-4"><p className="font-medium">Période recommandée</p><p className="mt-1 text-sm text-muted-foreground">Semaine du 12 au 18 octobre</p></div><div className="rounded-lg border p-4"><p className="font-medium">Demande future</p><p className="mt-1 text-sm text-muted-foreground">Plus de 80 % de demandes pour le week-end.</p></div></CardContent></Card><Card><CardHeader><CardTitle>Alertes</CardTitle></CardHeader><CardContent><div className="flex gap-3 rounded-lg bg-orange-50 p-4 text-orange-700"><BellRing className="h-5 w-5 shrink-0" /><p className="text-sm">Capacité disponible : 3 places supplémentaires sur le prochain voyage.</p></div></CardContent></Card></div>;
}

function MultimodalPanel({ reservation }: { reservation?: ReservationRecord }) {
  return <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Interface multimodale</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center gap-3 rounded-lg border p-3"><MessageCircle className="text-primary" /><div><p className="font-medium">Chat IA</p><p className="text-sm text-muted-foreground">Posez une question au voyageur.</p></div></div><div className="flex items-center gap-3 rounded-lg border p-3"><Volume2 className="text-primary" /><div><p className="font-medium">Voix IA</p><p className="text-sm text-muted-foreground">Annonce automatique de la réservation.</p></div></div><div className="flex items-center gap-3 rounded-lg border p-3"><MapPin className="text-primary" /><div><p className="font-medium">Carte & localisation</p><p className="text-sm text-muted-foreground">Itinéraire et position du bateau.</p></div></div></CardContent></Card><Card><CardHeader><CardTitle>Contexte actif</CardTitle></CardHeader><CardContent>{reservation ? <div className="space-y-3 text-sm"><p><strong>Client :</strong> {reservation.clientName}</p><p><strong>Itinéraire :</strong> {reservation.departure} → {reservation.destination}</p><p><strong>Statut :</strong> {reservation.status}</p></div> : <p className="text-sm text-muted-foreground">Confirmez une réservation pour activer le contexte multimodal.</p>}</CardContent></Card></div>;
}
