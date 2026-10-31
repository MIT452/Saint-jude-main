import { FC, FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart, Line,
} from "recharts";
import {
  Ship, TrendingUp, TrendingDown, Wallet, CalendarDays, CreditCard, Bell, Search, Calendar, ChevronDown, UserCircle2,
  Wind, Waves, Droplets, Eye, Cloud, CloudSun, CloudRain, CloudFog, CloudLightning, Sun, AlertTriangle,
  BarChart3, Brain, Navigation, ShieldCheck, Package, Lightbulb, Download, Info, Trophy, MapPin, ArrowRight, Minus,
  CheckCircle2, ShieldAlert, Sparkles, Send, X, HelpCircle, Banknote, XCircle, Anchor,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { formatCurrency, generateRevenueDataSets } from "../Tools/Tools";
import { RevenueDataSets } from "../data/type";
import { revenueDataSetsVoid } from "../data/dataVoid";
import { askAIJson } from "../data/auditAI";

interface PropsDashboard {
  onSetToAudit: (value: string) => void;
}

type Level = "Faible" | "Moyen" | "Élevé";
type Alert = { t: string; s: string; lvl: Level; a?: string };
type Insight = { analyse: string; prevision: string; facteurs: string[]; alertes: Alert[] };
type Weather = {
  temp: number; label: string; Icon: LucideIcon; wind: string; windKmh: number; humidity: number;
  visibility: number; wave: number | null; fetchedAt: Date;
  days: { d: string; t: string; label: string; Icon: LucideIcon }[];
};
type Tab = "Demande" | "Prix" | "Recettes" | "Marchandises";
type Trend = { pct: number; unit?: "%" | "pts" };
type Why = { value: string; period: string; formula: string; source: string; factors: string[]; confidence: string };

const card = "bg-white rounded-xl border border-[#dbe5f5] shadow-sm";
const pad = (n: number) => String(n).padStart(2, "0");
const lvlStyle: Record<Level, { c: string; Icon: LucideIcon; tc: string }> = {
  Faible: { c: "bg-[#e0ecff] text-[#1255d6]", Icon: Bell, tc: "text-[#1255d6]" },
  Moyen: { c: "bg-[#fff0d9] text-[#f59e0b]", Icon: AlertTriangle, tc: "text-[#d97706]" },
  Élevé: { c: "bg-[#ffe3e3] text-[#e5342f]", Icon: AlertTriangle, tc: "text-[#e5342f]" },
};

const compact = (v: number) =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${+(v / 1_000).toFixed(1)}k` : String(v);

const GOODS_COLORS = ["#2563eb", "#f59e0b", "#22c55e", "#7c3aed", "#ef4444"];
const STATUS_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#7c3aed", "#1d6fe0", "#64748b"];
const capitalizeWords = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const fmtDateTime = (d: Date) =>
  d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Code météo Open-Meteo -> libellé + icône
const wmo = (c: number): { label: string; Icon: LucideIcon } => {
  if (c <= 1) return { label: "Ciel dégagé", Icon: Sun };
  if (c === 2) return { label: "Peu nuageux", Icon: CloudSun };
  if (c === 3) return { label: "Nuageux", Icon: Cloud };
  if (c === 45 || c === 48) return { label: "Brouillard", Icon: CloudFog };
  if (c >= 95) return { label: "Orage", Icon: CloudLightning };
  return { label: "Pluie", Icon: CloudRain };
};
const compass = (deg: number) => ["N", "NE", "E", "SE", "S", "SO", "O", "NO"][Math.round(deg / 45) % 8];

// ---------- Carte de Madagascar (contour simplifié, projection lon/lat -> SVG)
const proj = (lon: number, lat: number): [number, number] => [(lon - 43) * 20, (-lat - 11.7) * 20];
const COAST: [number, number][] = [
  [49.27, -12.0], [49.55, -12.5], [49.9, -13.1], [50.1, -13.9], [50.25, -14.6], [50.1, -15.3], [49.85, -15.7],
  [49.75, -16.4], [49.6, -17.0], [49.45, -17.6], [49.42, -18.2], [49.1, -19.0], [48.8, -19.9], [48.5, -20.8],
  [48.3, -21.5], [48.05, -22.2], [47.85, -22.9], [47.6, -23.6], [47.3, -24.4], [47.0, -25.0], [46.3, -25.3],
  [45.15, -25.6], [44.2, -25.2], [43.7, -24.4], [43.65, -23.4], [43.4, -22.4], [43.3, -21.6], [43.7, -20.9],
  [44.3, -20.2], [44.4, -19.4], [44.2, -18.6], [44.0, -18.0], [44.3, -17.2], [45.1, -16.6], [45.6, -15.9],
  [46.3, -15.7], [46.9, -15.3], [47.5, -14.8], [47.9, -14.3], [48.0, -13.6], [48.4, -13.2], [48.8, -12.7],
  [49.0, -12.2], [49.27, -11.95],
];
const MADA_PATH = COAST.map(([lo, la], i) => `${i ? "L" : "M"}${proj(lo, la).map((v) => v.toFixed(1)).join(",")}`).join(" ") + " Z";
const CITIES: { n: string; lon: number; lat: number; port?: boolean; left?: boolean }[] = [
  { n: "Antsiranana", lon: 49.29, lat: -12.28, port: true, left: true },
  { n: "Mahajanga", lon: 46.32, lat: -15.72, port: true },
  { n: "Toamasina", lon: 49.41, lat: -18.15, port: true, left: true },
  { n: "Antananarivo", lon: 47.52, lat: -18.91 },
  { n: "Morondava", lon: 44.28, lat: -20.28, port: true },
  { n: "Toliara", lon: 43.68, lat: -23.35, port: true },
  { n: "Tolagnaro", lon: 47.0, lat: -25.03, port: true, left: true },
];
const boatPos = (b: any): [number, number] | null => {
  const la = Number(b.latitude ?? b.lat);
  const lo = Number(b.longitude ?? b.lng ?? b.lon);
  return Number.isFinite(la) && Number.isFinite(lo) && lo > 42 && lo < 52 && la < -10 && la > -27 ? [lo, la] : null;
};

const boatName = (b: any) => b.name ?? b.nom ?? b.matricule ?? "Bateau";
const boatState = (b: any) => String(b.state ?? b.etat ?? b.status ?? b.statut ?? "—");
const isMaint = (b: any) => /maint/i.test(boatState(b));

// ---------- Dates tolérantes (le champ exact dépend de ton schéma Neon)
const toDate = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const movDate = (m: any) => toDate(m.date ?? m.createdAt ?? m.created_at ?? m.dateMouvement ?? m.day);
const resDate = (r: any) => toDate(r.createdAt ?? r.created_at ?? r.date ?? r.reservationDate);
const tripDate = (t: any) => toDate(t.date ?? t.departureDate ?? t.departure_date ?? t.createdAt ?? t.created_at);
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

// Série mensuelle (clé = mois) agrégée à partir de dates réelles ; null si aucune date exploitable
function monthlyTrend<T>(
  items: T[], dateFn: (x: T) => Date | null, valueFn: (x: T) => number,
): Trend | null {
  const m = new Map<number, number>();
  items.forEach((x) => {
    const d = dateFn(x);
    if (d) m.set(monthKey(d), (m.get(monthKey(d)) ?? 0) + valueFn(x));
  });
  if (!m.size) return null;
  const last = Math.max(...m.keys());
  const cur = m.get(last) ?? 0;
  const prev = m.get(last - 1) ?? 0;
  if (!prev) return null;
  return { pct: ((cur - prev) / prev) * 100 };
}

// Variation (%) entre les deux derniers points d'une série réelle
const trendOf = (arr: number[]): Trend | null => {
  if (arr.length < 2) return null;
  const prev = arr[arr.length - 2];
  const last = arr[arr.length - 1];
  if (!prev) return null;
  return { pct: ((last - prev) / prev) * 100 };
};
const fmtPct = (t: Trend) => `${t.pct > 0 ? "+" : ""}${t.pct.toFixed(1).replace(".", ",")}${t.unit === "pts" ? " pts" : "%"}`;

// Régression linéaire simple : prochain point, fiabilité (R²) et erreur moyenne (RMSE)
const linearForecast = (values: number[]): { next: number; r2: number; rmse: number } | null => {
  const n = values.length;
  if (n < 3) return null;
  const xs = values.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (values[i] - my), 0);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const ssTot = values.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = values.reduce((s, v, i) => s + (v - (intercept + slope * i)) ** 2, 0);
  const r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 1;
  return { next: Math.max(0, intercept + slope * n), r2, rmse: Math.sqrt(ssRes / n) };
};

const Empty: FC<{ text: string; h?: number }> = ({ text, h = 160 }) => (
  <div className="flex items-center justify-center text-center text-xs text-gray-500 px-4" style={{ minHeight: h }}>
    {text}
  </div>
);

const Dashboard: FC<PropsDashboard> = ({ onSetToAudit }) => {
  const [revenuePeriod, setRevenuePeriod] = useState("mensuelle");
  const [revenueDataSets, setRevenueDataSets] = useState<RevenueDataSets>(revenueDataSetsVoid);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherErr, setWeatherErr] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [tab, setTab] = useState<Tab>("Demande");
  const [selectedBoat, setSelectedBoat] = useState<number | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [loadedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  const cashMouvement = useSelector((state: RootState) => state.stJude.cashMouvement);
  const trip = useSelector((state: RootState) => state.stJude.trip);
  const reservation = useSelector((state: RootState) => state.stJude.reservation) as any[];
  const boats = useSelector((state: RootState) => ((state.stJude as any).boat ?? (state.stJude as any).boats ?? []) as any[]);
  const goods = useSelector(
    (state: RootState) =>
      ((state.stJude as any).goods ?? (state.stJude as any).goodsList ?? (state.stJude as any).marchandise ?? []) as any[],
  );
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  // Horloge en direct
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setRevenueDataSets(generateRevenueDataSets(cashMouvement));
  }, [cashMouvement]);

  // ---------- Données réelles (base Neon via le store)
  const totalCredit = cashMouvement.reduce((a, { credit }) => a + Number(credit), 0);
  const totalDebit = cashMouvement.reduce((a, { debit }) => a + Number(debit), 0);
  const solde = totalCredit - totalDebit;
  const paid = reservation.reduce((a, r) => a + Number(r.amountPaid || 0), 0);
  const unpaid = reservation.reduce((a, r) => a + Number(r.amountToPay || 0), 0);
  const payTotal = paid + unpaid;
  const payRate = payTotal ? Math.round((paid / payTotal) * 100) : null;
  const cancelled = reservation.filter((r) => r.status === "Annulée").length;
  const activeRes = reservation.length - cancelled;
  const cancelRate = reservation.length ? (cancelled / reservation.length) * 100 : null;
  const unpaidCount = reservation.filter((r) => r.status !== "Annulée" && Number(r.amountToPay) > 0).length;
  const debitOps = cashMouvement.filter((m) => Number(m.debit) > 0).length;
  const hasData = cashMouvement.length > 0 || reservation.length > 0 || trip.length > 0;

  const currentData: any[] = (revenueDataSets[revenuePeriod as keyof typeof revenueDataSets] || revenueDataSets.mensuelle) as any[];
  const revNumbers = currentData.map((d) => Number(d.revenus));
  const revTotal = revNumbers.reduce((s, v) => s + v, 0);
  const revBest = currentData.length
    ? currentData.reduce((b, d) => (b && Number(b.revenus) >= Number(d.revenus) ? b : d), null as any)
    : null;
  const hasResSeries = currentData.some((d) => d.reservations != null);
  const monthly: any[] = (revenueDataSets.mensuelle as any[]) ?? [];
  const caTrend = trendOf(monthly.map((d) => Number(d.revenus)));
  const resTrend = trendOf(monthly.map((d) => Number(d.reservations || 0)));

  // Tendances réelles calculées à partir des dates des tables (null si le champ date n'existe pas)
  const debitTrend = useMemo(() => monthlyTrend(cashMouvement as any[], movDate, (m) => Number(m.debit || 0)), [cashMouvement]);
  const tripTrend = useMemo(() => monthlyTrend(trip as any[], tripDate, () => 1), [trip]);
  const payTrend = useMemo<Trend | null>(() => {
    const by = new Map<number, { p: number; t: number }>();
    reservation.forEach((r) => {
      const d = resDate(r);
      if (!d || r.status === "Annulée") return;
      const k = monthKey(d);
      const v = by.get(k) ?? { p: 0, t: 0 };
      v.p += Number(r.amountPaid || 0);
      v.t += Number(r.amountPaid || 0) + Number(r.amountToPay || 0);
      by.set(k, v);
    });
    if (!by.size) return null;
    const last = Math.max(...by.keys());
    const c = by.get(last), p = by.get(last - 1);
    if (!c || !p || !c.t || !p.t) return null;
    return { pct: (c.p / c.t) * 100 - (p.p / p.t) * 100, unit: "pts" };
  }, [reservation]);

  // Prévision des recettes (régression linéaire sur la série réelle)
  const revForecast = useMemo(() => linearForecast(revNumbers), [revNumbers.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const revChartData = useMemo(() => {
    const data: any[] = currentData.map((d, i) => ({
      periode: d.periode, reel: revNumbers[i],
      prevision: revForecast && i === revNumbers.length - 1 ? revNumbers[i] : undefined,
    }));
    if (revForecast) data.push({ periode: "Prévision", prevision: Number(revForecast.next.toFixed(1)) });
    return data;
  }, [revNumbers.join(","), revenuePeriod, revForecast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prévision de la demande (réservations)
  const resNumbers = currentData.map((d) => Number(d.reservations || 0));
  const resForecast = useMemo(() => (hasResSeries ? linearForecast(resNumbers) : null), [resNumbers.join(","), hasResSeries]); // eslint-disable-line react-hooks/exhaustive-deps
  const demandChartData = useMemo(() => {
    const data: any[] = currentData.map((d, i) => ({
      periode: d.periode, reel: resNumbers[i],
      prevision: resForecast && i === resNumbers.length - 1 ? resNumbers[i] : undefined,
    }));
    if (resForecast) data.push({ periode: "Prévision", prevision: Number(resForecast.next.toFixed(1)) });
    return data;
  }, [resNumbers.join(","), revenuePeriod, resForecast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ventes par trajet (réservations non annulées)
  const routeStats = useMemo(() => {
    const m = new Map<string, { name: string; ca: number; n: number }>();
    reservation.forEach((r) => {
      if (r.status === "Annulée") return;
      const key = `${r.departure ?? "?"} → ${r.destination ?? "?"}`;
      const v = m.get(key) ?? { name: key, ca: 0, n: 0 };
      v.ca += Number(r.amountPaid || 0) + Number(r.amountToPay || 0);
      v.n += 1;
      m.set(key, v);
    });
    return [...m.values()].sort((a, b) => b.ca - a.ca);
  }, [reservation]);
  const bestRoute = routeStats[0];
  const worstRoute = routeStats.length > 1 ? routeStats[routeStats.length - 1] : null;

  // Répartition des marchandises (poids)
  const goodsStats = useMemo(() => {
    const m = new Map<string, number>();
    goods.forEach((g) => {
      const label = String(g.name ?? g.type ?? g.designation ?? g.nom ?? g.label ?? g.description ?? "Autres");
      const w = Number(g.totalWeight ?? g.weight ?? g.poids ?? 0);
      if (w > 0) m.set(label, (m.get(label) ?? 0) + w);
    });
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push(["Autres", rest]);
    const total = top.reduce((s, [, v]) => s + v, 0);
    return { total, items: top.map(([name, value], i) => ({ name, value, color: GOODS_COLORS[i % GOODS_COLORS.length] })) };
  }, [goods]);

  // ---------- Data Analysis : statuts des réservations et des paiements
  const statusStats = useMemo(() => {
    const m = new Map<string, number>();
    reservation.forEach((r) => {
      const s = String(r.status ?? "Sans statut");
      m.set(s, (m.get(s) ?? 0) + 1);
    });
    return [...m.entries()].map(([name, value], i) => ({ name, value, color: STATUS_COLORS[i % STATUS_COLORS.length] }));
  }, [reservation]);

  const payStatusStats = useMemo(() => {
    let full = 0, partial = 0, none = 0;
    reservation.forEach((r) => {
      if (r.status === "Annulée") return;
      const p = Number(r.amountPaid || 0), t = Number(r.amountToPay || 0);
      if (t <= 0 && p > 0) full++;
      else if (p > 0 && t > 0) partial++;
      else if (t > 0) none++;
    });
    return [
      { name: "Payées", value: full, color: "#22c55e" },
      { name: "Partielles", value: partial, color: "#f59e0b" },
      { name: "Impayées", value: none, color: "#ef4444" },
    ];
  }, [reservation]);

  // ---------- AI Security : opérations de caisse atypiques (écart > moyenne + 2 écarts-types)
  const anomalies = useMemo(() => {
    const debits = (cashMouvement as any[]).filter((m) => Number(m.debit) > 0);
    if (debits.length < 5) return { list: [] as any[], enough: false, mean: 0, limit: 0 };
    const vals = debits.map((m) => Number(m.debit));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    const limit = mean + 2 * sd;
    const list = debits
      .filter((m) => Number(m.debit) > limit)
      .map((m) => ({
        label: String(m.label ?? m.description ?? m.motif ?? m.libelle ?? "Dépense"),
        amount: Number(m.debit),
        date: movDate(m),
        z: sd ? (Number(m.debit) - mean) / sd : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return { list, enough: true, mean, limit };
  }, [cashMouvement]);

  const seaRisk = weather ? (weather.wave != null && weather.wave > 2) || weather.windKmh > 40 : false;
  const maintBoats = boats.filter(isMaint);
  const readyBoats = boats.filter((b) => !isMaint(b));

  // ---------- Alertes calculées à partir des données réelles (si l'IA est indisponible)
  const localAlerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    if (solde < 0) {
      out.push({ t: "Solde de caisse négatif", s: `Les dépenses dépassent les recettes de ${formatCurrency(Math.abs(solde))}.`, lvl: "Élevé", a: "Vérifier les dépenses récentes." });
    }
    if (anomalies.list.length) {
      const top = anomalies.list[0];
      out.push({
        t: "Dépense inhabituelle",
        s: `${top.label} : ${formatCurrency(top.amount)}, bien au-dessus de la dépense moyenne (${formatCurrency(anomalies.mean)}).`,
        lvl: "Moyen",
        a: "Contrôler cette opération dans l'audit.",
      });
    }
    if (unpaidCount > 0) {
      out.push({
        t: "Paiements à relancer",
        s: `${unpaidCount} réservation(s) avec ${formatCurrency(unpaid)} restant à encaisser (taux de paiement : ${payRate ?? 0}%).`,
        lvl: payRate != null && payRate < 50 ? "Élevé" : "Moyen",
        a: "Relancer les clients concernés.",
      });
    }
    if (cancelled > 0 && cancelRate != null) {
      out.push({
        t: "Réservations annulées",
        s: `${cancelled} annulation(s) sur ${reservation.length} réservations (${cancelRate.toFixed(0)}%).`,
        lvl: cancelRate > 20 ? "Moyen" : "Faible",
        a: cancelRate > 20 ? "Analyser les causes d'annulation." : undefined,
      });
    }
    if (maintBoats.length) {
      out.push({
        t: "Bateaux en maintenance",
        s: `En maintenance : ${maintBoats.map(boatName).join(", ")}.`,
        lvl: "Moyen",
        a: readyBoats.length ? `Disponibles : ${readyBoats.map(boatName).join(", ")}.` : "Aucun autre bateau disponible.",
      });
    }
    if (seaRisk && weather) {
      out.push({
        t: "Météo défavorable",
        s: `Vent ${weather.wind}${weather.wave != null ? `, mer ${weather.wave.toFixed(1).replace(".", ",")} m` : ""} à Toamasina.`,
        lvl: "Élevé",
        a: "Adapter ou reporter les départs.",
      });
    }
    if (worstRoute && bestRoute && worstRoute.name !== bestRoute.name) {
      out.push({
        t: "Trajet le moins rentable",
        s: `${worstRoute.name} : ${formatCurrency(worstRoute.ca)} pour ${worstRoute.n} réservation(s).`,
        lvl: "Faible",
        a: "Réviser les tarifs ou la fréquence.",
      });
    }
    return out.slice(0, 4);
  }, [solde, anomalies, unpaidCount, unpaid, payRate, cancelled, cancelRate, reservation.length, maintBoats.length, readyBoats.length, seaRisk, weather, worstRoute, bestRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Contexte envoyé à l'IA (uniquement des données réelles)
  const aiContext = useMemo(() => ({
    credit: totalCredit, debit: totalDebit, solde, voyages: trip.length, reservations: reservation.length,
    annulees: cancelled, montantPaye: paid, montantNonPaye: unpaid, reservationsAvecSolde: unpaidCount,
    revenusRecents: revNumbers.slice(-6), bateaux: boats.map((b) => ({ nom: boatName(b), etat: boatState(b) })),
    trajets: routeStats.slice(0, 5),
    statuts: statusStats.map((s) => ({ statut: s.name, nombre: s.value })),
    depensesInhabituelles: anomalies.list.map((a) => ({ libelle: a.label, montant: a.amount })),
  }), [totalCredit, totalDebit, solde, trip.length, reservation.length, cancelled, paid, unpaid, unpaidCount, revNumbers.join(","), boats, routeStats, statusStats, anomalies]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Analyse IA des données réelles
  const signature = `${cashMouvement.length}-${reservation.length}-${trip.length}-${boats.length}-${totalCredit}-${totalDebit}`;
  useEffect(() => {
    if (!hasData) return;
    let off = false;
    setAiBusy(true);
    const prompt = `Tu es l'IA d'analyse de SAINT-JUDE (transport maritime, Madagascar, montants en Ar). Données réelles: ${JSON.stringify(aiContext)}.
Réponds UNIQUEMENT en JSON: {"analyse":"2 phrases maximum","prevision":"2 phrases maximum","facteurs":["3 facteurs maximum, déduits des données"],"alertes":[{"titre":"","detail":"","action":"","niveau":"Faible|Moyen|Élevé"}]}. 4 alertes maximum. N'invente aucune donnée absente: si une information manque, dis-le explicitement. Ne cite aucun pourcentage qui ne soit pas calculable à partir des données.`;
    askAIJson<{ analyse: string; prevision: string; facteurs?: string[]; alertes: { titre: string; detail: string; action?: string; niveau: string }[] }>(prompt).then((r) => {
      if (off) return;
      if (r && typeof r.analyse === "string") {
        setInsight({
          analyse: r.analyse,
          prevision: r.prevision ?? "",
          facteurs: (r.facteurs ?? []).slice(0, 3),
          alertes: (r.alertes ?? []).slice(0, 4).map((a) => ({
            t: a.titre, s: a.detail, a: a.action,
            lvl: (["Faible", "Moyen", "Élevé"].includes(a.niveau) ? a.niveau : "Moyen") as Level,
          })),
        });
      } else setInsight(null);
      setAiBusy(false);
    }).catch(() => { if (!off) { setInsight(null); setAiBusy(false); } });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const alerts = insight && insight.alertes.length ? insight.alertes : localAlerts;

  // Analyse textuelle locale (repli sans IA) : uniquement des chiffres réels
  const localAnalyse = hasData
    ? `${reservation.length} réservation(s) dont ${cancelled} annulée(s), ${trip.length} voyage(s). Solde net : ${formatCurrency(solde)}${payRate != null ? `, taux de paiement ${payRate}%` : ""}.`
    : "Aucune donnée enregistrée pour le moment.";
  const localFacteurs: string[] = [
    bestRoute ? `Trajet principal : ${bestRoute.name} (${formatCurrency(bestRoute.ca)})` : "",
    unpaidCount > 0 ? `${unpaidCount} réservation(s) avec solde impayé` : "",
    maintBoats.length ? `${maintBoats.length} bateau(x) en maintenance` : "",
  ].filter(Boolean);

  // ---------- Assistant Aina : questions en langage naturel sur les données
  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || asking) return;
    setAsking(true);
    setAnswer(null);
    const prompt = `Tu es Aina, l'assistante IA de SAINT-JUDE (transport maritime, Madagascar, montants en Ar). Données réelles: ${JSON.stringify(aiContext)}.
Question de l'utilisateur: "${text.replace(/"/g, "'")}".
Réponds UNIQUEMENT en JSON: {"reponse":"5 phrases maximum, en français, en citant les chiffres des données qui justifient la réponse"}. Si les données ne permettent pas de répondre, dis-le clairement sans rien inventer.`;
    try {
      const r = await askAIJson<{ reponse: string }>(prompt);
      setAnswer(r && typeof r.reponse === "string" ? r.reponse : "Je n'ai pas pu analyser les données pour le moment. Réessayez dans un instant.");
    } catch {
      setAnswer("Le service d'IA est indisponible pour le moment.");
    }
    setAsking(false);
  };
  const onAsk = (e: FormEvent) => { e.preventDefault(); ask(question); };
  const suggestions = [
    "Quels paiements ne sont pas réglés ?",
    "Quel trajet est le plus rentable ?",
    "Pourquoi les revenus évoluent-ils ainsi ?",
  ];

  // ---------- Météo réelle (Open-Meteo, Toamasina)
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const lat = -18.1492, lon = 49.4023;
        const [f, m] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`).then((r) => r.json()),
          fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height`).then((r) => r.json()).catch(() => null),
        ]);
        if (off) return;
        const w = wmo(f.current.weather_code);
        setWeather({
          temp: Math.round(f.current.temperature_2m), label: w.label, Icon: w.Icon,
          wind: `${Math.round(f.current.wind_speed_10m)} km/h (${compass(f.current.wind_direction_10m)})`,
          windKmh: Math.round(f.current.wind_speed_10m),
          humidity: Math.round(f.current.relative_humidity_2m), visibility: Math.round((f.current.visibility ?? 0) / 1000),
          wave: m?.current?.wave_height ?? null,
          fetchedAt: new Date(),
          days: [1, 2, 3].map((i) => {
            const x = wmo(f.daily.weather_code[i]);
            const dt = new Date(f.daily.time[i]);
            return {
              d: capitalizeWords(dt.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")),
              t: `${Math.round(f.daily.temperature_2m_min[i])}° / ${Math.round(f.daily.temperature_2m_max[i])}°`,
              label: x.label, Icon: x.Icon,
            };
          }),
        });
      } catch {
        if (!off) setWeatherErr(true);
      }
    })();
    return () => { off = true; };
  }, []);

  const boatsWithGps = boats.filter((b) => boatPos(b)).length;
  const gpsIndex = selectedBoat ?? boats.findIndex((b) => boatPos(b));
  const gpsBoat = gpsIndex >= 0 ? boats[gpsIndex] : null;
  const gpsBoatPos = gpsBoat ? boatPos(gpsBoat) : null;
  const updatedLabel = fmtDateTime(loadedAt);

  // ---------- KPI (100 % réels ; variation affichée seulement si calculable)
  const stats: { title: string; value: string; icon: LucideIcon; bg: string; trend?: Trend | null }[] = [
    { title: "Chiffre d'affaires total", value: formatCurrency(totalCredit), icon: TrendingUp, bg: "bg-[#0f9d78]", trend: caTrend },
    { title: "Total des dépenses", value: formatCurrency(totalDebit), icon: Wallet, bg: "bg-[#ef4444]", trend: debitTrend },
    { title: "Réservations totales", value: String(reservation.length), icon: CalendarDays, bg: "bg-[#7c3aed]", trend: resTrend },
    { title: "Voyages effectués", value: String(trip.length), icon: Ship, bg: "bg-[#1d6fe0]", trend: tripTrend },
    { title: "Taux de paiement", value: payRate != null ? `${payRate}%` : "—", icon: CreditCard, bg: "bg-[#f59e0b]", trend: payTrend },
  ];

  // Indicateurs secondaires
  const stats2: { title: string; value: string; sub: string; icon: LucideIcon; bg: string; tone?: string }[] = [
    { title: "Solde net de caisse", value: formatCurrency(solde), sub: "Crédits − débits", icon: Banknote, bg: solde < 0 ? "bg-[#ef4444]" : "bg-[#0f9d78]", tone: solde < 0 ? "text-[#e5342f]" : "text-[#0f9d78]" },
    { title: "Reste à encaisser", value: formatCurrency(unpaid), sub: `${unpaidCount} réservation(s) concernée(s)`, icon: CreditCard, bg: "bg-[#f59e0b]" },
    { title: "Taux d'annulation", value: cancelRate != null ? `${cancelRate.toFixed(0)}%` : "—", sub: `${cancelled} sur ${reservation.length} réservation(s)`, icon: XCircle, bg: "bg-[#64748b]" },
    { title: "Flotte disponible", value: boats.length ? `${readyBoats.length}/${boats.length}` : "—", sub: `${maintBoats.length} en maintenance · ${boatsWithGps} localisé(s)`, icon: Anchor, bg: "bg-[#1d6fe0]" },
  ];

  // ---------- « Pourquoi ce résultat ? » : valeur, période, formule, source, facteurs, confiance, date
  const whyMap: Record<string, Why> = {
    "Chiffre d'affaires total": {
      value: formatCurrency(totalCredit), period: "Toutes les opérations enregistrées",
      formula: "Somme des crédits de la caisse",
      source: `Table des mouvements de caisse (${cashMouvement.length} ligne(s))`,
      factors: [
        bestRoute ? `Trajet le plus contributeur : ${bestRoute.name}` : "Aucune réservation active pour identifier un trajet",
        caTrend ? `Variation vs mois précédent : ${fmtPct(caTrend)}` : "Variation indisponible (moins de 2 mois de données)",
      ],
      confidence: "Calcul exact sur les données brutes",
    },
    "Total des dépenses": {
      value: formatCurrency(totalDebit), period: "Toutes les opérations enregistrées",
      formula: "Somme des débits de la caisse",
      source: `Table des mouvements de caisse (${debitOps} dépense(s))`,
      factors: [
        anomalies.list.length ? `${anomalies.list.length} dépense(s) inhabituelle(s) détectée(s)` : "Aucune dépense atypique détectée",
        debitTrend ? `Variation vs mois précédent : ${fmtPct(debitTrend)}` : "Variation indisponible (dates ou historique manquants)",
      ],
      confidence: "Calcul exact sur les données brutes",
    },
    "Réservations totales": {
      value: String(reservation.length), period: "Toutes les réservations enregistrées",
      formula: "Nombre de lignes de la table des réservations",
      source: `Table des réservations (${activeRes} active(s), ${cancelled} annulée(s))`,
      factors: statusStats.map((s) => `${s.name} : ${s.value}`),
      confidence: "Calcul exact sur les données brutes",
    },
    "Voyages effectués": {
      value: String(trip.length), period: "Tous les voyages enregistrés",
      formula: "Nombre de lignes de la table des trajets",
      source: `Table des trajets (${trip.length} ligne(s))`,
      factors: [`Flotte : ${boats.length} bateau(x), ${maintBoats.length} en maintenance`],
      confidence: "Calcul exact sur les données brutes",
    },
    "Taux de paiement": {
      value: payRate != null ? `${payRate}%` : "—", period: "Toutes les réservations (annulées incluses dans les montants saisis)",
      formula: `Montant encaissé (${formatCurrency(paid)}) ÷ montant total dû (${formatCurrency(payTotal)})`,
      source: "Colonnes amountPaid et amountToPay de la table des réservations",
      factors: payStatusStats.map((s) => `${s.name} : ${s.value}`),
      confidence: "Calcul exact sur les données brutes",
    },
  };
  const whyPanel = why ? whyMap[why] : null;

  const justifs: { Icon: LucideIcon; bg: string; box: string; title: string; text: string; source: string }[] = [
    {
      Icon: TrendingUp, bg: "bg-[#0f9d78]", box: "bg-[#eefaf5]",
      title: `Chiffre d'affaires : ${formatCurrency(totalCredit)}`,
      text: `Somme des crédits de la caisse (${cashMouvement.length} mouvement(s)). Solde net après dépenses : ${formatCurrency(solde)}.`,
      source: `Base Neon · Chargé le ${updatedLabel}`,
    },
    {
      Icon: Wallet, bg: "bg-[#ef4444]", box: "bg-[#fff1f1]",
      title: `Dépenses : ${formatCurrency(totalDebit)}`,
      text: `Somme des débits de la caisse (${debitOps} opération(s) de dépense).`,
      source: `Base Neon · Chargé le ${updatedLabel}`,
    },
    {
      Icon: CalendarDays, bg: "bg-[#7c3aed]", box: "bg-[#f5f0ff]",
      title: `Réservations : ${reservation.length}`,
      text: `${activeRes} active(s) et ${cancelled} annulée(s). Taux de paiement = montant encaissé (${formatCurrency(paid)}) / montant total dû (${formatCurrency(payTotal)}).`,
      source: `Base Neon · Chargé le ${updatedLabel}`,
    },
    {
      Icon: Ship, bg: "bg-[#1d6fe0]", box: "bg-[#eef4ff]",
      title: `Trajets : ${trip.length}`,
      text: `Voyages enregistrés. Flotte : ${boats.length} bateau(x), dont ${maintBoats.length} en maintenance.`,
      source: `Base Neon · Chargé le ${updatedLabel}`,
    },
    {
      Icon: CloudSun, bg: "bg-[#f59e0b]", box: "bg-[#fff8ea]",
      title: weather ? `Météo : ${weather.temp}°C` : "Météo : indisponible",
      text: weather ? `${weather.label} à Toamasina.` : "Les prévisions Open-Meteo n'ont pas pu être chargées.",
      source: weather ? `Open-Meteo API · ${fmtDateTime(weather.fetchedAt)}` : "Open-Meteo API",
    },
    {
      Icon: MapPin, bg: "bg-[#0f9d78]", box: "bg-[#eefaf5]",
      title: `GPS : ${boatsWithGps}/${boats.length} bateau(x) localisé(s)`,
      text: boatsWithGps
        ? "Dernières positions enregistrées dans la table des bateaux."
        : "Aucune position GPS enregistrée dans la base pour l'instant.",
      source: `Base Neon · Chargé le ${updatedLabel}`,
    },
  ];

  const exportReport = () => {
    const rows: (string | number)[][] = [
      ["Indicateur", "Valeur"],
      ["Chiffre d'affaires (Ar)", totalCredit],
      ["Dépenses (Ar)", totalDebit],
      ["Solde net (Ar)", solde],
      ["Réservations", reservation.length],
      ["Réservations annulées", cancelled],
      ["Voyages", trip.length],
      ["Montant encaissé (Ar)", paid],
      ["Reste à encaisser (Ar)", unpaid],
      ["Taux de paiement (%)", payRate ?? ""],
      ["Taux d'annulation (%)", cancelRate != null ? Number(cancelRate.toFixed(1)) : ""],
      [],
      ["Trajet", "Réservations", "Chiffre d'affaires (Ar)"],
      ...routeStats.map((r) => [r.name, r.n, r.ca]),
      [],
      ["Dépense inhabituelle", "Montant (Ar)"],
      ...anomalies.list.map((a) => [a.label, a.amount]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-saint-jude-${loadedAt.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dateLabel = capitalizeWords(now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const roleLabel = currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.role ?? "Admin";

  const tabs: Tab[] = ["Demande", "Prix", "Recettes", "Marchandises"];
  const tabTitle: Record<Tab, string> = {
    Demande: "Réservations par période et prévision (période suivante)",
    Prix: "Prix moyen par réservation et par trajet (Ar)",
    Recettes: "Chiffre d'affaires par période et prévision (période suivante)",
    Marchandises: "Poids transporté par catégorie (kg)",
  };
  const emptyChart = <Empty text="Pas assez de données pour ce graphique." />;

  const forecastNote = (() => {
    if (tab === "Demande" && resForecast)
      return `Prochaine période : ≈ ${Math.round(resForecast.next)} réservation(s) ± ${resForecast.rmse.toFixed(1).replace(".", ",")} (régression linéaire, fiabilité R² = ${resForecast.r2.toFixed(2).replace(".", ",")}).`;
    if (tab === "Recettes" && revForecast)
      return `Prochaine période : ≈ ${formatCurrency(revForecast.next * 1000)} ± ${formatCurrency(revForecast.rmse * 1000)} (régression linéaire, fiabilité R² = ${revForecast.r2.toFixed(2).replace(".", ",")}).`;
    return "Au moins 3 périodes de données sont nécessaires pour calculer une prévision.";
  })();

  return (
    <div className="p-5 bg-[#f3f7fd] min-h-full space-y-4 text-[#10285e]">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Rechercher une réservation, un bateau, un client, un trajet..."
            className="w-full bg-white border border-[#dbe5f5] rounded-full pl-9 pr-3 py-2 text-xs"
          />
        </div>
        {currentUser?.role === "Propriétaire" && (
          <button
            onClick={() => onSetToAudit("Audit")}
            className="flex items-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-xs font-semibold px-4 py-2 rounded-full"
          >
            <ShieldCheck size={16} /> Audit Logs
          </button>
        )}
        <button type="button" aria-label="Notifications" className="relative w-10 h-10 bg-white border border-[#dbe5f5] rounded-full flex items-center justify-center">
          <Bell size={18} />
          {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
        </button>
        <div className="flex items-center gap-2 bg-white border border-[#dbe5f5] rounded-full pl-1 pr-3 py-1">
          <div className="w-8 h-8 rounded-full bg-[#1255d6] text-white flex items-center justify-center">
            <UserCircle2 size={18} />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold">{roleLabel}</p>
            <p className="text-[10px] text-gray-500">Admin</p>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#dbe5f5] rounded-xl px-3 py-1.5 text-xs">
          <Calendar size={20} className="text-[#1255d6]" />
          <div>
            <p className="font-semibold">{dateLabel}</p>
            <p>{pad(now.getHours())}:{pad(now.getMinutes())}</p>
          </div>
        </div>
      </div>

      {/* Titre */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#e0ecff] text-[#1255d6] flex items-center justify-center">
          <BarChart3 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Tableau de bord analytique & IA</h1>
          <p className="text-xs text-[#3e5788]">Des données fiables, des analyses claires et des recommandations pour mieux décider.</p>
        </div>
      </div>

      {!hasData && (
        <div className="rounded-xl border border-[#dbe5f5] bg-white p-4 text-xs flex items-center gap-2">
          <Info size={16} className="text-[#1255d6]" />
          Aucune donnée n'est encore enregistrée dans la base. Les indicateurs s'afficheront dès les premières opérations.
        </div>
      )}

      {/* KPI – cliquables : « Pourquoi ce résultat ? » */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          const t = s.trend;
          const flat = t ? Math.abs(t.pct) < 0.05 : false;
          const up = t ? t.pct > 0 : false;
          // pour les dépenses, une hausse est défavorable
          const goodUp = s.title !== "Total des dépenses";
          const positive = flat ? false : goodUp ? up : !up;
          return (
            <button
              type="button"
              key={s.title}
              onClick={() => setWhy((w) => (w === s.title ? null : s.title))}
              className={`${card} p-4 flex items-center gap-3 text-left transition hover:shadow-md ${why === s.title ? "ring-2 ring-[#1255d6]" : ""}`}
              aria-label={`Pourquoi ce résultat ? ${s.title}`}
            >
              <div className={`w-14 h-14 rounded-full ${s.bg} text-white flex items-center justify-center shrink-0`}>
                <Icon size={26} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#3e5788]">{s.title}</p>
                <p className="text-2xl font-extrabold leading-tight truncate text-[#1255d6]">{s.value}</p>
                {t ? (
                  <p className={`text-[11px] flex items-center gap-1 ${flat ? "text-gray-500" : positive ? "text-[#0f9d78]" : "text-[#e5342f]"}`}>
                    {flat ? <Minus size={12} /> : up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <b>{flat ? "stable" : fmtPct(t)}</b> <span className="text-gray-500">vs mois précédent</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">Données de la base</p>
                )}
                <p className="text-[10px] text-[#1255d6] flex items-center gap-1 mt-0.5"><HelpCircle size={10} /> Pourquoi ce résultat ?</p>
              </div>
            </button>
          );
        })}
      </div>

      {whyPanel && why && (
        <div className={`${card} p-4 text-[11px] border-[#1255d6]`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><HelpCircle size={16} className="text-[#1255d6]" /> Pourquoi ce résultat ? — {why}</h3>
            <button type="button" onClick={() => setWhy(null)} aria-label="Fermer" className="text-gray-500 hover:text-[#10285e]"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div><p className="text-gray-500">Valeur obtenue</p><p className="font-bold text-xs text-[#1255d6]">{whyPanel.value}</p></div>
            <div><p className="text-gray-500">Période étudiée</p><p className="font-semibold">{whyPanel.period}</p></div>
            <div><p className="text-gray-500">Formule</p><p className="font-semibold">{whyPanel.formula}</p></div>
            <div><p className="text-gray-500">Données sources</p><p className="font-semibold">{whyPanel.source}</p></div>
            <div>
              <p className="text-gray-500">Facteurs explicatifs</p>
              <ul className="space-y-0.5">{whyPanel.factors.map((f, i) => <li key={i}>• {f}</li>)}</ul>
            </div>
            <div><p className="text-gray-500">Niveau de confiance</p><p className="font-semibold">{whyPanel.confidence}</p><p className="text-gray-400 mt-1">Actualisé : {updatedLabel}</p></div>
          </div>
        </div>
      )}

      {/* Indicateurs secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats2.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className={`${card} p-3 flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-full ${s.bg} text-white flex items-center justify-center shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#3e5788]">{s.title}</p>
                <p className={`text-lg font-extrabold leading-tight truncate ${s.tone ?? "text-[#1255d6]"}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 truncate">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ligne 1 : Évolution | Marchandises | GPS | Météo */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr_1fr_0.95fr] gap-3">
        {/* Évolution CA + Réservations */}
        <div className={`${card} p-4`}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-bold">Évolution du chiffre d'affaires et des réservations</h3>
              {currentData.length > 0 && (
                <p className="text-[10px] text-gray-500">Total de la période affichée : {formatCurrency(revTotal * 1000)}</p>
              )}
            </div>
            <select
              value={revenuePeriod}
              onChange={(e) => setRevenuePeriod(e.target.value)}
              className="border rounded-md text-xs px-2 py-1 bg-[#f8fafd]"
            >
              <option value="hebdomadaire">Hebdomadaire</option>
              <option value="mensuelle">6 derniers mois</option>
              <option value="trimestrielle">Trimestrielle</option>
              <option value="semestrielle">Semestrielle</option>
              <option value="annuelle">Annuelle</option>
            </select>
          </div>
          {currentData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={currentData} margin={{ top: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="ca" tick={{ fontSize: 10 }} tickFormatter={(v: number) => compact(v * 1000)} />
                <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartsTooltip
                  formatter={(v: number | string, name: string) => [
                    name === "Réservations" ? v : formatCurrency(Number(v) * 1000),
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="ca" dataKey="revenus" name="Chiffre d'affaires (Ar)" fill="#1d6fe0" radius={[3, 3, 0, 0]} />
                <Line yAxisId="n" type="monotone" dataKey="reservations" name="Réservations" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Empty text="Aucun mouvement de caisse sur cette période." h={220} />
          )}
          <div className="grid grid-cols-3 gap-2 text-[10px] mt-2">
            <div className="border rounded-md p-2 bg-[#f8fafd]">
              <p className="text-gray-500">Revenu moyen par réservation</p>
              <p className="font-bold text-[#1255d6] text-xs">
                {activeRes > 0 ? formatCurrency(totalCredit / activeRes) : "—"}
              </p>
            </div>
            <div className="border rounded-md p-2 bg-[#f8fafd]">
              <p className="text-gray-500">Panier moyen</p>
              <p className="font-bold text-[#1255d6] text-xs">
                {activeRes > 0 ? formatCurrency(payTotal / activeRes) : "—"}
              </p>
            </div>
            <div className="border rounded-md p-2 bg-[#f8fafd]">
              <p className="text-gray-500">Meilleure période</p>
              <p className="font-bold text-[#1255d6] text-xs">
                {revBest && Number(revBest.revenus) > 0 ? `${revBest.periode} (${formatCurrency(Number(revBest.revenus) * 1000)})` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Répartition marchandises */}
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center">
              <Package size={18} />
            </div>
            <h3 className="font-bold">Répartition des marchandises</h3>
          </div>
          {goodsStats.total ? (
            <div className="flex items-center gap-2">
              <div className="relative w-[160px] h-[190px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={goodsStats.items} dataKey="value" innerRadius={48} outerRadius={75} stroke="#fff">
                      {goodsStats.items.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString("fr-FR")} kg`, "Poids"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] text-gray-500">Total</span>
                  <span className="text-xs font-extrabold">{goodsStats.total.toLocaleString("fr-FR")} kg</span>
                </div>
              </div>
              <ul className="text-xs space-y-2 flex-1">
                {goodsStats.items.map((p) => (
                  <li key={p.name} className="flex items-center gap-2">
                    <i className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: p.color }} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <b>{Math.round((p.value / goodsStats.total) * 100)}%</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty text="Aucune marchandise pesée enregistrée." h={190} />
          )}
        </div>

        {/* Suivi GPS */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2">
            <Navigation size={16} className="text-[#1255d6]" /> Suivi GPS des bateaux
          </h3>
          <p className="text-[11px] text-gray-500 mb-2">
            {boatsWithGps ? `${boatsWithGps} bateau(x) localisé(s) · dernières positions enregistrées` : "Dernières positions enregistrées"}
          </p>
          <div className="relative rounded-lg bg-[#d9ecfb] border h-[250px] overflow-hidden">
            <svg viewBox="0 0 160 290" className="w-full h-full">
              <path d={MADA_PATH} fill="#e6efd9" stroke="#7fa36a" strokeWidth="0.8" strokeLinejoin="round" />
              {CITIES.map((c) => {
                const [x, y] = proj(c.lon, c.lat);
                return (
                  <g key={c.n}>
                    <circle cx={x} cy={y} r={c.port ? 2.6 : 1.8} fill={c.port ? "#1255d6" : "#64748b"} />
                    <text x={c.left ? x - 4 : x + 4} y={y + 2.5} fontSize="7" textAnchor={c.left ? "end" : "start"} fill="#10285e">
                      {c.n}
                    </text>
                  </g>
                );
              })}
              {boats.map((b, i) => {
                const p = boatPos(b);
                if (!p) return null;
                const [x, y] = proj(p[0], p[1]);
                const maint = isMaint(b);
                return (
                  <g key={i} onClick={() => setSelectedBoat(i)} style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r={6} fill={maint ? "#ef4444" : "#22c55e"} fillOpacity={0.25} />
                    <circle cx={x} cy={y} r={3} fill={maint ? "#ef4444" : "#22c55e"} stroke="#fff" strokeWidth="1" />
                    <text x={x + 6} y={y - 5} fontSize="7" fontWeight="700" fill="#10285e">{boatName(b)}</text>
                  </g>
                );
              })}
            </svg>
            {boatsWithGps === 0 && (
              <div className="absolute left-2 right-2 bottom-2 bg-white/95 rounded-lg border border-[#dbe5f5] p-2 text-[10px] text-gray-600">
                Aucune position GPS enregistrée pour {boats.length ? "les bateaux de la flotte" : "le moment (aucun bateau)"}.
              </div>
            )}
            {gpsBoat && gpsBoatPos && (
              <div className="absolute right-2 bottom-2 bg-white rounded-lg shadow-md border border-[#dbe5f5] p-2 text-[10px] max-w-[150px]">
                <p className="font-bold text-xs truncate">{boatName(gpsBoat)}</p>
                <p className={`font-semibold ${isMaint(gpsBoat) ? "text-orange-500" : "text-green-600"}`}>{boatState(gpsBoat)}</p>
                <p className="text-gray-500">Position : {gpsBoatPos[1].toFixed(2)} / {gpsBoatPos[0].toFixed(2)}</p>
              </div>
            )}
          </div>
          <div className="flex gap-4 text-[10px] mt-2 justify-center">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Disponible / en service</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-red-500 inline-block" /> En maintenance</span>
          </div>
        </div>

        {/* Météo */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2">
            <Cloud size={16} className="text-[#1255d6]" /> Météo & Conditions maritimes
          </h3>
          <p className="text-[11px] text-gray-500">Toamasina — Aujourd'hui</p>
          {!weather && !weatherErr && <p className="text-xs text-gray-500 py-10 text-center">Chargement de la météo…</p>}
          {weatherErr && !weather && (
            <Empty text="Météo indisponible : impossible de joindre Open-Meteo. Réessayez plus tard." h={200} />
          )}
          {weather && (
            <>
              <div className="flex items-center gap-3 my-3">
                <weather.Icon size={46} className="text-[#f59e0b]" />
                <div>
                  <p className="text-3xl font-extrabold">{weather.temp}°C</p>
                  <p className="text-[11px]">{weather.label}</p>
                </div>
                <ul className="text-[10px] space-y-1 ml-auto">
                  <li className="flex items-center gap-1"><Wind size={11} />Vent <b>{weather.wind}</b></li>
                  <li className="flex items-center gap-1"><Waves size={11} />Mer <b>{weather.wave != null ? `${weather.wave.toFixed(1).replace(".", ",")} m` : "—"}</b></li>
                  <li className="flex items-center gap-1"><Droplets size={11} />Humidité <b>{weather.humidity}%</b></li>
                  <li className="flex items-center gap-1"><Eye size={11} />Visibilité <b>{weather.visibility} km</b></li>
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {weather.days.map((f) => (
                  <div key={f.d} className="border rounded-md p-1.5 text-center text-[9px] bg-[#f8fafd]">
                    <p className="font-semibold">{f.d}</p>
                    <f.Icon size={16} className="mx-auto my-1 text-[#1255d6]" />
                    <p>{f.t}</p>
                    <p className="text-gray-500">{f.label}</p>
                  </div>
                ))}
              </div>
              <div className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-[10px] ${seaRisk ? "bg-[#fff0d9] text-[#b45309]" : "bg-[#e8f1ff] text-[#1255d6]"}`}>
                <Info size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p>
                    {seaRisk
                      ? "Prudence : vent fort ou mer agitée, adaptez les départs."
                      : weather.wave != null
                        ? `Conditions actuelles favorables (vent ${weather.windKmh} km/h, mer ${weather.wave.toFixed(1).replace(".", ",")} m).`
                        : `Vent modéré (${weather.windKmh} km/h). Hauteur de mer non disponible.`}
                  </p>
                  <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold underline">
                    Voir détails météo <ArrowRight size={10} />
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ligne 2 : Ventes par trajet | Data Science | Justifications */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.3fr_1fr] gap-3">
        {/* Analyse des ventes par trajet */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <BarChart3 size={16} className="text-[#1255d6]" /> Analyse des ventes par trajet
          </h3>
          {routeStats.length === 0 ? (
            <Empty text="Aucune réservation active : pas d'analyse par trajet." h={220} />
          ) : (
            <div className="grid grid-cols-[1.6fr_1fr] gap-2 mt-2">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={routeStats.slice(0, 6)} margin={{ top: 10, right: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-30} textAnchor="end" height={52} tickFormatter={(v: string) => { const s = v.split(" → ")[1] ?? v; return s.length > 11 ? `${s.slice(0, 10)}…` : s; }} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 9 }} tickFormatter={compact} />
                  <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 9 }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(v: number | string, name: string) => [name === "Chiffre d'affaires" ? formatCurrency(Number(v)) : v, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar yAxisId="ca" dataKey="ca" name="Chiffre d'affaires" fill="#1d6fe0" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="n" type="monotone" dataKey="n" name="Nombre de réservations" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="space-y-4 text-[10px]">
                <div>
                  <p className="font-semibold flex items-center gap-1"><Trophy size={12} className="text-[#f59e0b]" /> Trajet le plus rentable</p>
                  <p className="font-bold text-xs mt-1">{bestRoute.name}</p>
                  <p className="text-[#1255d6] font-bold">{formatCurrency(bestRoute.ca)}</p>
                  <p className="text-gray-500">({bestRoute.n} réservation(s))</p>
                </div>
                {worstRoute && (
                  <div>
                    <p className="font-semibold flex items-center gap-1"><AlertTriangle size={12} className="text-[#e5342f]" /> Trajet le moins rentable</p>
                    <p className="font-bold text-xs mt-1">{worstRoute.name}</p>
                    <p className="text-[#e5342f] font-bold">{formatCurrency(worstRoute.ca)}</p>
                    <p className="text-gray-500">({worstRoute.n} réservation(s))</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Data Science */}
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center">
              <Brain size={18} />
            </div>
            <h3 className="font-bold text-sm flex-1">
              Data Science <span className="text-gray-500 font-normal">— Prévisions & Tendances</span>
            </h3>
            <span className="text-[10px] text-gray-500">{aiBusy ? "Analyse IA en cours…" : insight ? "Analyse IA" : "Calcul local"}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[10px] px-3 py-1 rounded-md border ${
                  tab === t ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-[#f8fafd] text-[#10285e] border-[#dbe5f5]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold mb-1">{tabTitle[tab]}</p>
          <div className="grid grid-cols-[1.3fr_1fr] gap-3">
            <div>
              {tab === "Demande" && (hasResSeries && demandChartData.length ? (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={demandChartData} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="periode" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="reel" stroke="#1d6fe0" strokeWidth={2} fill="#1d6fe0" fillOpacity={0.15} name="Réel" />
                    <Area type="monotone" dataKey="prevision" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" fill="#7c3aed" fillOpacity={0.08} name="Prévision" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : emptyChart)}
              {tab === "Recettes" && (revChartData.length ? (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={revChartData} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="periode" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => compact(v * 1000)} />
                    <RechartsTooltip formatter={(v: number | string, name: string) => [formatCurrency(Number(v) * 1000), name]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="reel" stroke="#1d6fe0" strokeWidth={2} fill="#1d6fe0" fillOpacity={0.15} name="Réel" />
                    <Area type="monotone" dataKey="prevision" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" fill="#7c3aed" fillOpacity={0.08} name="Prévision" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : emptyChart)}
              {tab === "Prix" && (routeStats.length ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={routeStats.slice(0, 6).map((r) => ({ name: r.name, prix: Math.round(r.ca / r.n) }))} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-30} textAnchor="end" height={52} tickFormatter={(v: string) => { const s = v.split(" → ")[1] ?? v; return s.length > 11 ? `${s.slice(0, 10)}…` : s; }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={compact} />
                    <RechartsTooltip formatter={(v: number | string) => [formatCurrency(Number(v)), "Prix moyen"]} />
                    <Bar dataKey="prix" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : emptyChart)}
              {tab === "Marchandises" && (goodsStats.total ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={goodsStats.items} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={compact} />
                    <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString("fr-FR")} kg`, "Poids"]} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {goodsStats.items.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : emptyChart)}
              {(tab === "Demande" || tab === "Recettes") && (
                <p className="text-[10px] text-gray-500 mt-1">{forecastNote}</p>
              )}
            </div>
            <div className="rounded-lg bg-[#eef4ff] p-3 text-[11px] space-y-2">
              <p className="font-bold text-[#1255d6] flex items-center gap-1.5"><Brain size={14} /> Insights IA</p>
              <p className="text-gray-700">{insight?.analyse || localAnalyse}</p>
              {showDetail && (
                <p className="text-gray-700">{insight?.prevision || forecastNote}</p>
              )}
              {(insight?.facteurs?.length || localFacteurs.length) > 0 && (
                <div>
                  <p className="font-semibold">Facteurs identifiés :</p>
                  <ul className="mt-1 space-y-1">
                    {(insight?.facteurs?.length ? insight.facteurs : localFacteurs).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-gray-700">
                        <i className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mt-1.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="w-full flex items-center justify-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-[11px] font-semibold rounded-md py-1.5"
              >
                {showDetail ? "Masquer l'analyse détaillée" : "Voir l'analyse détaillée"} <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Justifications IA */}
        <div className={`${card} p-4 xl:row-span-2`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Brain size={16} className="text-[#e5342f]" /> IA – Justifications des indicateurs
          </h3>
          <ul className="space-y-2">
            {justifs.map((j) => (
              <li key={j.title} className={`flex items-start gap-3 rounded-lg p-2.5 ${j.box}`}>
                <span className={`w-9 h-9 rounded-full ${j.bg} text-white flex items-center justify-center shrink-0`}>
                  <j.Icon size={16} />
                </span>
                <div className="min-w-0 text-[10px]">
                  <p className="font-bold text-xs">{j.title}</p>
                  <p className="text-gray-600">{j.text}</p>
                  <p className="text-gray-400 mt-0.5">Source : {j.source}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommandations IA */}
        <div className={`${card} p-4 xl:col-span-2`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-[#f59e0b]" /> Recommandations de l'IA
          </h3>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-[#0f9d78] py-4">
              <CheckCircle2 size={16} /> Aucune alerte : les données actuelles ne signalent pas de point d'attention.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {alerts.map((a, i) => {
                const { c, Icon, tc } = lvlStyle[a.lvl];
                return (
                  <div key={i} className="border rounded-xl p-3 flex items-start gap-2 text-[11px] bg-[#f8fafd]">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${c}`}>
                      <Icon size={16} />
                    </span>
                    <div>
                      <p className={`font-semibold ${tc}`}>{a.t}</p>
                      <p className="text-gray-600">{a.s}</p>
                      {a.a && (
                        <p className="text-[#1255d6] font-semibold mt-1 flex items-center gap-1">
                          <ArrowRight size={10} />
                          {a.a}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ligne 3 : Data Analysis | AI Security | Assistant Aina */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Data Analysis : statuts */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-[#1255d6]" /> Data Analysis — Réservations & paiements
          </h3>
          {reservation.length === 0 ? (
            <Empty text="Aucune réservation enregistrée." h={200} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-1">Statut des réservations</p>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={statusStats} dataKey="value" innerRadius={30} outerRadius={55} stroke="#fff">
                      {statusStats.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(v: number | string, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="text-[10px] space-y-1">
                  {statusStats.map((s) => (
                    <li key={s.name} className="flex items-center gap-1.5">
                      <i className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 truncate">{s.name}</span><b>{s.value}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-1">État des paiements (hors annulées)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={payStatusStats} margin={{ left: -25, top: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar dataKey="value" name="Réservations" radius={[3, 3, 0, 0]}>
                      {payStatusStats.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-[10px] space-y-0.5 mt-1">
                  <p>Encaissé : <b className="text-[#0f9d78]">{formatCurrency(paid)}</b></p>
                  <p>Reste dû : <b className="text-[#e5342f]">{formatCurrency(unpaid)}</b></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Security */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-1">
            <ShieldAlert size={16} className="text-[#e5342f]" /> AI Security — Opérations de caisse atypiques
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">
            Règle : dépense supérieure à la moyenne + 2 écarts-types. L'IA signale, le backend décide.
          </p>
          {!anomalies.enough ? (
            <Empty text={`Au moins 5 dépenses sont nécessaires pour détecter des anomalies (actuellement ${debitOps}).`} h={140} />
          ) : anomalies.list.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-[#0f9d78] py-6">
              <CheckCircle2 size={16} /> Aucune dépense atypique sur {debitOps} opération(s). Seuil : {formatCurrency(anomalies.limit)}.
            </div>
          ) : (
            <ul className="space-y-2">
              {anomalies.list.map((a, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg p-2.5 bg-[#fff1f1] text-[10px]">
                  <AlertTriangle size={14} className="text-[#e5342f] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs truncate">{a.label}</p>
                    <p className="text-gray-600">
                      {formatCurrency(a.amount)} · {a.z.toFixed(1).replace(".", ",")} écarts-types au-dessus de la moyenne ({formatCurrency(anomalies.mean)})
                    </p>
                    {a.date && <p className="text-gray-400">{a.date.toLocaleDateString("fr-FR")}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {currentUser?.role === "Propriétaire" && (
            <button
              type="button"
              onClick={() => onSetToAudit("Audit")}
              className="mt-3 w-full flex items-center justify-center gap-2 border border-[#1255d6] text-[#1255d6] hover:bg-[#eef4ff] text-[11px] font-semibold rounded-md py-1.5"
            >
              <ShieldCheck size={13} /> Ouvrir les Audit Logs
            </button>
          )}
        </div>

        {/* Assistant Aina */}
        <div className={`${card} p-4 flex flex-col`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-[#7c3aed]" /> Aina — Assistante IA
          </h3>
          <p className="text-[10px] text-gray-500 mb-2">Posez une question : la réponse s'appuie uniquement sur les données de SAINT-JUDE.</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={asking || !hasData}
                onClick={() => { setQuestion(s); ask(s); }}
                className="text-[10px] px-2 py-1 rounded-full border border-[#dbe5f5] bg-[#f8fafd] hover:bg-[#eef4ff] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={onAsk} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex. : Pourquoi les revenus ont-ils diminué ?"
              className="flex-1 bg-[#f8fafd] border border-[#dbe5f5] rounded-full px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={asking || !question.trim() || !hasData}
              aria-label="Envoyer la question"
              className="w-9 h-9 rounded-full bg-[#1255d6] hover:bg-[#0e45b3] text-white flex items-center justify-center disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
          <div className="mt-3 flex-1 rounded-lg bg-[#f5f0ff] p-3 text-[11px] text-gray-700 min-h-[90px]">
            {asking ? "Aina analyse vos données…" : answer ?? (hasData ? "La réponse apparaîtra ici." : "Aucune donnée à analyser pour le moment.")}
          </div>
        </div>
      </div>

      {/* Bandeau bas */}
      <div className="rounded-xl bg-[#0b2a6b] text-white px-5 py-3 flex flex-wrap items-center gap-4 text-[11px]">
        <Brain size={26} />
        <p>
          <b className="text-sm">SAINT-JUDE AI</b> — Plus qu'un outil : un assistant qui explique, justifie et vous aide à décider.
        </p>
        <span className="ml-auto flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5">
          <i className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Base Neon · actualisé {updatedLabel}
        </span>
        <button
          onClick={exportReport}
          className="flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5 hover:bg-white/10"
        >
          <Download size={14} /> Exporter le rapport
        </button>
      </div>
    </div>
  );
};

export default Dashboard;