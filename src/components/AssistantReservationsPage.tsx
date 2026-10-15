import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Boxes,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Ship,
  Users,
} from "lucide-react";
import type { RootState } from "../redux";
import type { ReservationRecord } from "../services/reservationService";
import { Card, CardContent } from "./ui/card";
import AssistantChat, { type AssistantChatProps } from "./AssistantChat";
// Photo par défaut des bateaux : enregistre ton image dans src/assets/boat-default.jpg
import defaultBoatImage from "../assets/boat-default.jpg";

/* =========================================================
   Types d'affichage
========================================================= */
type StatTone = "up" | "warn";

interface StatView {
  label: string;
  value: number;
  trend: number; // variation en % par rapport au mois dernier
  tone: StatTone;
  icon: typeof Ship;
}

interface BoatView {
  id: string;
  name: string;
  capacity: string;
  maintenance: boolean;
  image?: string;
}

interface TripView {
  from: string;
  to: string;
  price: string;
  count: number;
}

type LatestStatus = "En attente" | "Confirmée" | "Annulée";

interface LatestView {
  id: string;
  client: string;
  trip: string;
  date: string;
  status: LatestStatus;
}

interface PageView {
  stats: StatView[];
  pendingCount: number;
  confirmedCount: number;
  trips: TripView[];
  latest: LatestView[];
}

export interface AssistantReservationsPageProps extends AssistantChatProps {
  /**
   * Réservations réelles. Si elles ne sont pas fournies, la page affiche
   * des données de démonstration identiques à la maquette.
   */
  reservations?: ReservationRecord[];
  onSeeBoats?: () => void;
  onSeeTrips?: () => void;
  onSeeReservations?: () => void;
}

/* =========================================================
   Calculs à partir des vraies réservations
========================================================= */
const norm = (s?: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const isCancelled = (r: ReservationRecord) => norm(r.status).includes("annul");
const isPending = (r: ReservationRecord) => norm(r.status).includes("attente");
const isConfirmed = (r: ReservationRecord) =>
  norm(r.status).includes("confirm") && !isPending(r) && !isCancelled(r);
const hasCargo = (r: ReservationRecord) => !!r.cargoType && norm(r.cargoType) !== "aucune";

const monthIndex = (value?: string, offset = 0) => {
  const d = value ? new Date(value) : new Date();
  return d.getFullYear() * 12 + d.getMonth() - offset;
};

// Variation en % entre le mois courant et le mois précédent
const trendOf = (list: ReservationRecord[]) => {
  const current = monthIndex();
  const cur = list.filter((r) => monthIndex(r.createdAt ?? r.date) === current).length;
  const prev = list.filter((r) => monthIndex(r.createdAt ?? r.date) === current - 1).length;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatAr = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} Ar`;

function buildView(reservations: ReservationRecord[]): PageView {
  const pending = reservations.filter(isPending);
  const confirmed = reservations.filter(isConfirmed);
  const withCargo = reservations.filter(hasCargo);

  // Trajets populaires : regroupement départ → destination
  const groups = new Map<string, { from: string; to: string; count: number; price: number }>();
  reservations.forEach((r) => {
    const key = `${r.departure}→${r.destination}`;
    const g = groups.get(key) ?? { from: r.departure, to: r.destination, count: 0, price: 0 };
    g.count += 1;
    g.price = Number(r.unitPrice) || g.price;
    groups.set(key, g);
  });
  const trips = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((g) => ({ from: g.from, to: g.to, count: g.count, price: formatAr(g.price) }));

  const latest = [...reservations]
    .sort((a, b) => +new Date(b.createdAt ?? b.date) - +new Date(a.createdAt ?? a.date))
    .slice(0, 20)
    .map<LatestView>((r) => ({
      id: r.id,
      client: r.clientName,
      trip: `${r.departure} → ${r.destination}`,
      date: formatDate(r.date),
      status: isCancelled(r) ? "Annulée" : isPending(r) ? "En attente" : "Confirmée",
    }));

  return {
    stats: [
      { label: "Réservations totales", value: reservations.length, trend: trendOf(reservations), tone: "up", icon: Ship },
      { label: "En attente", value: pending.length, trend: trendOf(pending), tone: "warn", icon: CalendarDays },
      { label: "Confirmées", value: confirmed.length, trend: trendOf(confirmed), tone: "up", icon: CheckCircle2 },
      { label: "Total marchandises", value: withCargo.length, trend: trendOf(withCargo), tone: "up", icon: Boxes },
    ],
    pendingCount: pending.length,
    confirmedCount: confirmed.length,
    trips,
    latest,
  };
}

/* =========================================================
   Données de démonstration (identiques à la capture)
========================================================= */
const DEMO_VIEW: PageView = {
  stats: [
    { label: "Réservations totales", value: 13, trend: 8, tone: "up", icon: Ship },
    { label: "En attente", value: 11, trend: 5, tone: "warn", icon: CalendarDays },
    { label: "Confirmées", value: 2, trend: 100, tone: "up", icon: CheckCircle2 },
    { label: "Total marchandises", value: 21, trend: 12, tone: "up", icon: Boxes },
  ],
  pendingCount: 11,
  confirmedCount: 2,
  trips: [
    { from: "Antananarivo", to: "Toamasina", price: "72 000 Ar", count: 12 },
    { from: "Tamatave", to: "Antalaha", price: "48 000 Ar", count: 8 },
    { from: "Toamasina", to: "Fianarantsoa", price: "96 000 Ar", count: 15 },
    { from: "Mahajanga", to: "Antsiranana", price: "110 000 Ar", count: 20 },
  ],
  latest: [
    { id: "1", client: "Jean Rakotomalala", trip: "Toamasina → Antalaha", date: "19/04/2025", status: "En attente" },
    { id: "2", client: "Rasoarivelo", trip: "Antananarivo → Toamasina", date: "18/04/2025", status: "Confirmée" },
    { id: "3", client: "Mamy Andriamihaja", trip: "Mahajanga → Antsiranana", date: "17/04/2025", status: "En attente" },
  ],
};

const DEMO_BOATS: BoatView[] = [
  { id: "a", name: "Arcanum", capacity: "14 T", maintenance: true, image: defaultBoatImage },
  { id: "e", name: "Eric", capacity: "3 T", maintenance: false, image: defaultBoatImage },
];

/* =========================================================
   Sous-composants
========================================================= */
function StatCard({ stat }: { stat: StatView }) {
  const Icon = stat.icon;
  const negative = stat.trend < 0;
  const trendColor = negative ? "text-red-500" : stat.tone === "warn" ? "text-orange-500" : "text-emerald-600";
  const Arrow = negative ? ArrowDown : ArrowUp;
  return (
    <Card className="rounded-2xl border border-blue-100 bg-white shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
          <Icon className="h-8 w-8" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{stat.label}</p>
          <p className="text-3xl font-bold text-blue-950">{stat.value}</p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            <Arrow className={`h-3.5 w-3.5 ${trendColor}`} />
            <span className={`font-semibold ${trendColor}`}>
              {negative ? "" : "+"}
              {stat.trend}%
            </span>
          </p>
          <p className="text-xs text-slate-500">par rapport au mois dernier</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CardTitleRow({
  icon: Icon,
  title,
  link,
  onLink,
}: {
  icon: typeof Ship;
  title: string;
  link: string;
  onLink?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="flex items-center gap-3 text-base font-semibold text-blue-950">
        <Icon className="h-5 w-5 text-blue-800" />
        {title}
      </h3>
      <button type="button" onClick={onLink} className="text-xs font-medium text-blue-600 hover:underline">
        {link}
      </button>
    </div>
  );
}

type Tab = "recent" | "pending" | "confirmed";

/* =========================================================
   Page
========================================================= */
export default function AssistantReservationsPage({
  reservations,
  onSeeBoats,
  onSeeTrips,
  onSeeReservations,
  ...chatProps
}: AssistantReservationsPageProps) {
  const { boat } = useSelector((state: RootState) => state.stJude);
  const [tab, setTab] = useState<Tab>("recent");

  const demo = reservations === undefined;
  const view = useMemo(() => (demo ? DEMO_VIEW : buildView(reservations!)), [demo, reservations]);

  // Bateaux : ceux du store (état « maintenance » lu de façon tolérante)
  // URL de l'API (ex. http://localhost:5000) pour les chemins relatifs renvoyés par Flask
  const API_ORIGIN = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
  const resolveImage = (value?: string) => {
    if (!value) return defaultBoatImage;
    if (/^(https?:|data:|blob:)/.test(value)) return value;
    return `${API_ORIGIN}/${value.replace(/^\/+/, "")}`;
  };

  const boats: BoatView[] = useMemo(() => {
    if (demo) return DEMO_BOATS;
    return (boat ?? []).map((b) => {
      const raw = b as unknown as Record<string, unknown>;
      const state = String(raw.status ?? raw.etat ?? raw.state ?? "");
      return {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        capacity: `${raw.capacity ?? "-"} T`,
        maintenance: norm(state).includes("maint"),
        image: resolveImage((raw.image ?? raw.photo ?? raw.image_url) as string | undefined),
      };
    });
  }, [boat, demo]);

  const latestShown = useMemo(() => {
    const list =
      tab === "pending"
        ? view.latest.filter((r) => r.status === "En attente")
        : tab === "confirmed"
          ? view.latest.filter((r) => r.status === "Confirmée")
          : view.latest;
    return list.slice(0, 3);
  }, [tab, view.latest]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "recent", label: "Récentes" },
    { key: "pending", label: `En attente (${view.pendingCount})` },
    { key: "confirmed", label: `Confirmées (${view.confirmedCount})` },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 p-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Ligne 1 gauche : statuts du haut */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {view.stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>

        {/* Ligne 1 droite : carte Bateaux */}
        <Card className="rounded-2xl border border-blue-100 shadow-sm">
          <CardContent className="flex h-full flex-col justify-between p-5">
            <button
              type="button"
              onClick={onSeeBoats}
              className="self-end text-xs font-medium text-blue-600 hover:underline"
            >
              Voir tous
            </button>
            <div>
              <Ship className="mb-1 h-9 w-9 text-blue-800" strokeWidth={1.6} />
              <p className="text-base font-bold text-blue-950">Bateaux</p>
              <p className="mt-1 text-xs text-slate-500">par rapport au mois dernier</p>
            </div>
          </CardContent>
        </Card>

        {/* Ligne 2 gauche : chat */}
        <AssistantChat {...chatProps} />

        {/* Ligne 2 droite : bateaux disponibles, trajets populaires, dernières réservations */}
        <div className="flex flex-col gap-5">
          <Card className="rounded-2xl border border-blue-100 shadow-sm">
            <CardContent className="p-5">
              <CardTitleRow icon={Ship} title="Bateaux disponibles" link="Voir tous" onLink={onSeeBoats} />
              {boats.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Aucun bateau enregistré</p>
              ) : (
                <div className="divide-y">
                  {boats.map((b) => (
                    <div key={b.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      {b.image ? (
                        <img
                          src={b.image}
                          alt={b.name}
                          onError={(e) => {
                            // Image introuvable (chemin invalide) : on met la photo par défaut
                            const img = e.currentTarget;
                            if (img.src !== new URL(defaultBoatImage, window.location.href).href) {
                              img.src = defaultBoatImage;
                            }
                          }}
                          className="h-16 w-24 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-blue-300 text-blue-800">
                          <Ship className="h-8 w-8" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-blue-950">{b.name}</p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              b.maintenance ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${b.maintenance ? "bg-red-500" : "bg-emerald-500"}`}
                            />
                            {b.maintenance ? "En maintenance" : "Disponible"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Capacité : {b.capacity}</p>
                        <p className="text-xs text-slate-400">
                          État : {b.maintenance ? "Maintenance" : "Disponible"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-blue-100 shadow-sm">
            <CardContent className="p-5">
              <CardTitleRow icon={MapPin} title="Trajets populaires" link="Voir tous" onLink={onSeeTrips} />
              {view.trips.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Aucun trajet pour le moment</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {view.trips.map((t) => (
                    <li key={`${t.from}-${t.to}`} className="flex items-center gap-3">
                      <ArrowRight className="h-4 w-4 shrink-0 text-blue-800" />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                        {t.from} → {t.to}
                      </span>
                      <span className="font-semibold text-slate-800">{t.price}</span>
                      <span className="flex w-10 items-center justify-end gap-1 text-xs text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        {t.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-blue-100 shadow-sm">
            <CardContent className="p-5">
              <CardTitleRow
                icon={CalendarDays}
                title="Dernières réservations"
                link="Voir toutes"
                onLink={onSeeReservations}
              />
              <div className="mb-3 flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      tab === t.key
                        ? "bg-blue-700 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {latestShown.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Aucune réservation</p>
              ) : (
                <ul className="divide-y">
                  {latestShown.map((r) => {
                    const dot =
                      r.status === "Confirmée" ? "bg-emerald-500" : r.status === "Annulée" ? "bg-red-500" : "bg-orange-400";
                    const badge =
                      r.status === "Confirmée"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.status === "Annulée"
                          ? "bg-red-100 text-red-600"
                          : "bg-orange-100 text-orange-700";
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-3">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{r.client}</p>
                          <p className="truncate text-xs text-slate-500">{r.trip}</p>
                        </div>
                        <span className="text-xs text-slate-500">{r.date}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge}`}>
                          {r.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}