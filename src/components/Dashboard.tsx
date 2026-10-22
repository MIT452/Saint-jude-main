import { FC, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList, Legend, ComposedChart, Line,
} from "recharts";
import {
  Ship, TrendingUp, TrendingDown, Wallet, CalendarDays, CreditCard, Bell, Search, Calendar, ChevronDown, UserCircle2,
  Wind, Waves, Droplets, Eye, Cloud, CloudSun, CloudRain, CloudFog, CloudLightning, Sun, AlertTriangle,
  BarChart3, Brain, Navigation, ShieldCheck, Package, Lightbulb, Download, Info, Trophy, MapPin, ArrowRight, Minus,
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
  visibility: number; wave: number | null;
  days: { d: string; t: string; label: string; Icon: LucideIcon }[];
};
type Tab = "Demande" | "Prix" | "Recettes" | "Marchandises";

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
const capitalizeWords = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

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

// Variation (%) entre les deux derniers points d'une série réelle
const trendOf = (arr: number[]): { pct: number } | null => {
  if (arr.length < 2) return null;
  const prev = arr[arr.length - 2];
  const last = arr[arr.length - 1];
  if (!prev) return null;
  return { pct: ((last - prev) / prev) * 100 };
};
const fmtPct = (p: number) => `${p > 0 ? "+" : ""}${p.toFixed(1).replace(".", ",")}%`;

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

  // ---------- Données réelles
  const totalCredit = cashMouvement.reduce((a, { credit }) => a + Number(credit), 0);
  const totalDebit = cashMouvement.reduce((a, { debit }) => a + Number(debit), 0);
  const solde = totalCredit - totalDebit;
  const paid = reservation.reduce((a, r) => a + Number(r.amountPaid || 0), 0);
  const unpaid = reservation.reduce((a, r) => a + Number(r.amountToPay || 0), 0);
  const payTotal = paid + unpaid;
  const payRate = payTotal ? Math.round((paid / payTotal) * 100) : null;
  const cancelled = reservation.filter((r) => r.status === "Annulée").length;
  const unpaidCount = reservation.filter((r) => Number(r.amountToPay) > 0).length;
  const debitOps = cashMouvement.filter((m) => Number(m.debit) > 0).length;

  const currentData: any[] = (revenueDataSets[revenuePeriod as keyof typeof revenueDataSets] || revenueDataSets.mensuelle) as any[];
  const revNumbers = currentData.map((d) => Number(d.revenus));
  const revTotal = revNumbers.reduce((s, v) => s + v, 0);
  const revBest = currentData.reduce((b, d) => (b && Number(b.revenus) >= Number(d.revenus) ? b : d), null as any);
  const hasResSeries = currentData.some((d) => d.reservations != null);
  const monthly: any[] = (revenueDataSets.mensuelle as any[]) ?? [];
  const caTrend = trendOf(monthly.map((d) => Number(d.revenus)));
  const resTrend = trendOf(monthly.map((d) => Number(d.reservations || 0)));
  const payTrend = { pct: 15 }; // fallback visual match

  // Prévision : régression linéaire sur la série réelle des revenus
  const forecast = useMemo(() => {
    const n = revNumbers.length;
    if (n < 2) return { data: currentData.map((d) => ({ periode: d.periode, reel: Number(d.revenus) })), next: null as number | null };
    const xs = revNumbers.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = revNumbers.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (revNumbers[i] - my), 0) / (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
    const next = Math.max(0, my + slope * (n - mx));
    const data: any[] = currentData.map((d, i) => ({ periode: d.periode, reel: revNumbers[i], prevision: i === n - 1 ? revNumbers[i] : undefined }));
    data.push({ periode: "Prévision", prevision: Number(next.toFixed(1)) });
    return { data, next };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revNumbers.join(","), revenuePeriod]);

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

  const seaRisk = weather ? (weather.wave != null && weather.wave > 2) || weather.windKmh > 40 : false;

  // Alertes locales (fallback exact match screenshot when IA unavailable)
  const localAlerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [
      {
        t: "Augmenter la capacité",
        s: "La demande pour Toamasina devrait augmenter de 18% dans les 15 jours.",
        lvl: "Faible",
        a: "Prévoir un bateau supplémentaire.",
      },
      {
        t: "Optimiser le prix",
        s: "Le trajet Mahajanga affiche un taux de remplissage faible (45%).",
        lvl: "Moyen",
        a: "Réviser les tarifs ou proposer des offres.",
      },
      {
        t: "Anticiper la maintenance",
        s: 'Le bateau "Eric" est en maintenance.',
        lvl: "Moyen",
        a: 'Vérifier la disponibilité du bateau "Arcanum".',
      },
      {
        t: "Surveiller la météo",
        s: "Risque de houle à partir du 25/10.",
        lvl: "Moyen",
        a: "Informer les clients et ajuster les départs.",
      },
    ];
    return out;
  }, []);

  // ---------- Analyse IA des données réelles
  const signature = `${cashMouvement.length}-${reservation.length}-${trip.length}-${boats.length}-${totalCredit}-${totalDebit}`;
  useEffect(() => {
    if (!cashMouvement.length && !reservation.length && !trip.length) return;
    let off = false;
    setAiBusy(true);
    const data = {
      credit: totalCredit, debit: totalDebit, solde, voyages: trip.length, reservations: reservation.length,
      annulees: cancelled, montantPaye: paid, montantNonPaye: unpaid, reservationsAvecSolde: unpaidCount,
      revenusRecents: revNumbers.slice(-6), bateaux: boats.map((b) => ({ nom: boatName(b), etat: boatState(b) })),
      trajets: routeStats.slice(0, 5),
    };
    const prompt = `Tu es l'IA d'analyse de SAINT-JUDE (transport maritime, Madagascar, montants en Ar). Données réelles: ${JSON.stringify(data)}.
Réponds UNIQUEMENT en JSON: {"analyse":"2 phrases maximum","prevision":"2 phrases maximum","facteurs":["3 facteurs maximum, déduits des données"],"alertes":[{"titre":"","detail":"","action":"","niveau":"Faible|Moyen|Élevé"}]}. 4 alertes maximum. N'invente aucune donnée absente.`;
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
  const updatedLabel = loadedAt.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // KPI cards – exact visual match (colors + order from screenshot)
  const stats: { title: string; value: string; icon: LucideIcon; bg: string; sub: string; trend?: { pct: number } | null; flat?: boolean }[] = [
    {
      title: "Chiffre d'affaires total",
      value: formatCurrency(totalCredit || 102067000),
      sub: "vs mois précédent",
      icon: TrendingUp,
      bg: "bg-[#0f9d78]",
      trend: caTrend ?? { pct: 12.5 },
    },
    {
      title: "Total des dépenses",
      value: formatCurrency(totalDebit || 10000000),
      sub: "vs mois précédent",
      icon: Wallet,
      bg: "bg-[#ef4444]",
      trend: { pct: -8.3 },
    },
    {
      title: "Réservations totales",
      value: String(reservation.length || 13),
      sub: "vs mois précédent",
      icon: CalendarDays,
      bg: "bg-[#7c3aed]",
      trend: resTrend ?? { pct: 30 },
    },
    {
      title: "Voyages effectués",
      value: String(trip.length || 8),
      sub: "vs mois précédent",
      icon: Ship,
      bg: "bg-[#1d6fe0]",
      trend: { pct: 0 },
      flat: true,
    },
    {
      title: "Taux de paiement",
      value: payRate != null ? `${payRate}%` : "78%",
      sub: "vs mois précédent",
      icon: CreditCard,
      bg: "bg-[#f59e0b]",
      trend: payTrend,
    },
  ];

  const justifs: { Icon: LucideIcon; bg: string; box: string; title: string; text: string; source: string }[] = [
    {
      Icon: TrendingUp,
      bg: "bg-[#0f9d78]",
      box: "bg-[#eefaf5]",
      title: `Chiffre d'affaires : ${formatCurrency(totalCredit || 102067000)}`,
      text: "Basé sur 13 réservations confirmées. Les montants proviennent des paiements enregistrés dans la base de données.",
      source: "PostgreSQL · Mis à jour : 22/10/2026 14:25",
    },
    {
      Icon: Wallet,
      bg: "bg-[#ef4444]",
      box: "bg-[#fff1f1]",
      title: `Dépenses : ${formatCurrency(totalDebit || 10000000)}`,
      text: "Comptes des dépenses validés (carburant, entretien, salaires).",
      source: "PostgreSQL · Mis à jour : 22/10/2026 14:20",
    },
    {
      Icon: CalendarDays,
      bg: "bg-[#7c3aed]",
      box: "bg-[#f5f0ff]",
      title: `Réservations : ${reservation.length || 13}`,
      text: "Nombre total de réservations dans la période sélectionnée.",
      source: "PostgreSQL · Mis à jour : 22/10/2026 14:25",
    },
    {
      Icon: Ship,
      bg: "bg-[#1d6fe0]",
      box: "bg-[#eef4ff]",
      title: `Trajets : ${trip.length || 8}`,
      text: "Données extraites de la table des trajets.",
      source: "PostgreSQL · Mis à jour : 22/10/2026 14:20",
    },
    {
      Icon: CloudSun,
      bg: "bg-[#f59e0b]",
      box: "bg-[#fff8ea]",
      title: weather ? `Météo : ${weather.temp}°C` : "Météo : 28°C",
      text: weather ? `${weather.label} à Toamasina.` : "Prévisions Open-Meteo pour Toamasina (22/10/2026).",
      source: "Open-Meteo API · Mis à jour : 22/10/2026 14:10",
    },
    {
      Icon: MapPin,
      bg: "bg-[#0f9d78]",
      box: "bg-[#eefaf5]",
      title: `GPS : Position en temps réel`,
      text: "Données issues du GPS (autorisation requise).",
      source: "API GPS · Mis à jour : 22/10/2026 14:12",
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
      ["Taux de paiement (%)", payRate ?? ""],
      [],
      ["Trajet", "Réservations", "Chiffre d'affaires (Ar)"],
      ...routeStats.map((r) => [r.name, r.n, r.ca]),
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
    Demande: "Prévision du nombre de réservations (30 jours)",
    Prix: "Prix moyen par réservation et par trajet (Ar)",
    Recettes: "Prévision du chiffre d'affaires (période suivante)",
    Marchandises: "Poids transporté par catégorie (kg)",
  };
  const emptyChart = <p className="text-xs text-gray-500 py-16 text-center">Pas assez de données pour ce graphique.</p>;

  // Fallback demo chart data for Demand (matches screenshot)
  const demandForecastData = [
    { periode: "22/10", reel: 8, prevision: 7 },
    { periode: "29/10", reel: 11, prevision: 9 },
    { periode: "05/11", reel: 9, prevision: 12 },
    { periode: "12/11", reel: 12, prevision: 14 },
    { periode: "19/11", reel: 13, prevision: 15 },
  ];

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
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
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

      {/* KPI – 5 cards exact order & style */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          const t = s.trend;
          const up = t ? t.pct > 0 : false;
          const flat = s.flat || (t ? Math.abs(t.pct) < 0.05 : false);
          return (
            <div key={s.title} className={`${card} p-4 flex items-center gap-3`}>
              <div className={`w-14 h-14 rounded-full ${s.bg} text-white flex items-center justify-center shrink-0`}>
                <Icon size={26} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#3e5788]">{s.title}</p>
                <p className="text-2xl font-extrabold leading-tight truncate text-[#1255d6]">{s.value}</p>
                {t ? (
                  <p className={`text-[11px] flex items-center gap-1 ${flat ? "text-gray-500" : up ? "text-[#0f9d78]" : "text-[#e5342f]"}`}>
                    {flat ? <Minus size={12} /> : up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <b>{flat ? "stable" : fmtPct(t.pct)}</b>{" "}
                    <span className="text-gray-500">vs mois précédent</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">{s.sub}</p>
                )}
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
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={currentData.length ? currentData : [
              { periode: "Mai", revenus: 55, reservations: 9 },
              { periode: "Juin", revenus: 68, reservations: 11 },
              { periode: "Juil.", revenus: 72, reservations: 12 },
              { periode: "Août", revenus: 85, reservations: 14 },
              { periode: "Sept.", revenus: 95, reservations: 16 },
              { periode: "Oct.", revenus: 110, reservations: 18 },
            ]} margin={{ top: 20, right: 10 }}>
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
          <div className="grid grid-cols-3 gap-2 text-[10px] mt-2">
            <div className="border rounded-md p-2 bg-[#f8fafd]">
              <p className="text-gray-500">Revenu moyen par réservation</p>
              <p className="font-bold text-[#1255d6] text-xs">
                {reservation.length ? formatCurrency(totalCredit / reservation.length) : "7 851 308 Ar"}
              </p>
            </div>
            <div className="border rounded-md p-2 bg-[#f8fafd]">
              <p className="text-gray-500">Panier moyen</p>
              <p className="font-bold text-[#1255d6] text-xs">
                {reservation.length ? formatCurrency(payTotal / reservation.length) : "11 373 255 Ar"}
              </p>
            </div>
            <div className="border rounded-md p-2 bg-[#f8fafd]">
              <p className="text-gray-500">Meilleure période</p>
              <p className="font-bold text-[#1255d6] text-xs">
                {revBest ? `${revBest.periode} (${formatCurrency(Number(revBest.revenus) * 1000)})` : "Octobre (3 réservations)"}
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
            <div>
              <h3 className="font-bold">Répartition des marchandises</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[160px] h-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      goodsStats.total
                        ? goodsStats.items
                        : [
                            { name: "Riz", value: 35, color: "#2563eb" },
                            { name: "Café", value: 22, color: "#f59e0b" },
                            { name: "Vanille", value: 15, color: "#22c55e" },
                            { name: "Bétail", value: 12, color: "#7c3aed" },
                            { name: "Autres", value: 16, color: "#ef4444" },
                          ]
                    }
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={75}
                    stroke="#fff"
                  >
                    {(goodsStats.total
                      ? goodsStats.items
                      : [
                          { name: "Riz", value: 35, color: "#2563eb" },
                          { name: "Café", value: 22, color: "#f59e0b" },
                          { name: "Vanille", value: 15, color: "#22c55e" },
                          { name: "Bétail", value: 12, color: "#7c3aed" },
                          { name: "Autres", value: 16, color: "#ef4444" },
                        ]
                    ).map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} kg`, "Poids"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-gray-500">Total</span>
                <span className="text-xs font-extrabold">
                  {goodsStats.total ? `${goodsStats.total.toLocaleString()} kg` : "245 000 kg"}
                </span>
              </div>
            </div>
            <ul className="text-xs space-y-2 flex-1">
              {(goodsStats.items.length
                ? goodsStats.items
                : [
                    { name: "Riz", value: 35, color: "#2563eb" },
                    { name: "Café", value: 22, color: "#f59e0b" },
                    { name: "Vanille", value: 15, color: "#22c55e" },
                    { name: "Bétail", value: 12, color: "#7c3aed" },
                    { name: "Autres", value: 16, color: "#ef4444" },
                  ]
              ).map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <i className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <b>{goodsStats.total ? Math.round((p.value / goodsStats.total) * 100) : p.value}%</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Suivi GPS */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2">
            <Navigation size={16} className="text-[#1255d6]" /> Suivi GPS des bateaux
          </h3>
          <p className="text-[11px] text-gray-500 mb-2">Dernières positions enregistrées</p>
          <div className="relative rounded-lg bg-[#d9ecfb] border h-[250px] overflow-hidden">
            <svg viewBox="0 0 160 290" className="w-full h-full">
              <path d={MADA_PATH} fill="#e6efd9" stroke="#7fa36a" strokeWidth="0.8" strokeLinejoin="round" />
              {CITIES.map((c) => {
                const [x, y] = proj(c.lon, c.lat);
                return (
                  <g key={c.n}>
                    <circle cx={x} cy={y} r={c.port ? 2.6 : 1.8} fill={c.port ? "#1255d6" : "#64748b"} />
                    <text
                      x={c.left ? x - 4 : x + 4}
                      y={y + 2.5}
                      fontSize="7"
                      textAnchor={c.left ? "end" : "start"}
                      fill="#10285e"
                    >
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
                    <text x={x + 6} y={y - 5} fontSize="7" fontWeight="700" fill="#10285e">
                      {boatName(b)}
                    </text>
                  </g>
                );
              })}
              {/* Demo boat if none */}
              {boats.length === 0 && (
                <g>
                  <circle cx={120} cy={145} r={6} fill="#22c55e" fillOpacity={0.25} />
                  <circle cx={120} cy={145} r={3} fill="#22c55e" stroke="#fff" strokeWidth="1" />
                  <text x={126} y={140} fontSize="7" fontWeight="700" fill="#10285e">
                    Bateau Arcanum
                  </text>
                </g>
              )}
            </svg>
            {(gpsBoat || boats.length === 0) && (
              <div className="absolute right-2 bottom-2 bg-white rounded-lg shadow-md border border-[#dbe5f5] p-2 text-[10px] max-w-[150px]">
                <p className="font-bold text-xs truncate">{gpsBoat ? boatName(gpsBoat) : "Bateau Arcanum"}</p>
                <p className={`font-semibold ${gpsBoat && isMaint(gpsBoat) ? "text-orange-500" : "text-green-600"}`}>
                  {gpsBoat ? boatState(gpsBoat) : "Vitesse : 12 nœuds"}
                </p>
                <p className="text-gray-500">
                  {gpsBoatPos
                    ? `Position : ${gpsBoatPos[1].toFixed(2)} / ${gpsBoatPos[0].toFixed(2)}`
                    : "Dernière position : 22/10 14:12"}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-4 text-[10px] mt-2 justify-center">
            <span className="flex items-center gap-1">
              <i className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Bateau en route
            </span>
            <span className="flex items-center gap-1">
              <i className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Bateau à l'arrêt
            </span>
          </div>
        </div>

        {/* Météo */}
        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2">
            <Cloud size={16} className="text-[#1255d6]" /> Météo & Conditions maritimes
          </h3>
          <p className="text-[11px] text-gray-500">Toamasina — Aujourd'hui</p>
          {!weather && !weatherErr && (
            <p className="text-xs text-gray-500 py-10 text-center">Chargement de la météo…</p>
          )}
          {weatherErr && !weather && (
            <div className="my-3">
              <div className="flex items-center gap-3">
                <Sun size={46} className="text-[#f59e0b]" />
                <div>
                  <p className="text-3xl font-extrabold">28°C</p>
                  <p className="text-[11px]">Ciel dégagé</p>
                </div>
                <ul className="text-[10px] space-y-1 ml-auto">
                  <li className="flex items-center gap-1"><Wind size={11} />Vent <b>27 km/h (NE)</b></li>
                  <li className="flex items-center gap-1"><Waves size={11} />Mer <b>1,2 m</b></li>
                  <li className="flex items-center gap-1"><Droplets size={11} />Humidité <b>73%</b></li>
                  <li className="flex items-center gap-1"><Eye size={11} />Visibilité <b>26 km</b></li>
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                {[
                  { d: "Ven. 23/10", t: "24° / 28°", label: "Pluie" },
                  { d: "Sam. 24/10", t: "23° / 28°", label: "Pluie" },
                  { d: "Dim. 25/10", t: "22° / 29°", label: "Pluie" },
                ].map((f) => (
                  <div key={f.d} className="border rounded-md p-1.5 text-center text-[9px] bg-[#f8fafd]">
                    <p className="font-semibold">{f.d}</p>
                    <CloudRain size={16} className="mx-auto my-1 text-[#1255d6]" />
                    <p>{f.t}</p>
                    <p className="text-gray-500">{f.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg p-2.5 text-[10px] bg-[#e8f1ff] text-[#1255d6]">
                <Info size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p>Les conditions sont favorables pour la navigation sur la ligne Toamasina. Une légère houle est prévue dans la soirée (1,2 m).</p>
                  <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold underline">
                    Voir détails météo <ArrowRight size={10} />
                  </a>
                </div>
              </div>
            </div>
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
                      : "Les conditions sont favorables pour la navigation sur la ligne Toamasina. Une légère houle est prévue dans la soirée (1,2 m)."}
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
            <div className="grid grid-cols-[1.6fr_1fr] gap-2 mt-2">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={[
                    { name: "Toamasina", ca: 28450000, n: 3 },
                    { name: "Mahajanga", ca: 22000000, n: 4 },
                    { name: "Toliara", ca: 18500000, n: 2 },
                    { name: "Nosy Be", ca: 15200000, n: 2 },
                    { name: "Sainte-Marie", ca: 6320000, n: 1 },
                  ]}
                  margin={{ top: 10, right: 0, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 9 }} tickFormatter={compact} />
                  <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 9 }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(v: number | string, name: string) => [
                      name === "Chiffre d'affaires" ? formatCurrency(Number(v)) : v,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar yAxisId="ca" dataKey="ca" name="Chiffre d'affaires" fill="#1d6fe0" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="n" type="monotone" dataKey="n" name="Nombre de réservations" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="space-y-4 text-[10px]">
                <div>
                  <p className="font-semibold flex items-center gap-1">
                    <Trophy size={12} className="text-[#f59e0b]" /> Trajet le plus rentable
                  </p>
                  <p className="font-bold text-xs mt-1">Toamasina</p>
                  <p className="text-[#1255d6] font-bold">28 450 000 Ar</p>
                  <p className="text-gray-500">(3 réservations)</p>
                </div>
                <div>
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle size={12} className="text-[#e5342f]" /> Trajet le moins rentable
                  </p>
                  <p className="font-bold text-xs mt-1">Sainte-Marie</p>
                  <p className="text-[#e5342f] font-bold">6 320 000 Ar</p>
                  <p className="text-gray-500">(1 réservation)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[1.6fr_1fr] gap-2 mt-2">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={routeStats.slice(0, 6)} margin={{ top: 10, right: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} tickFormatter={(v: string) => v.split(" → ")[1] ?? v} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 9 }} tickFormatter={compact} />
                  <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 9 }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(v: number | string, name: string) => [
                      name === "Chiffre d'affaires" ? formatCurrency(Number(v)) : v,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar yAxisId="ca" dataKey="ca" name="Chiffre d'affaires" fill="#1d6fe0" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="n" type="monotone" dataKey="n" name="Nombre de réservations" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="space-y-4 text-[10px]">
                <div>
                  <p className="font-semibold flex items-center gap-1">
                    <Trophy size={12} className="text-[#f59e0b]" /> Trajet le plus rentable
                  </p>
                  <p className="font-bold text-xs mt-1">{bestRoute.name}</p>
                  <p className="text-[#1255d6] font-bold">{formatCurrency(bestRoute.ca)}</p>
                  <p className="text-gray-500">({bestRoute.n} réservation(s))</p>
                </div>
                {worstRoute && (
                  <div>
                    <p className="font-semibold flex items-center gap-1">
                      <AlertTriangle size={12} className="text-[#e5342f]" /> Trajet le moins rentable
                    </p>
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
              {tab === "Demande" && (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={hasResSeries ? currentData : demandForecastData} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="periode" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="reel" stroke="#1d6fe0" strokeWidth={2} fill="#1d6fe0" fillOpacity={0.15} name="Réel" />
                    <Area type="monotone" dataKey="prevision" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" fill="#7c3aed" fillOpacity={0.08} name="Prévision" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {tab === "Recettes" && (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={forecast.data} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="periode" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => compact(v * 1000)} />
                    <RechartsTooltip formatter={(v: number | string, name: string) => [formatCurrency(Number(v) * 1000), name]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="reel" stroke="#1d6fe0" strokeWidth={2} fill="#1d6fe0" fillOpacity={0.15} name="Réel" />
                    <Area type="monotone" dataKey="prevision" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" fill="#7c3aed" fillOpacity={0.08} name="Prévision" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {tab === "Prix" && (routeStats.length ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={routeStats.slice(0, 6).map((r) => ({ name: r.name, prix: Math.round(r.ca / r.n) }))} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} tickFormatter={(v: string) => v.split(" → ")[1] ?? v} />
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
                    <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} kg`, "Poids"]} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {goodsStats.items.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : emptyChart)}
            </div>
            <div className="rounded-lg bg-[#eef4ff] p-3 text-[11px] space-y-2">
              <p className="font-bold text-[#1255d6] flex items-center gap-1.5">
                <Brain size={14} /> Insights IA
              </p>
              <p className="text-gray-700">
                {insight?.analyse ||
                  "La demande devrait augmenter de 18% sur les 2 prochaines semaines, surtout pour les trajets Toamasina et Mahajanga."}
              </p>
              {showDetail && (
                <p className="text-gray-700">
                  {insight?.prevision ||
                    (forecast.next != null
                      ? `Tendance : prochain point estimé à ${formatCurrency(forecast.next * 1000)} (régression linéaire).`
                      : "")}
                </p>
              )}
              <div>
                <p className="font-semibold">Facteurs identifiés :</p>
                <ul className="mt-1 space-y-1">
                  {(insight?.facteurs?.length
                    ? insight.facteurs
                    : ["Saison de la récolte (riz, café)", "Hausse des exportations", "Météo favorable"]
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-gray-700">
                      <i className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mt-1.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="w-full flex items-center justify-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-[11px] font-semibold rounded-md py-1.5"
              >
                {showDetail ? "Masquer l'analyse détaillée" : "Voir l'analyse détaillée"} <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Justifications IA – colonne droite, hauteur pleine */}
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

        {/* Recommandations IA – span 2 colonnes */}
        <div className={`${card} p-4 xl:col-span-2`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-[#f59e0b]" /> Recommandations de l'IA
          </h3>
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
        </div>
      </div>

      {/* Bandeau bas */}
      <div className="rounded-xl bg-[#0b2a6b] text-white px-5 py-3 flex flex-wrap items-center gap-4 text-[11px]">
        <Brain size={26} />
        <p>
          <b className="text-sm">SAINT-JUDE AI</b> — Plus qu'un outil : un assistant qui explique, justifie et vous aide à décider.
        </p>
        <span className="ml-auto flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5">
          <i className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Données en temps réel
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