import { FC, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList, Legend, ComposedChart, Line,
} from "recharts";
import {
  Ship, TrendingUp, Wallet, CalendarDays, CreditCard, Bell, Search, Calendar, ChevronDown, UserCircle2,
  Wind, Waves, Droplets, Eye, Cloud, CloudSun, CloudRain, CloudFog, CloudLightning, Sun, AlertTriangle,
  BarChart3, Brain, Navigation, ShieldCheck, Package, Lightbulb, Download, Info, Trophy, MapPin,
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
type Alert = { t: string; s: string; lvl: Level };
type Insight = { analyse: string; prevision: string; alertes: Alert[] };
type Weather = {
  temp: number; label: string; Icon: LucideIcon; wind: string; windKmh: number; humidity: number;
  visibility: number; wave: number | null;
  days: { d: string; t: string; label: string; Icon: LucideIcon }[];
};

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

const Dashboard: FC<PropsDashboard> = ({ onSetToAudit }) => {
  const [revenuePeriod, setRevenuePeriod] = useState("mensuelle");
  const [revenueDataSets, setRevenueDataSets] = useState<RevenueDataSets>(revenueDataSetsVoid);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherErr, setWeatherErr] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [loadedAt] = useState(() => new Date());

  const cashMouvement = useSelector((state: RootState) => state.stJude.cashMouvement);
  const trip = useSelector((state: RootState) => state.stJude.trip);
  const reservation = useSelector((state: RootState) => state.stJude.reservation) as any[];
  const boats = useSelector((state: RootState) => ((state.stJude as any).boat ?? (state.stJude as any).boats ?? []) as any[]);
  const goods = useSelector(
    (state: RootState) =>
      ((state.stJude as any).goods ?? (state.stJude as any).goodsList ?? (state.stJude as any).marchandise ?? []) as any[],
  );
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

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
  const revAvg = revNumbers.length ? revTotal / revNumbers.length : 0;
  const revBest = currentData.reduce((b, d) => (b && Number(b.revenus) >= Number(d.revenus) ? b : d), null as any);

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

  // Alertes locales calculées sur les vraies données (repli si l'IA est indisponible)
  const localAlerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    if (unpaidCount > 0) out.push({ t: "Paiements en attente", s: `${unpaidCount} réservation(s) avec un solde à payer : ${formatCurrency(unpaid)}`, lvl: "Moyen" });
    boats.filter((b) => /maint/i.test(boatState(b))).forEach((b) => out.push({ t: "Bateau en maintenance", s: `${boatName(b)} est en maintenance. Vérifiez sa disponibilité avant de planifier un voyage.`, lvl: "Moyen" }));
    if (solde < 0) out.push({ t: "Solde net négatif", s: `Les débits dépassent les crédits de ${formatCurrency(Math.abs(solde))}`, lvl: "Élevé" });
    if (worstRoute && bestRoute && worstRoute.ca < bestRoute.ca * 0.25) {
      out.push({ t: "Trajet peu rentable", s: `${worstRoute.name} : ${formatCurrency(worstRoute.ca)} pour ${worstRoute.n} réservation(s).`, lvl: "Faible" });
    }
    return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpaidCount, unpaid, boats, solde, routeStats]);

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
Réponds UNIQUEMENT en JSON: {"analyse":"2 phrases maximum","prevision":"2 phrases maximum","alertes":[{"titre":"","detail":"","niveau":"Faible|Moyen|Élevé"}]}. 4 alertes maximum. N'invente aucune donnée absente.`;
    askAIJson<{ analyse: string; prevision: string; alertes: { titre: string; detail: string; niveau: string }[] }>(prompt).then((r) => {
      if (off) return;
      if (r && typeof r.analyse === "string") {
        setInsight({
          analyse: r.analyse,
          prevision: r.prevision ?? "",
          alertes: (r.alertes ?? []).slice(0, 4).map((a) => ({ t: a.titre, s: a.detail, lvl: (["Faible", "Moyen", "Élevé"].includes(a.niveau) ? a.niveau : "Moyen") as Level })),
        });
      } else setInsight(null);
      setAiBusy(false);
    });
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
            return { d: dt.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }), t: `${Math.round(f.daily.temperature_2m_min[i])}° / ${Math.round(f.daily.temperature_2m_max[i])}°`, label: x.label, Icon: x.Icon };
          }),
        });
      } catch {
        if (!off) setWeatherErr(true);
      }
    })();
    return () => { off = true; };
  }, []);

  const seaRisk = weather ? (weather.wave != null && weather.wave > 2) || weather.windKmh > 40 : false;
  const boatsWithGps = boats.filter((b) => boatPos(b)).length;
  const updatedLabel = loadedAt.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const stats = [
    { title: "Chiffre d'affaires total", value: formatCurrency(totalCredit), sub: "Total encaissé", icon: TrendingUp, bg: "bg-[#0f9d78]" },
    { title: "Total des dépenses", value: formatCurrency(totalDebit), sub: "Total dépensé", icon: Wallet, bg: "bg-[#ef4444]" },
    { title: "Réservations totales", value: String(reservation.length), sub: `dont ${cancelled} annulée(s)`, icon: CalendarDays, bg: "bg-[#7c3aed]" },
    { title: "Voyages effectués", value: String(trip.length), sub: "Voyages enregistrés", icon: Ship, bg: "bg-[#1d6fe0]" },
    { title: "Taux de paiement", value: payRate != null ? `${payRate}%` : "—", sub: `${unpaidCount} réservation(s) avec solde`, icon: CreditCard, bg: "bg-[#f59e0b]" },
  ];

  const justifs: { Icon: LucideIcon; bg: string; box: string; title: string; text: string; source: string }[] = [
    { Icon: TrendingUp, bg: "bg-[#0f9d78]", box: "bg-[#eefaf5]", title: `Chiffre d'affaires : ${formatCurrency(totalCredit)}`, text: `Somme des crédits de la caisse (${cashMouvement.length} mouvement(s)). ${reservation.length} réservation(s) enregistrée(s).`, source: "Base de données SAINT-JUDE" },
    { Icon: Wallet, bg: "bg-[#ef4444]", box: "bg-[#fff1f1]", title: `Dépenses : ${formatCurrency(totalDebit)}`, text: `Somme des débits de la caisse (${debitOps} opération(s)).`, source: "Base de données SAINT-JUDE" },
    { Icon: CalendarDays, bg: "bg-[#7c3aed]", box: "bg-[#f5f0ff]", title: `Réservations : ${reservation.length}`, text: `Nombre de réservations enregistrées, dont ${cancelled} annulée(s).`, source: "Base de données SAINT-JUDE" },
    { Icon: Ship, bg: "bg-[#1d6fe0]", box: "bg-[#eef4ff]", title: `Trajets : ${trip.length}`, text: "Voyages enregistrés dans la table des trajets.", source: "Base de données SAINT-JUDE" },
    { Icon: CloudSun, bg: "bg-[#f59e0b]", box: "bg-[#fff8ea]", title: weather ? `Météo : ${weather.temp}°C` : "Météo", text: weather ? `${weather.label} à Toamasina, vent ${weather.wind}.` : "Données météo indisponibles pour le moment.", source: "Open-Meteo API" },
    { Icon: MapPin, bg: "bg-[#0f9d78]", box: "bg-[#eefaf5]", title: `GPS : ${boatsWithGps}/${boats.length} bateau(x)`, text: "Bateaux dont la position GPS est renseignée.", source: "Positions enregistrées" },
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

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const roleLabel = currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.role ?? "Admin";

  return (
    <div className="p-5 bg-[#f3f7fd] min-h-full space-y-4 text-[#10285e]">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Rechercher une réservation, un bateau, un client, un trajet..." className="w-full bg-white border border-[#dbe5f5] rounded-full pl-9 pr-3 py-2 text-xs" />
        </div>
        {currentUser?.role === "Propriétaire" && (
          <button onClick={() => onSetToAudit("Audit")} className="flex items-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-xs font-semibold px-4 py-2 rounded-full">
            <ShieldCheck size={16} /> Audit Logs
          </button>
        )}
        <div className="w-10 h-10 bg-white border border-[#dbe5f5] rounded-full flex items-center justify-center">
          <Bell size={18} />
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#dbe5f5] rounded-full pl-1 pr-3 py-1">
          <div className="w-8 h-8 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><UserCircle2 size={18} /></div>
          <div className="leading-tight"><p className="text-xs font-semibold">{roleLabel}</p><p className="text-[10px] text-gray-500">Admin</p></div>
          <ChevronDown size={14} />
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#dbe5f5] rounded-xl px-3 py-1.5 text-xs">
          <Calendar size={20} className="text-[#1255d6]" />
          <div><p className="font-semibold capitalize">{dateLabel}</p><p>{pad(now.getHours())}:{pad(now.getMinutes())}</p></div>
        </div>
      </div>

      {/* Titre */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#e0ecff] text-[#1255d6] flex items-center justify-center"><BarChart3 size={24} /></div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Tableau de bord analytique & IA</h1>
          <p className="text-xs text-[#3e5788]">Des données fiables, des analyses claires et des recommandations pour mieux décider.</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className={`${card} p-4 flex items-center gap-3`}>
              <div className={`w-14 h-14 rounded-full ${s.bg} text-white flex items-center justify-center shrink-0`}><Icon size={26} /></div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{s.title}</p>
                <p className="text-2xl font-extrabold leading-tight truncate text-[#1255d6]">{s.value}</p>
                <p className="text-[11px] text-gray-500">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ligne 1 : revenus, marchandises, GPS, météo */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_1fr_0.95fr] gap-3">
        <div className={`${card} p-4`}>
          <div className="flex items-start justify-between">
            <div><h3 className="font-bold">Évolution du chiffre d'affaires</h3><p className="text-[11px] text-gray-500">En milliers d'Ar</p></div>
            <select value={revenuePeriod} onChange={(e) => setRevenuePeriod(e.target.value)} className="border rounded-md text-xs px-2 py-1 bg-[#f8fafd]">
              <option value="hebdomadaire">Hebdomadaire</option>
              <option value="mensuelle">Mensuelle</option>
              <option value="trimestrielle">Trimestrielle</option>
              <option value="semestrielle">Semestrielle</option>
              <option value="annuelle">Annuelle</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={currentData} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
              <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} Mille MGA`, "Chiffre d'affaires"]} />
              <Bar dataKey="revenus" fill="#1d6fe0" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="revenus" position="top" style={{ fontSize: 10, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="border rounded-md p-2 bg-[#f8fafd]"><p className="text-gray-500">Revenu moyen par période</p><p className="font-bold text-[#1255d6] text-xs">{revAvg.toFixed(1)} Mille Ar</p></div>
            <div className="border rounded-md p-2 bg-[#f8fafd]"><p className="text-gray-500">Panier moyen</p><p className="font-bold text-[#1255d6] text-xs">{reservation.length ? formatCurrency(payTotal / reservation.length) : "—"}</p></div>
            <div className="border rounded-md p-2 bg-[#f8fafd]"><p className="text-gray-500">Meilleure période</p><p className="font-bold text-[#1255d6] text-xs">{revBest ? `${revBest.periode} (${Number(revBest.revenus).toFixed(1)} Mille Ar)` : "—"}</p></div>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><Package size={18} /></div>
            <div><h3 className="font-bold">Répartition des marchandises</h3><p className="text-[11px] text-gray-500">Selon le poids transporté</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[170px] h-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={goodsStats.total ? goodsStats.items : [{ name: "Aucune donnée", value: 1, color: "#e5ebf5" }]} dataKey="value" innerRadius={50} outerRadius={80} stroke="#fff">
                    {(goodsStats.total ? goodsStats.items : [{ name: "Aucune donnée", value: 1, color: "#e5ebf5" }]).map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} kg`, "Poids"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px]">Total</span>
                <span className="text-xs font-extrabold">{goodsStats.total ? `${goodsStats.total.toLocaleString()} kg` : "—"}</span>
              </div>
            </div>
            <ul className="text-xs space-y-2.5 flex-1">
              {goodsStats.items.length === 0 && <li className="text-gray-500">Aucune marchandise enregistrée.</li>}
              {goodsStats.items.map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <i className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <b>{Math.round((p.value / goodsStats.total) * 100)}%</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2"><Navigation size={16} className="text-[#1255d6]" /> Suivi GPS des bateaux</h3>
          <p className="text-[11px] text-gray-500 mb-2">Dernières positions enregistrées</p>
          <div className="rounded-lg bg-[#d9ecfb] border h-[190px] overflow-hidden">
            <svg viewBox="0 0 160 290" className="w-full h-full">
              <path d={MADA_PATH} fill="#e6efd9" stroke="#7fa36a" strokeWidth="0.8" strokeLinejoin="round" />
              {CITIES.map((c) => {
                const [x, y] = proj(c.lon, c.lat);
                return (
                  <g key={c.n}>
                    <circle cx={x} cy={y} r={c.port ? 2.6 : 1.8} fill={c.port ? "#1255d6" : "#64748b"} />
                    <text x={c.left ? x - 4 : x + 4} y={y + 2.5} fontSize="7" textAnchor={c.left ? "end" : "start"} fill="#10285e">{c.n}</text>
                  </g>
                );
              })}
              {boats.map((b, i) => {
                const p = boatPos(b);
                if (!p) return null;
                const [x, y] = proj(p[0], p[1]);
                const maint = /maint/i.test(boatState(b));
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={6} fill={maint ? "#ef4444" : "#22c55e"} fillOpacity={0.25} />
                    <circle cx={x} cy={y} r={3} fill={maint ? "#ef4444" : "#22c55e"} stroke="#fff" strokeWidth="1" />
                    <text x={x + 6} y={y - 5} fontSize="7" fontWeight="700" fill="#10285e">{boatName(b)}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mt-2 space-y-1.5 max-h-[84px] overflow-y-auto">
            {boats.length === 0 && <p className="text-xs text-gray-500 text-center">Aucun bateau enregistré.</p>}
            {boats.map((b, i) => {
              const st = boatState(b);
              const maint = /maint/i.test(st);
              const p = boatPos(b);
              return (
                <div key={i} className="border rounded-lg px-2 py-1 text-[10px] bg-[#f8fafd] flex items-center gap-2">
                  <i className={`w-2 h-2 rounded-full inline-block shrink-0 ${maint ? "bg-red-500" : "bg-green-500"}`} />
                  <b className="text-xs">{boatName(b)}</b>
                  <span className={`font-semibold ${maint ? "text-orange-500" : "text-green-600"}`}>{st}</span>
                  <span className="ml-auto text-gray-500">{p ? `${p[1].toFixed(2)} / ${p[0].toFixed(2)}` : "GPS non renseigné"}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 text-[10px] mt-2">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-green-500 inline-block" />Bateau en route</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-red-500 inline-block" />Bateau à l'arrêt</span>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2"><Cloud size={16} className="text-[#1255d6]" /> Météo & Conditions maritimes</h3>
          <p className="text-[11px] text-gray-500">Toamasina – Aujourd'hui</p>
          {!weather && <p className="text-xs text-gray-500 py-10 text-center">{weatherErr ? "Météo indisponible (connexion)." : "Chargement de la météo…"}</p>}
          {weather && (
            <>
              <div className="flex items-center gap-3 my-3">
                <weather.Icon size={46} className="text-[#f59e0b]" />
                <div><p className="text-3xl font-extrabold">{weather.temp}°C</p><p className="text-[11px]">{weather.label}</p></div>
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
                    <p className="font-semibold capitalize">{f.d}</p><f.Icon size={16} className="mx-auto my-1 text-[#1255d6]" /><p>{f.t}</p><p className="text-gray-500">{f.label}</p>
                  </div>
                ))}
              </div>
              <div className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-[10px] ${seaRisk ? "bg-[#fff0d9] text-[#b45309]" : "bg-[#e8f1ff] text-[#1255d6]"}`}>
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>{seaRisk ? "Prudence : vent fort ou mer agitée, adaptez les départs." : "Les conditions sont favorables à la navigation."}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ligne 2 : ventes par trajet, prévisions, justifications ; puis recommandations */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.25fr_1fr] gap-3">
        <div className={`${card} p-4`}>
          <h3 className="font-bold text-sm flex items-center gap-2"><BarChart3 size={16} className="text-[#1255d6]" /> Analyse des ventes par trajet</h3>
          {routeStats.length === 0 ? (
            <p className="text-xs text-gray-500 py-10 text-center">Aucune réservation à analyser.</p>
          ) : (
            <div className="grid grid-cols-[1.6fr_1fr] gap-2">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={routeStats.slice(0, 6)} margin={{ top: 10, right: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} tickFormatter={(v: string) => v.split(" → ")[1] ?? v} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 9 }} tickFormatter={compact} />
                  <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 9 }} allowDecimals={false} />
                  <RechartsTooltip formatter={(v: number | string, name: string) => [name === "Chiffre d'affaires" ? formatCurrency(Number(v)) : v, name]} />
                  <Bar yAxisId="ca" dataKey="ca" name="Chiffre d'affaires" fill="#1d6fe0" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="n" type="monotone" dataKey="n" name="Réservations" stroke="#f59e0b" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="space-y-3 text-[10px]">
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

        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center"><Brain size={18} /></div>
            <h3 className="font-bold text-sm flex-1">Data Science <span className="text-gray-500 font-normal">— Prévisions & Tendances</span></h3>
            <span className="text-[10px] text-gray-500">{aiBusy ? "Analyse IA en cours…" : insight ? "Analyse IA" : "Calcul local"}</span>
          </div>
          <p className="text-[11px] font-semibold mb-1">Prévision du chiffre d'affaires (période suivante)</p>
          <div className="grid grid-cols-[1.3fr_1fr] gap-3">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={forecast.data} margin={{ left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" vertical={false} />
                <XAxis dataKey="periode" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="reel" stroke="#1d6fe0" strokeWidth={2} fill="#1d6fe0" fillOpacity={0.15} name="Réel" />
                <Area type="monotone" dataKey="prevision" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" fill="#7c3aed" fillOpacity={0.08} name="Prévision" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="rounded-lg bg-[#eef4ff] p-3 text-[11px] space-y-2">
              <p className="font-bold text-[#1255d6] flex items-center gap-1.5"><Brain size={14} /> Insights IA</p>
              <p className="text-gray-700">{insight?.analyse || (revNumbers.length ? `Revenu total sur la période : ${revTotal.toFixed(1)} Mille Ar.` : "Pas assez de données pour analyser.")}</p>
              <p className="text-gray-700">{insight?.prevision || (forecast.next != null ? `Tendance : prochain point estimé à ${forecast.next.toFixed(1)} Mille Ar (régression linéaire).` : "")}</p>
            </div>
          </div>
        </div>

        <div className={`${card} p-4 xl:col-start-3 xl:row-start-1 xl:row-span-2`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3"><Brain size={16} className="text-[#e5342f]" /> IA – Justifications des indicateurs</h3>
          <ul className="space-y-2">
            {justifs.map((j) => (
              <li key={j.title} className={`flex items-start gap-3 rounded-lg p-2.5 ${j.box}`}>
                <span className={`w-9 h-9 rounded-full ${j.bg} text-white flex items-center justify-center shrink-0`}><j.Icon size={16} /></span>
                <div className="min-w-0 text-[10px]">
                  <p className="font-bold text-xs">{j.title}</p>
                  <p className="text-gray-600">{j.text}</p>
                  <p className="text-gray-400 mt-0.5">Source : {j.source} · Mis à jour : {updatedLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${card} p-4 xl:col-span-2`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3"><Lightbulb size={16} className="text-[#f59e0b]" /> Recommandations & alertes de l'IA</h3>
          {alerts.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">Aucune recommandation pour le moment.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {alerts.map((a, i) => {
                const { c, Icon, tc } = lvlStyle[a.lvl];
                return (
                  <div key={i} className="border rounded-xl p-3 flex items-start gap-2 text-[11px] bg-[#f8fafd]">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${c}`}><Icon size={16} /></span>
                    <div><p className={`font-semibold ${tc}`}>{a.t}</p><p className="text-gray-600">{a.s}</p></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bandeau bas */}
      <div className="rounded-xl bg-[#0b2a6b] text-white px-5 py-3 flex flex-wrap items-center gap-4 text-[11px]">
        <Brain size={26} />
        <p><b className="text-sm">SAINT-JUDE AI</b> &nbsp; Plus qu'un outil : un assistant qui explique, justifie et vous aide à décider.</p>
        <span className="ml-auto flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5">
          <i className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Données en temps réel
        </span>
        <button onClick={exportReport} className="flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5 hover:bg-white/10">
          <Download size={14} /> Exporter le rapport
        </button>
      </div>
    </div>
  );
};

export default Dashboard;