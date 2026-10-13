import { useState, type FormEvent } from "react";
import { useSelector } from "react-redux";
import { CheckCircle2, Ship, UserRound } from "lucide-react";
import type { RootState } from "../redux";
import type { ReservationRecord } from "../services/reservationService";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

export interface PassengerReservationProps {
  onAdd: (reservation: ReservationRecord) => Promise<void>;
  onClose?: () => void;
}

const initialForm = {
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  departure: "",
  destination: "",
  date: "",
  boatId: "",
  passengers: 1,
  cargo: "",
  cargoType: "Marchandise générale",
  unitWeightKg: 0,
  totalWeightKg: 0,
  unitPrice: 0,
  totalPrice: 0,
  communication: "whatsapp" as "whatsapp" | "email" | "both" | "none",
};

export default function PassengerReservation({ onAdd, onClose }: PassengerReservationProps) {
  const { boat } = useSelector((state: RootState) => state.stJude);
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.clientName || !form.clientPhone || !form.departure || !form.destination || !form.date) {
      setError("Complétez le client, les trajets et la date avant de confirmer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const reservation: ReservationRecord = {
        id: crypto.randomUUID(),
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        clientEmail: form.clientEmail.trim(),
        departure: form.departure.trim(),
        destination: form.destination.trim(),
        date: form.date,
        boatId: form.boatId,
        boatName: boat.find((item) => item.id === form.boatId)?.name ?? "Bateau non sélectionné",
        passengers: Number(form.passengers),
        cargo: form.cargo.trim(),
        cargoType: form.cargoType,
        unitWeightKg: Number(form.unitWeightKg),
        totalWeightKg: Number(form.totalWeightKg),
        unitPrice: Number(form.unitPrice),
        totalPrice: Number(form.totalPrice),
        communication: form.communication,
        status: "En attente de confirmation",
        createdAt: new Date().toISOString(),
        source: "site-web",
      };

      await onAdd(reservation);
      setForm(initialForm);
      onClose?.();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "La réservation n’a pas pu être enregistrée.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Ship className="h-5 w-5 text-primary" /> Réservation classique
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="clientName">Client</Label>
                <Input id="clientName" value={form.clientName} onChange={(event) => update("clientName", event.target.value)} placeholder="Nom complet" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Téléphone</Label>
                <Input id="clientPhone" type="tel" value={form.clientPhone} onChange={(event) => update("clientPhone", event.target.value)} placeholder="Numéro de téléphone" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientEmail">E-mail</Label>
              <Input id="clientEmail" type="email" value={form.clientEmail} onChange={(event) => update("clientEmail", event.target.value)} placeholder="client@example.com" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="departure">Départ</Label>
                <Input id="departure" value={form.departure} onChange={(event) => update("departure", event.target.value)} placeholder="Ville ou port" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination">Destination</Label>
                <Input id="destination" value={form.destination} onChange={(event) => update("destination", event.target.value)} placeholder="Ville ou port" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date du voyage</Label>
              <Input id="date" type="datetime-local" value={form.date} onChange={(event) => update("date", event.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="boatId">Bateau</Label>
              <Select value={form.boatId} onValueChange={(value) => update("boatId", value)}>
                <SelectTrigger id="boatId"><SelectValue placeholder="Sélectionner un bateau" /></SelectTrigger>
                <SelectContent>
                  {boat.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.capacity} places</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="passengers">Nombre de passagers</Label>
                <Input id="passengers" type="number" min="1" value={form.passengers} onChange={(event) => update("passengers", Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo">Marchandise</Label>
                <Input id="cargo" value={form.cargo} onChange={(event) => update("cargo", event.target.value)} placeholder="Description" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="unitWeightKg">Poids unitaire (kg)</Label>
                <Input id="unitWeightKg" type="number" min="0" value={form.unitWeightKg} onChange={(event) => update("unitWeightKg", Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalWeightKg">Poids total (kg)</Label>
                <Input id="totalWeightKg" type="number" min="0" value={form.totalWeightKg} onChange={(event) => update("totalWeightKg", Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitPrice">Prix unitaire</Label>
                <Input id="unitPrice" type="number" min="0" value={form.unitPrice} onChange={(event) => update("unitPrice", Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalPrice">Prix total</Label>
                <Input id="totalPrice" type="number" min="0" value={form.totalPrice} onChange={(event) => update("totalPrice", Number(event.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="communication">Canal de notification</Label>
              <Select value={form.communication} onValueChange={(value) => update("communication", value as typeof form.communication)}>
                <SelectTrigger id="communication"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="both">WhatsApp et e-mail</SelectItem>
                  <SelectItem value="none">Aucun canal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type de marchandises</Label>
              <div className="flex flex-wrap gap-2">
                {["Marchandise générale", "Fragile", "Agricole"].map((value) => (
                  <button key={value} type="button" onClick={() => update("cargoType", value)} className={`rounded-full border px-3 py-1.5 text-sm ${form.cargoType === value ? "border-primary bg-primary text-white" : "border-border"}`}>{value}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes ou informations complémentaires</Label>
              <Textarea id="notes" value={form.cargo} onChange={(event) => update("cargo", event.target.value)} placeholder="Informations sur la cargaison" />
            </div>
            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="h-4 w-4" /> Ajoutez d’abord la réservation, puis confirmez-la.</p>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? "Ajout en cours…" : <><CheckCircle2 className="h-4 w-4" /> Ajouter</>}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
