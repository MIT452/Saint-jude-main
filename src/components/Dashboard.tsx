import { FC, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList,
} from "recharts";
import {
  Ship, Calculator, TrendingUp, TrendingDown, Bell, Search, Calendar, ChevronDown, UserCircle2, ClipboardList,
  Wind, Waves, Droplets, Eye, Cloud, CloudSun, CloudRain, CloudFog, CloudLightning, Sun, AlertTriangle, Wrench,
  BarChart3, Brain, Lock, Navigation, Fuel, ShieldCheck, MapPin,
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
  temp: number; label: string; Icon: LucideIcon; wind: string; humidity: number; visibility: number; wave: number | null;
  days: { d: string; t: string; label: string; Icon: LucideIcon }[];
};

const card = "bg-white rounded-xl border border-[#dbe5f5] shadow-sm";
const pad = (n: number) => String(n).padStart(2, "0");
const lvlStyle: Record<Level, { c: string; Icon: LucideIcon; tc: string }> = {
  Faible: { c: "bg-[#e0ecff] text-[#1255d6]", Icon: Bell, tc: "text-[#1255d6]" },
  Moyen: { c: "bg-[#fff0d9] text-[#f59e0b]", Icon: AlertTriangle, tc: "text-[#d97706]" },
  Élevé: { c: "bg-[#ffe3e3] text-[#e5342f]", Icon: AlertTriangle, tc: "text-[#e5342f]" },
};

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

const Dashboard: FC<PropsDashboard> = ({ onSetToAudit }) => {
  const [revenuePeriod, setRevenuePeriod] = useState("mensuelle");
  const [revenueDataSets, setRevenueDataSets] = useState<RevenueDataSets>(revenueDataSetsVoid);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherErr, setWeatherErr] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const cashMouvement = useSelector((state: RootState) => state.stJude.cashMouvement);
  const trip = useSelector((state: RootState) => state.stJude.trip);
  const reservation = useSelector((state: RootState) => state.stJude.reservation);
  const boats = useSelector((state: RootState) => ((state.stJude as any).boat ?? (state.stJude as any).boats ?? []) as any[]);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  useEffect(() => {
    setRevenueDataSets(generateRevenueDataSets(cashMouvement));
  }, [cashMouvement]);

  // ---------- Données réelles
  const totalCredit = cashMouvement.reduce((a, { credit }) => a + Number(credit), 0);
  const totalDebit = cashMouvement.reduce((a, { debit }) => a + Number(debit), 0);
  const solde = totalCredit - totalDebit;
  const paid = reservation.reduce((a, { amountPaid }) => a + Number(amountPaid), 0);
  const unpaid = reservation.reduce((a, { amountToPay }) => a + Number(amountToPay), 0);
  const payTotal = paid + unpaid;
  const cancelled = reservation.filter((r: any) => r.status === "Annulée").length;
  const unpaidCount = reservation.filter((r) => Number(r.amountToPay) > 0).length;

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

  const boatName = (b: any) => b.name ?? b.nom ?? b.matricule ?? "Bateau";
  const boatState = (b: any) => String(b.state ?? b.etat ?? b.status ?? b.statut ?? "—");

  // Alertes locales calculées sur les vraies données (repli si l'IA est indisponible)
  const localAlerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    if (unpaidCount > 0) out.push({ t: "Paiements en attente", s: `${unpaidCount} réservation(s) avec un solde à payer — ${formatCurrency(unpaid)}`, lvl: "Moyen" });
    boats.filter((b) => /maint/i.test(boatState(b))).forEach((b) => out.push({ t: "Bateau en maintenance", s: boatName(b), lvl: "Moyen" }));
    if (solde < 0) out.push({ t: "Solde net négatif", s: `Débit supérieur au crédit de ${formatCurrency(Math.abs(solde))}`, lvl: "Élevé" });
    return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpaidCount, unpaid, boats, solde]);

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

  const paymentData = [
    { name: "Frais payés", value: paid, color: "#2563eb" },
    { name: "Frais non payés", value: unpaid, color: "#ef4444" },
  ];

  const stats = [
    { title: "Total Crédit", value: formatCurrency(totalCredit), sub: "Total encaissé", icon: TrendingUp, bg: "bg-[#0f9d78]" },
    { title: "Total Débit", value: formatCurrency(totalDebit), sub: "Total dépensé", icon: TrendingDown, bg: "bg-[#ef4444]" },
    { title: "Solde net", value: formatCurrency(solde), sub: "Crédit − Débit", icon: Calculator, bg: "bg-[#7c3aed]" },
    { title: "Nombre de voyages", value: String(trip.length), sub: "Voyages enregistrés", icon: Ship, bg: "bg-[#1d6fe0]" },
    { title: "Réservations", value: String(reservation.length), sub: `dont ${cancelled} annulée(s)`, icon: ClipboardList, bg: "bg-[#f59e0b]", orange: true },
  ];

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const roleLabel = currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.role ?? "Admin";

  return (
    <div className="p-5 bg-[#f3f7fd] min-h-full space-y-4 text-[#10285e]">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold">Bonjour, {roleLabel}</h1>
          <p className="text-xs text-[#3e5788]">Voici un résumé de l'activité de SAINT-JUDE aujourd'hui.</p>
        </div>
        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Rechercher une réservation, un bateau..." className="w-full bg-white border border-[#dbe5f5] rounded-full pl-9 pr-3 py-2 text-xs" />
        </div>
        {currentUser?.role === "Propriétaire" && (
          <button onClick={() => onSetToAudit("Audit")} className="flex items-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-xs font-semibold px-4 py-2 rounded-full">
            <ShieldCheck size={16} /> Audit Logs
          </button>
        )}
        <div className="relative w-10 h-10 bg-white border border-[#dbe5f5] rounded-full flex items-center justify-center">
          <Bell size={18} />
          {alerts.length > 0 && <span className="absolute -top-1 -right-1 bg-[#e5342f] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{alerts.length}</span>}
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

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className={`${card} p-4 flex items-center gap-3`}>
              <div className={`w-14 h-14 rounded-full ${s.bg} text-white flex items-center justify-center shrink-0`}><Icon size={26} /></div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${s.orange ? "text-[#f59e0b]" : ""}`}>{s.title}</p>
                <p className={`text-2xl font-extrabold leading-tight truncate ${s.orange ? "text-[#f59e0b]" : "text-[#1255d6]"}`}>{s.value}</p>
                <p className="text-[11px] text-gray-500">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ligne 1 : revenus, paiements, bateaux, météo */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr_0.95fr_0.95fr] gap-3">
        <div className={`${card} p-4`}>
          <div className="flex items-start justify-between">
            <div><h3 className="font-bold">Évolution des Revenus</h3><p className="text-[11px] text-gray-500">En milliers d'Ar</p></div>
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
              <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} Mille MGA`, "Revenus"]} />
              <Bar dataKey="revenus" fill="#1d6fe0" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="revenus" position="top" style={{ fontSize: 10, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="border rounded-md p-2 bg-[#f8fafd]"><p className="text-gray-500">Revenu total</p><p className="font-bold text-[#1255d6] text-xs">{revTotal.toFixed(1)} Mille Ar</p></div>
            <div className="border rounded-md p-2 bg-[#f8fafd]"><p className="text-gray-500">Moyenne</p><p className="font-bold text-[#1255d6] text-xs">{revAvg.toFixed(1)} Mille Ar</p></div>
            <div className="border rounded-md p-2 bg-[#f8fafd]"><p className="text-gray-500">Meilleure période</p><p className="font-bold text-[#1255d6] text-xs">{revBest ? `${Number(revBest.revenus).toFixed(1)} Mille Ar` : "—"}</p></div>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><BarChart3 size={18} /></div>
            <div><h3 className="font-bold">Répartition des Paiements</h3><p className="text-[11px] text-gray-500">Frais de transport de marchandises</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[190px] h-[210px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={payTotal ? paymentData : [{ name: "Aucune donnée", value: 1, color: "#e5ebf5" }]} dataKey="value" innerRadius={55} outerRadius={85} stroke="#fff">
                    {(payTotal ? paymentData : [{ name: "Aucune donnée", value: 1, color: "#e5ebf5" }]).map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} Ar`, "Montant"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px]">Total payé</span>
                <span className="text-xs font-extrabold">{formatCurrency(paid)}</span>
              </div>
            </div>
            <ul className="text-xs space-y-3 flex-1">
              {paymentData.map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                  <span className="flex-1">{p.name}</span>
                  <b>{payTotal ? Math.round((p.value / payTotal) * 100) : 0}%</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2"><Navigation size={16} className="text-[#1255d6]" /> Suivi des Bateaux</h3>
          <p className="text-[11px] text-gray-500 mb-2">État de la flotte</p>
          <div className="space-y-2 max-h-[230px] overflow-y-auto">
            {boats.length === 0 && <p className="text-xs text-gray-500 py-6 text-center">Aucun bateau enregistré.</p>}
            {boats.map((b, i) => {
              const st = boatState(b);
              const ok = /(dispo|service|route|actif)/i.test(st);
              const maint = /maint/i.test(st);
              return (
                <div key={i} className="border rounded-lg p-2.5 text-[11px] bg-[#f8fafd] flex items-center gap-2">
                  <MapPin size={16} className={maint ? "text-orange-500" : ok ? "text-green-600" : "text-[#1255d6]"} />
                  <div className="flex-1">
                    <p className="font-bold text-xs">{boatName(b)}</p>
                    <p className={`font-semibold ${maint ? "text-orange-500" : ok ? "text-green-600" : "text-gray-600"}`}>{st}</p>
                  </div>
                  {b.capacity != null && <span className="text-gray-500">{b.capacity} t</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2"><Cloud size={16} className="text-[#1255d6]" /> Météo & Conditions Maritimes</h3>
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
            </>
          )}
        </div>
      </div>

      {/* Ligne 2 : analytics, prévisions IA, alertes */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.35fr_1fr] gap-3">
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#1255d6] text-white flex items-center justify-center"><BarChart3 size={18} /></div>
            <div className="flex-1"><h3 className="font-bold text-sm">Data Analytics</h3><p className="text-[11px] text-gray-500">— Indicateurs clés</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ["Taux de paiement", payTotal ? `${Math.round((paid / payTotal) * 100)}%` : "—"],
              ["Panier moyen", reservation.length ? formatCurrency(payTotal / reservation.length) : "—"],
              ["Nbre de réservations", String(reservation.length)],
              ["Taux d'annulation", reservation.length ? `${Math.round((cancelled / reservation.length) * 100)}%` : "—"],
            ].map(([l, v]) => (
              <div key={l} className="border rounded-lg p-2.5 bg-[#f8fafd]">
                <p className="text-gray-600">{l}</p><p className="text-lg font-extrabold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center"><Brain size={18} /></div>
            <h3 className="font-bold text-sm flex-1">Data Science <span className="text-gray-500 font-normal">— Prévisions & Anomalies</span></h3>
            <span className="text-[10px] text-gray-500">{aiBusy ? "Analyse IA en cours…" : insight ? "Analyse IA" : "Calcul local"}</span>
          </div>
          <div className="grid grid-cols-[1fr_1.1fr] gap-3">
            <div className="text-[11px] space-y-2">
              <p className="text-gray-700">{insight?.analyse || (revNumbers.length ? `Revenu total sur la période : ${revTotal.toFixed(1)} Mille Ar.` : "Pas assez de données pour analyser.")}</p>
              <p className="text-gray-700">{insight?.prevision || (forecast.next != null ? `Tendance : prochain point estimé à ${forecast.next.toFixed(1)} Mille Ar (régression linéaire).` : "")}</p>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={forecast.data}>
                <XAxis dataKey="periode" tick={{ fontSize: 9 }} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="reel" stroke="#1d6fe0" strokeWidth={2} fill="#1d6fe0" fillOpacity={0.15} name="Réel" />
                <Area type="monotone" dataKey="prevision" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" fill="none" name="Prévision" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><Bell size={16} className="text-[#e5342f]" /> Alertes & Notifications</h3>
            <span className="text-[10px] text-gray-500">{insight && insight.alertes.length ? "IA" : "Calcul local"}</span>
          </div>
          <ul className="space-y-2.5">
            {alerts.length === 0 && <li className="text-xs text-gray-500 py-4 text-center">Aucune alerte pour le moment.</li>}
            {alerts.map((a, i) => {
              const { c, Icon, tc } = lvlStyle[a.lvl];
              return (
                <li key={i} className="flex items-start gap-2 text-[11px]">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c}`}><Icon size={14} /></span>
                  <div className="flex-1"><p className={`font-semibold ${tc}`}>{a.t}</p><p className="text-gray-600">{a.s}</p></div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Bandeau bas */}
      <div className={`${card} px-5 py-3 flex flex-wrap items-center gap-6 text-[11px]`}>
        <div className="flex items-center gap-2 font-bold text-sm"><Ship size={22} className="text-[#1255d6]" /> SAINT-JUDE <span className="font-normal text-gray-500">Transport Maritime</span></div>
        {[
          [Lock, "Sécurité des données", "Chiffrement & sauvegarde"],
          [Brain, "IA & Analytics", "Des décisions plus éclairées"],
          [Fuel, "Carburant", "Suivi de consommation"],
          [Wrench, "Maintenance", "Flotte sous surveillance"],
        ].map(([I, t, s]: any) => (
          <div key={t} className="flex items-center gap-2"><I size={22} className="text-[#1255d6]" /><div><p className="font-semibold">{t}</p><p className="text-gray-500 text-[10px]">{s}</p></div></div>
        ))}
        <p className="ml-auto italic text-[#1255d6]">Plus qu'un transport, une confiance.</p>
      </div>
    </div>
  );
};

export default Dashboard;