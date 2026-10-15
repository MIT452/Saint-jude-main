import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useSelector } from "react-redux";
import {
  Anchor,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  MapPin,
  Mail,
  Minus,
  Package,
  Phone,
  Plus,
  Send,
  Ship,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { RootState } from "../redux";
import type { ReservationRecord } from "../services/reservationService";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface PassengerReservationProps {
  onAdd: (reservation: ReservationRecord) => Promise<void>;
  onClose?: () => void;
  /** Voyageurs en attente (carte « Voyageurs »). */
  pendingPassengers?: number;
}

const NOTES_MAX = 500;

const todayIso = () => new Date().toISOString().slice(0, 10);

const makeInitialForm = () => ({
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  departure: "",
  destination: "",
  date: todayIso(),
  time: "",
  boatId: "",
  passengers: 1,
  cargoType: "none",
  notes: "",
  unitPrice: 0,
  communication: "whatsapp" as "whatsapp" | "email" | "both" | "none",
});

const CARGO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "none", label: "Aucune (passagers)" },
  { value: "Marchandise générale", label: "Marchandise générale" },
  { value: "Fragile", label: "Fragile" },
  { value: "Agricole", label: "Agricole" },
];

const STEPS = ["Informations", "Vérification", "Confirmation"] as const;

/* =========================================================
   Petits composants d'affichage
========================================================= */
function Field({
  label,
  required,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-[10px] font-normal text-slate-400">(optionnel)</span>}
      </label>
      {children}
    </div>
  );
}

function IconInput({
  icon: Icon,
  className = "",
  ...props
}: { icon: typeof User } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700" />
      <Input {...props} className={`h-11 border-slate-200 bg-white pl-10 text-sm ${className}`} />
    </div>
  );
}

function SectionBar({ icon: Icon, title }: { icon: typeof User; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50/70 px-5 py-3">
      <Icon className="h-6 w-6 text-blue-800" />
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

function StatCard({
  tone,
  icon: Icon,
  title,
  value,
  unit,
  sub,
}: {
  tone: "blue" | "green" | "purple" | "sky";
  icon: typeof Ship;
  title: string;
  value: string | number;
  unit?: string;
  sub?: string;
}) {
  const tones = {
    blue: { card: "border-blue-200 bg-blue-50/60", icon: "bg-blue-700 text-white", title: "text-blue-800" },
    green: { card: "border-emerald-200 bg-emerald-50/60", icon: "bg-emerald-500 text-white", title: "text-emerald-700" },
    purple: { card: "border-purple-200 bg-purple-50/60", icon: "bg-purple-600 text-white", title: "text-purple-700" },
    sky: { card: "border-sky-200 bg-sky-50/60", icon: "bg-sky-100 text-sky-700", title: "text-sky-700" },
  }[tone];
  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm ${tones.card}`}>
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tones.icon}`}>
        <Icon className="h-7 w-7" />
      </span>
      <div>
        <p className={`text-sm font-semibold ${tones.title}`}>{title}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/* =========================================================
   Composant
========================================================= */
export default function PassengerReservation({
  onAdd,
  onClose,
  pendingPassengers = 0,
}: PassengerReservationProps) {
  const { boat, trip } = useSelector((state: RootState) => state.stJude);
  const [form, setForm] = useState(makeInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step] = useState(1);
  const [now, setNow] = useState(() => new Date());

  // Horloge en direct (carte « Heure actuelle »)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(timer);
  }, []);

  // Ports proposés : ceux des trajets connus
  const ports = useMemo(() => {
    const set = new Set<string>();
    (trip ?? []).forEach((t) => {
      if (t.from) set.add(String(t.from));
      if (t.to) set.add(String(t.to));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [trip]);

  const tripsToday = useMemo(() => {
    const today = new Date().toDateString();
    return (trip ?? []).filter((t) => new Date(t.depart).toDateString() === today).length;
  }, [trip]);

  const totalPrice = form.unitPrice * form.passengers;

  const update = <K extends keyof ReturnType<typeof makeInitialForm>>(
    key: K,
    value: ReturnType<typeof makeInitialForm>[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const reset = () => {
    setForm(makeInitialForm());
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.clientName.trim() || !form.clientPhone.trim() || !form.departure || !form.destination || !form.date) {
      setError("Complétez le client, les trajets et la date avant de confirmer.");
      return;
    }
    if (form.departure === form.destination) {
      setError("Le port de départ et la destination doivent être différents.");
      return;
    }

    setIsSubmitting(true);
    try {
      const hasCargo = form.cargoType !== "none";
      const reservation: ReservationRecord = {
        id: crypto.randomUUID(),
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        clientEmail: form.clientEmail.trim(),
        departure: form.departure.trim(),
        destination: form.destination.trim(),
        date: form.time ? `${form.date}T${form.time}` : form.date,
        boatId: form.boatId,
        boatName: boat.find((item) => item.id === form.boatId)?.name ?? "Bateau non sélectionné",
        passengers: Number(form.passengers),
        cargo: form.notes.trim(),
        cargoType: hasCargo ? form.cargoType : "Aucune",
        unitWeightKg: 0,
        totalWeightKg: 0,
        unitPrice: Number(form.unitPrice),
        totalPrice: Number(totalPrice),
        communication: form.communication,
        status: "En attente de confirmation",
        createdAt: new Date().toISOString(),
        source: "site-web",
      };

      await onAdd(reservation);
      reset();
      onClose?.();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "La réservation n’a pas pu être enregistrée.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clock = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête de page + étapes */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl text-blue-900">
            <CalendarDays className="h-12 w-12" strokeWidth={1.6} />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-blue-950">Réservation de voyage</h2>
            <p className="text-sm text-blue-700">Planifiez et réservez votre trajet en toute simplicité</p>
          </div>
        </div>
        <ol className="flex items-center gap-5 rounded-xl bg-blue-50/60 px-4 py-2.5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    active ? "bg-blue-700 text-white" : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {n}
                </span>
                <span className={`text-sm ${active ? "font-semibold text-blue-900" : "text-slate-400"}`}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <Card className="rounded-2xl border-blue-100 shadow-sm">
        <CardContent className="space-y-5 p-4">
          {/* Cartes de statistiques */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard tone="blue" icon={Ship} title="Tous les bateaux" value={boat.length} unit="bateaux disponibles" />
            <StatCard tone="green" icon={CalendarDays} title="Trajets disponibles" value={tripsToday || (trip ?? []).length} unit="aujourd’hui" />
            <StatCard tone="purple" icon={UserRound} title="Voyageurs" value={pendingPassengers} unit="en attente" />
            <StatCard tone="sky" icon={Clock} title="Heure actuelle" value={clock} sub={dateLabel} />
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Informations du client */}
            <section className="overflow-hidden rounded-xl border border-blue-100 bg-white">
              <SectionBar icon={Users} title="Informations du client" />
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1.2fr_1fr_1fr]">
                <Field label="Nom complet" required htmlFor="clientName">
                  <IconInput
                    icon={User}
                    id="clientName"
                    value={form.clientName}
                    onChange={(e) => update("clientName", e.target.value)}
                    placeholder="Ex. : Randriatsara Jean"
                  />
                </Field>
                <Field label="Téléphone" required htmlFor="clientPhone">
                  <IconInput
                    icon={Phone}
                    id="clientPhone"
                    type="tel"
                    value={form.clientPhone}
                    onChange={(e) => update("clientPhone", e.target.value)}
                    placeholder="Ex. : 032 12 345 67"
                  />
                </Field>
                <Field label="E-mail" htmlFor="clientEmail">
                  <IconInput
                    icon={Mail}
                    id="clientEmail"
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => update("clientEmail", e.target.value)}
                    placeholder="Ex. : client@example.com"
                  />
                </Field>
                <Field label="Nombre de passagers" required>
                  <div className="flex h-11 items-center justify-between rounded-lg border border-slate-200 bg-blue-50/60 px-1">
                    <button
                      type="button"
                      aria-label="Moins de passagers"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-blue-800 transition hover:bg-blue-100 disabled:opacity-40"
                      disabled={form.passengers <= 1}
                      onClick={() => update("passengers", Math.max(1, form.passengers - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold">{form.passengers}</span>
                    <button
                      type="button"
                      aria-label="Plus de passagers"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-blue-800 transition hover:bg-blue-100"
                      onClick={() => update("passengers", form.passengers + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </Field>
                <Field label="Marchandise">
                  <Select value={form.cargoType} onValueChange={(v) => update("cargoType", v)}>
                    <SelectTrigger className="h-11 border-slate-200 bg-white text-sm">
                      <Package className="mr-2 h-4 w-4 text-blue-700" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            {/* Détails du voyage */}
            <section className="overflow-hidden rounded-xl border border-blue-100 bg-white">
              <SectionBar icon={Ship} title="Détails du voyage" />
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Départ" required>
                  <Select value={form.departure} onValueChange={(v) => update("departure", v)}>
                    <SelectTrigger className="h-11 border-slate-200 bg-white text-sm">
                      <MapPin className="mr-2 h-4 w-4 text-blue-700" />
                      <SelectValue placeholder="Choisir le port de départ" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Destination" required>
                  <Select value={form.destination} onValueChange={(v) => update("destination", v)}>
                    <SelectTrigger className="h-11 border-slate-200 bg-white text-sm">
                      <MapPin className="mr-2 h-4 w-4 text-blue-700" />
                      <SelectValue placeholder="Choisir le port d’arrivée" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date du voyage" required htmlFor="date">
                  <Input
                    id="date"
                    type="date"
                    min={todayIso()}
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    className="h-11 border-slate-200 bg-white text-sm"
                  />
                </Field>
                <Field label="Heure de départ" optional htmlFor="time">
                  <Input
                    id="time"
                    type="time"
                    value={form.time}
                    onChange={(e) => update("time", e.target.value)}
                    className="h-11 border-slate-200 bg-white text-sm"
                  />
                </Field>

                <Field label="Bateau" required>
                  <Select value={form.boatId} onValueChange={(v) => update("boatId", v)}>
                    <SelectTrigger className="h-11 border-slate-200 bg-white text-sm">
                      <Anchor className="mr-2 h-4 w-4 text-blue-700" />
                      <SelectValue placeholder="Choisir un bateau" />
                    </SelectTrigger>
                    <SelectContent>
                      {boat.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {item.capacity} places
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Prix unitaire (Ar)" htmlFor="unitPrice">
                  <IconInput
                    icon={Coins}
                    id="unitPrice"
                    type="number"
                    min="0"
                    value={form.unitPrice || ""}
                    onChange={(e) => update("unitPrice", Number(e.target.value))}
                    placeholder="0"
                    className="bg-blue-50/60"
                  />
                </Field>
                <Field label="Prix total (Ar)" htmlFor="totalPrice">
                  <IconInput
                    icon={Coins}
                    id="totalPrice"
                    value={totalPrice ? totalPrice.toLocaleString("fr-FR") : ""}
                    readOnly
                    placeholder="0"
                    className="bg-blue-50/60"
                  />
                </Field>
              </div>

              {/* Informations complémentaires */}
              <div className="border-t border-blue-100 bg-blue-50/40 p-5">
                <Field label="Informations complémentaires" htmlFor="notes">
                  <div className="relative">
                    <FileText className="pointer-events-none absolute -left-8 top-0 h-5 w-5 text-blue-800" />
                    <textarea
                      id="notes"
                      rows={3}
                      maxLength={NOTES_MAX}
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Ajouter des notes (ex. : besoins particuliers, contact à bord, etc.)..."
                      className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 pb-7 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                      {form.notes.length}/{NOTES_MAX}
                    </span>
                  </div>
                </Field>
              </div>
            </section>

            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 gap-2 rounded-lg border-slate-200 px-6 font-medium"
                onClick={reset}
              >
                <X className="h-4 w-4 text-blue-800" /> Réinitialiser
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 gap-2 rounded-lg bg-blue-700 px-7 font-semibold text-white shadow-md hover:bg-blue-800"
              >
                {isSubmitting ? (
                  "Ajout en cours…"
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Ajouter la réservation
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* garde l'import utilisé si le composant est étendu */}
      <span className="hidden">
        <CheckCircle2 />
      </span>
    </div>
  );
}