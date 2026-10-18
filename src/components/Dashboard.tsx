import { FC, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList,
} from "recharts";
import {
  Ship, Calculator, TrendingUp, TrendingDown, Bell, Search, Calendar, ChevronDown, UserCircle2, Package,
  Wind, Waves, Droplets, Eye, Cloud, MapPin, AlertTriangle, Wrench, CloudRain, ArrowRight,
  BarChart3, Brain, Lock, Navigation, Fuel, ShieldCheck,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { formatCurrency, generateRevenueDataSets } from "../Tools/Tools";
import { RevenueDataSets } from "../data/type";
import { revenueDataSetsVoid } from "../data/dataVoid";

interface PropsDashboard {
  onSetToAudit: (value: string) => void;
}

const card = "bg-white rounded-xl border border-[#dbe5f5] shadow-sm";
const pad = (n: number) => String(n).padStart(2, "0");


const Dashboard: FC<PropsDashboard> = ({ onSetToAudit }) => {
  const [revenuePeriod, setRevenuePeriod] = useState("mensuelle");
  const [revenueDataSets, setRevenueDataSets] = useState<RevenueDataSets>(revenueDataSetsVoid);

  const cashMouvement = useSelector((state: RootState) => state.stJude.cashMouvement);
  const trip = useSelector((state: RootState) => state.stJude.trip);
  const reservation = useSelector((state: RootState) => state.stJude.reservation);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  useEffect(() => {
    setRevenueDataSets(generateRevenueDataSets(cashMouvement));
  }, [cashMouvement]);

  const totalCredit = cashMouvement.reduce((a, { credit }) => a + Number(credit), 0);
  const totalDebit = cashMouvement.reduce((a, { debit }) => a + Number(debit), 0);

  const stats = [
    { title: "Total Crédit", value: formatCurrency(totalCredit), trend: "+12%", up: true, icon: TrendingUp, bg: "bg-[#0f9d78]" },
    { title: "Total Débit", value: formatCurrency(totalDebit), trend: "-8%", up: false, icon: TrendingDown, bg: "bg-[#ef4444]" },
    { title: "Solde net", value: formatCurrency(totalCredit - totalDebit), trend: "+18%", up: true, icon: Calculator, bg: "bg-[#7c3aed]" },
    { title: "Nombre de voyages", value: String(trip.length), trend: "Aucun changement", up: true, icon: Ship, bg: "bg-[#1d6fe0]", flat: true },
    { title: "Marchandises transportées", value: "248,5 tonnes", trend: "+15%", up: true, icon: Package, bg: "bg-[#f59e0b]", orange: true },
  ];

  const currentData = revenueDataSets[revenuePeriod as keyof typeof revenueDataSets] || revenueDataSets.mensuelle;
  const revNumbers = currentData.map((d: any) => Number(d.revenus));
  const revTotal = revNumbers.reduce((s: number, v: number) => s + v, 0);
  const revAvg = revNumbers.length ? revTotal / revNumbers.length : 0;
  const revBest = currentData.reduce((b: any, d: any) => (b && Number(b.revenus) >= Number(d.revenus) ? b : d), null as any);

  const paid = reservation.reduce((a, { amountPaid }) => a + Number(amountPaid), 0);
  const unpaid = reservation.reduce((a, { amountToPay }) => a + Number(amountToPay), 0);
  const paymentData = [
    { name: "Frais payés", value: paid, color: "#2563eb" },
    { name: "Frais non payés", value: unpaid, color: "#ef4444" },
  ];
  const payTotal = paid + unpaid;

  // --- Données de démonstration (à brancher sur l'API plus tard)
  const boats = [
    { name: "Eric", status: "En route", color: "text-green-600", info: ["Lat : -18.15  Lon : 49.40", "Vitesse : 12 nds", "ETA : 21 juin 2025"] },
    { name: "Arcanum", status: "En maintenance", color: "text-orange-500", info: ["Lat : -17.02  Lon : 49.10", "Vitesse : 0 nds", "ETA : -"] },
  ];
  const forecast = [
    { d: "Mar 27/05", t: "27° / 31°", l: "Pluie légère", i: CloudRain },
    { d: "Mer 28/05", t: "26° / 30°", l: "Peu nuageux", i: Cloud },
    { d: "Jeu 29/05", t: "25° / 29°", l: "Risque de pluie", i: CloudRain },
  ];
  const alerts = [
    { t: "Paiement en retard", s: "Client #003 - 120 000 Ar", h: "Aujourd'hui 10:24", c: "bg-[#ffe3e3] text-[#e5342f]", i: AlertTriangle, tc: "text-[#e5342f]" },
    { t: "Bateau en maintenance", s: "Arcanum - Intervention prévue sous 2 jours", h: "Aujourd'hui 09:15", c: "bg-[#e0ecff] text-[#1255d6]", i: Wrench, tc: "text-[#1255d6]" },
    { t: "Risque de météo défavorable", s: "Vent fort prévu à Toamasina", h: "Hier 16:32", c: "bg-[#fff0d9] text-[#f59e0b]", i: Wind, tc: "text-[#f59e0b]" },
    { t: "Nouvelle réservation", s: "Client #048 - 450 000 Ar", h: "Hier 14:20", c: "bg-[#ffe3e3] text-[#e5342f]", i: Bell, tc: "text-[#e5342f]" },
  ];
  const forecastLine = useMemo(
    () => [{ m: "Juin", v: 10 }, { m: "Juil.", v: 14 }, { m: "Août", v: 17 }, { m: "Sept.", v: 24 }].map((x) => x),
    []
  );

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
          <span className="absolute -top-1 -right-1 bg-[#e5342f] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">3</span>
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
                <p className={`text-[11px] font-semibold flex items-center gap-1 ${s.flat ? "text-[#1255d6]" : s.up ? "text-green-600" : "text-red-600"}`}>
                  {s.flat ? <ArrowRight size={12} /> : s.up ? "↗" : "↘"} {s.trend}
                  {!s.flat && <span className="text-gray-500 font-normal">vs mois précédent</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ligne 1 : revenus, paiements, GPS, météo */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr_0.95fr_0.95fr] gap-3">
        <div className={`${card} p-4`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold">Évolution des Revenus</h3>
              <p className="text-[11px] text-gray-500">En milliers d'Ar</p>
            </div>
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
                  <Pie data={paymentData} dataKey="value" innerRadius={55} outerRadius={85} stroke="#fff">
                    {paymentData.map((e) => <Cell key={e.name} fill={e.color} />)}
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
          <h3 className="font-bold flex items-center gap-2"><Navigation size={16} className="text-[#1255d6]" /> Suivi GPS des Bateaux</h3>
          <p className="text-[11px] text-gray-500 mb-2">Position en temps réel</p>
          <div className="grid grid-cols-[1fr_1.1fr] gap-2">
            <div className="relative rounded-lg bg-gradient-to-br from-[#cfe6fb] to-[#e8f3e0] h-[190px] overflow-hidden border">
              <MapPin size={18} className="absolute top-12 left-[55%] text-[#e5342f]" />
              <span className="absolute top-8 left-[40%] text-[9px]">Antsiranana</span>
              <MapPin size={18} className="absolute bottom-16 left-[60%] text-[#1255d6]" />
              <span className="absolute bottom-10 left-[50%] text-[9px]">Toamasina</span>
            </div>
            <div className="space-y-2">
              {boats.map((b) => (
                <div key={b.name} className="border rounded-lg p-2 text-[10px] bg-[#f8fafd]">
                  <p className="font-bold text-xs flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#1255d6] inline-block" />{b.name}</p>
                  <p className={`${b.color} font-semibold`}>{b.status}</p>
                  {b.info.map((l) => <p key={l} className="text-gray-600">{l}</p>)}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 text-[10px] mt-2">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-green-500 inline-block" />Bateau en route</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-red-500 inline-block" />Bateau à l'arrêt</span>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <h3 className="font-bold flex items-center gap-2"><Cloud size={16} className="text-[#1255d6]" /> Météo & Conditions Maritimes</h3>
          <p className="text-[11px] text-gray-500">Toamasina – Aujourd'hui</p>
          <div className="flex items-center gap-3 my-3">
            <Cloud size={46} className="text-[#f59e0b]" />
            <div><p className="text-3xl font-extrabold">28°C</p><p className="text-[11px]">Ciel nuageux</p></div>
            <ul className="text-[10px] space-y-1 ml-auto">
              <li className="flex items-center gap-1"><Wind size={11} />Vent <b>12 km/h (E)</b></li>
              <li className="flex items-center gap-1"><Waves size={11} />Mer <b>1,2 m</b></li>
              <li className="flex items-center gap-1"><Droplets size={11} />Humidité <b>78%</b></li>
              <li className="flex items-center gap-1"><Eye size={11} />Visibilité <b>10 km</b></li>
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {forecast.map((f) => {
              const Icon = f.i;
              return (
                <div key={f.d} className="border rounded-md p-1.5 text-center text-[9px] bg-[#f8fafd]">
                  <p className="font-semibold">{f.d}</p><Icon size={16} className="mx-auto my-1 text-[#1255d6]" /><p>{f.t}</p><p className="text-gray-500">{f.l}</p>
                </div>
              );
            })}
          </div>
          <button className="mt-3 ml-auto flex items-center gap-1 bg-[#1255d6] text-white text-[11px] font-semibold px-3 py-1.5 rounded-md">Voir la météo complète <ArrowRight size={12} /></button>
        </div>
      </div>

      {/* Ligne 2 : analytics, data science, alertes */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.35fr_1fr] gap-3">
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#1255d6] text-white flex items-center justify-center"><BarChart3 size={18} /></div>
            <div className="flex-1"><h3 className="font-bold text-sm">Data Analytics</h3><p className="text-[11px] text-gray-500">— Indicateurs clés</p></div>
            <select className="border rounded-md text-[11px] px-2 py-1"><option>6 derniers mois</option></select>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ["Taux d'occupation", "68%", "↗ +12%", "text-green-600"],
              ["Panier moyen", "245 000 Ar", "↘ +8%", "text-red-500"],
              ["Nbre de réservations", String(reservation.length), "↗ +15%", "text-green-600"],
              ["Taux d'annulation", "6%", "↘ -2%", "text-green-600"],
            ].map(([l, v, t, c]) => (
              <div key={l} className="border rounded-lg p-2.5 bg-[#f8fafd]">
                <p className="text-gray-600">{l}</p><p className="text-lg font-extrabold">{v}</p><p className={`${c} font-semibold`}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center"><Brain size={18} /></div>
            <h3 className="font-bold text-sm">Data Science <span className="text-gray-500 font-normal">— Prévisions & Anomalies</span></h3>
          </div>
          <div className="grid grid-cols-[1fr_1.2fr] gap-3">
            <div className="grid grid-cols-1 gap-2 text-[11px]">
              <div className="grid grid-cols-3 gap-2 col-span-1">
                {[["Recettes (30j)", "512 Mille Ar", "+14%"], ["Marchandises (30j)", "320 t", "+11%"], ["Carburant (30j)", "12 500 L", "+6%"]].map(([l, v, t]) => (
                  <div key={l} className="border rounded-lg p-2 bg-[#f8fafd] col-span-1">
                    <p className="text-gray-600 text-[10px]">{l}</p><p className="font-extrabold text-xs">{v}</p><p className="text-green-600 font-semibold">↗ {t}</p>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={forecastLine}>
                <defs><linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1d6fe0" stopOpacity={0.25} /><stop offset="95%" stopColor="#1d6fe0" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fontSize: 9 }} />
                <Area type="monotone" dataKey="v" stroke="#1d6fe0" strokeWidth={2} fill="url(#gF)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><Bell size={16} className="text-[#e5342f]" /> Alertes & Notifications</h3>
            <span className="text-[10px] text-[#1255d6]">Voir tout</span>
          </div>
          <ul className="space-y-2">
            {alerts.map((a) => {
              const Icon = a.i;
              return (
                <li key={a.t} className="flex items-start gap-2 text-[11px]">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.c}`}><Icon size={14} /></span>
                  <div className="flex-1"><p className={`font-semibold ${a.tc}`}>{a.t}</p><p className="text-gray-600">{a.s}</p></div>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">{a.h}</span>
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
          [MapPin, "GPS & Cartographie", "Suivi en temps réel des bateaux"],
          [Fuel, "Météo Marine", "Navigation sécurisée"],
        ].map(([I, t, s]: any) => (
          <div key={t} className="flex items-center gap-2"><I size={22} className="text-[#1255d6]" /><div><p className="font-semibold">{t}</p><p className="text-gray-500 text-[10px]">{s}</p></div></div>
        ))}
        <p className="ml-auto italic text-[#1255d6]">Plus qu'un transport, une confiance.</p>
      </div>
    </div>
  );
};

export default Dashboard;