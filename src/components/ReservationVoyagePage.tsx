import { Bot, Map, MapPin, MessageCircle, ClipboardList, Ship } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import PassengerReservation, { type PassengerReservationProps } from "./PassengerReservation";

/* =========================================================
   Données d'affichage (à remplacer par le store / l'API)
========================================================= */
interface PopularTrip {
  from: string;
  to: string;
  price: string;
  count: number;
}

interface StatusSlice {
  label: string;
  count: number;
  percent: number;
  color: string; // couleur CSS
  textClass: string;
}

export interface ReservationVoyagePageProps extends PassengerReservationProps {
  popularTrips?: PopularTrip[];
  statusSlices?: StatusSlice[];
  todayCount?: number;
  onSeeBoats?: () => void;
  onOpenAssistant?: () => void;
}

const DEFAULT_TRIPS: PopularTrip[] = [
  { from: "Antananarivo", to: "Toamasina", price: "72 000 Ar", count: 12 },
  { from: "Toamasina", to: "Antalaha", price: "48 000 Ar", count: 8 },
  { from: "Toamasina", to: "Fianarantsoa", price: "96 000 Ar", count: 15 },
  { from: "Mahajanga", to: "Antsiranana", price: "110 000 Ar", count: 20 },
];

const DEFAULT_SLICES: StatusSlice[] = [
  { label: "Confirmées", count: 5, percent: 63, color: "#10b981", textClass: "text-slate-700" },
  { label: "En attente", count: 2, percent: 25, color: "#2563eb", textClass: "text-slate-700" },
  { label: "Annulées", count: 1, percent: 12, color: "#f59e0b", textClass: "text-orange-500" },
];

/* =========================================================
   Colonne de droite
========================================================= */
function BoatsBanner({ onSeeBoats }: { onSeeBoats?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 p-5 text-white shadow-md">
      <Ship className="absolute -bottom-3 right-2 h-32 w-32 text-white/20" strokeWidth={1.2} />
      <div className="relative">
        <h3 className="text-xl font-bold">Nos bateaux</h3>
        <p className="mt-0.5 text-sm text-blue-100">Confort · Sécurité · Rapidité</p>
        <button
          type="button"
          onClick={onSeeBoats}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/70 px-3.5 py-2 text-xs font-medium transition hover:bg-white/10"
        >
          Voir tous les bateaux →
        </button>
      </div>
    </div>
  );
}

function PopularTrips({ trips }: { trips: PopularTrip[] }) {
  return (
    <Card className="rounded-2xl border-blue-100 shadow-sm">
      <CardContent className="p-4">
        <h3 className="mb-3 flex items-center gap-3 text-base font-semibold text-blue-950">
          <Map className="h-7 w-7 text-blue-800" strokeWidth={1.6} />
          Trajets populaires
        </h3>
        <ul className="divide-y text-sm">
          {trips.map((t) => (
            <li key={`${t.from}-${t.to}`} className="flex items-center gap-3 py-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-blue-700" />
              <span className="min-w-0 flex-1 truncate text-slate-800">
                {t.from} → {t.to}
              </span>
              <span className="font-medium text-slate-800">{t.price}</span>
              <span className="w-9 text-right text-xs text-slate-500">👤 {t.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatusDonut({ slices, todayCount }: { slices: StatusSlice[]; todayCount: number }) {
  // conic-gradient : chaque tranche démarre là où la précédente s'arrête
  let start = 0;
  const stops = slices
    .map((s) => {
      const from = start;
      start += s.percent;
      return `${s.color} ${from}% ${start}%`;
    })
    .join(", ");

  return (
    <Card className="rounded-2xl border-blue-100 shadow-sm">
      <CardContent className="p-4">
        <h3 className="mb-4 flex items-center gap-3 text-base font-semibold text-blue-950">
          <ClipboardList className="h-7 w-7 text-blue-800" strokeWidth={1.6} />
          Statut des réservations
        </h3>
        <div className="flex items-center gap-6">
          <div
            className="relative h-36 w-36 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
            role="img"
            aria-label="Répartition des statuts de réservation"
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
              <span className="text-2xl font-bold text-blue-950">{todayCount}</span>
              <span className="text-xs text-slate-500">aujourd’hui</span>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            {slices.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className={s.textClass}>
                  {s.label}
                  <br />
                  <span className="text-slate-500">
                    {s.count} ({s.percent}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function AssistantPromo({ onOpenAssistant }: { onOpenAssistant?: () => void }) {
  return (
    <Card className="rounded-2xl border-blue-100 shadow-sm">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Bot className="h-14 w-14 shrink-0 text-blue-800" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-blue-950">Assistant IA – Réservations</h3>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Groq
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-blue-700/80">
              Posez vos questions, vérifiez la disponibilité, obtenez des conseils et réservez plus facilement.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onOpenAssistant}
          className="mt-4 h-11 gap-2 rounded-lg bg-blue-800 px-5 font-medium text-white hover:bg-blue-900"
        >
          <MessageCircle className="h-4 w-4" /> Discuter avec l’assistant
        </Button>
      </CardContent>
    </Card>
  );
}

/* =========================================================
   Page
========================================================= */
export default function ReservationVoyagePage({
  popularTrips = DEFAULT_TRIPS,
  statusSlices = DEFAULT_SLICES,
  todayCount = 8,
  onSeeBoats,
  onOpenAssistant,
  ...formProps
}: ReservationVoyagePageProps) {
  return (
    <div className="min-h-screen bg-slate-50/60 p-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <PassengerReservation {...formProps} />
        <aside className="flex flex-col gap-5">
          <BoatsBanner onSeeBoats={onSeeBoats} />
          <PopularTrips trips={popularTrips} />
          <StatusDonut slices={statusSlices} todayCount={todayCount} />
          <AssistantPromo onOpenAssistant={onOpenAssistant} />
        </aside>
      </div>
    </div>
  );
}