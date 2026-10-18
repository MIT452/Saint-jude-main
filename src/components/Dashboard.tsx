import { FC, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList,
} from "recharts";
import {
  Ship, Calculator, TrendingUp, TrendingDown, Bell, Search, Calendar, ChevronDown, UserCircle2, Package,
  Wind, Waves, Droplets, Eye, Cloud, MapPin, AlertTriangle, Wrench, CloudRain, ArrowRight,
  BarChart3, Brain, Lock, Navigation, Fuel, CheckCircle2, ShieldAlert, ShieldCheck, Send, Bot,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { formatCurrency, generateRevenueDataSets, findUser } from "../Tools/Tools";
import { RevenueDataSets, AuditLog } from "../data/type";
import { revenueDataSetsVoid } from "../data/dataVoid";
import { onGetService } from "../data/service";
import type { LucideIcon } from "lucide-react";

interface PropsDashboard {
  onSetToAudit: (value: string) => void;
}

const card = "bg-white rounded-xl border border-[#dbe5f5] shadow-sm";
const pad = (n: number) => String(n).padStart(2, "0");

// ====== Section Audit Logs IA ======
interface AuditSectionProps {
  onSetToAudit?: (value: string) => void;
}

type Level = "Faible" | "Moyen" | "Élevé";
type Row = { h: string; u: string; a: string; r: string; ok: boolean; ip: string; risk: Level };
type Msg = { from: "user" | "ai"; text: string; list?: string[]; safe?: string };

const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ACTION: Record<string, string> = { create: "Création", update: "Mise à jour", delete: "Suppression" };

const DEMO_ROWS: Row[] = [
  { h: "15:32", u: "admin", a: "Connexion", r: "/api/auth", ok: true, ip: "196.168.1.12", risk: "Faible" },
  { h: "14:27", u: "client", a: "Réservation", r: "/api/reservations", ok: true, ip: "196.168.1.23", risk: "Faible" },
  { h: "13:56", u: "system", a: "Mise à jour", r: "/api/trips", ok: true, ip: "127.0.0.1", risk: "Faible" },
  { h: "12:41", u: "client", a: "Tentative de connexion", r: "/api/auth", ok: false, ip: "196.168.1.45", risk: "Moyen" },
  { h: "11:32", u: "admin", a: "Suppression", r: "/api/goods", ok: true, ip: "196.168.1.12", risk: "Faible" },
  { h: "10:15", u: "agent", a: "Paiement", r: "/api/payments", ok: true, ip: "41.200.12.98", risk: "Faible" },
];

const DEMO_ANOMALIES = [
  { t: "Activité inhabituelle détectée", s: "Connexion depuis un nouvel appareil (IP : 196.168.1.45)", h: "Il y a 2 heures", lvl: "Moyen" as Level, kind: "warn" },
  { t: "Pic de demandes API", s: "+320% sur /api/reservations", h: "Il y a 4 heures", lvl: "Faible" as Level, kind: "info" },
  { t: "Tentative de paiement suspecte", s: "Montant inhabituel : 2 500 000 Ar", h: "Il y a 6 heures", lvl: "Élevé" as Level, kind: "bad" },
];

const badge: Record<Level, string> = {
  Faible: "bg-[#e3f7ec] text-[#14894f] border-[#bfe8d1]",
  Moyen: "bg-[#ffe9e3] text-[#e0592a] border-[#f7c9b8]",
  Élevé: "bg-[#ffe3e6] text-[#d02925] border-[#f5c2c0]",
};
const kindStyle: Record<string, { c: string; Icon: LucideIcon }> = {
  warn: { c: "bg-[#fff0d9] text-[#f59e0b] border-[#f9d9a0]", Icon: AlertTriangle },
  info: { c: "bg-[#e3f7ec] text-[#14894f] border-[#bfe8d1]", Icon: BarChart3 },
  bad: { c: "bg-[#ffe3e6] text-[#e5342f] border-[#f5c2c0]", Icon: ShieldAlert },
};

const ago = (d: Date) => {
  const m = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `Il y a ${h} heure${h > 1 ? "s" : ""}` : `Il y a ${Math.round(h / 24)} j`;
};

const AuditSection: FC<AuditSectionProps> = ({ onSetToAudit }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { from: "user", text: "Montre-moi les tentatives de connexion échouées." },
    {
      from: "ai",
      text: "J'ai trouvé 3 tentatives de connexion échouées aujourd'hui :",
      list: ["12:41 – IP 196.168.1.45 (client)", "09:17 – IP 41.200.12.98 (agent)", "06:32 – IP 102.99.45.12 (client)"],
      safe: "Aucun risque critique détecté.",
    },
  ]);
  const allUser = useSelector((state: RootState) => state.users.allUser);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  useEffect(() => {
    (async () => {
      try {
        setLogs(await onGetService<AuditLog>("allaudit"));
      } catch (e) {
        console.error("Erreur logs", e);
      }
    })();
  }, []);

  const real = useMemo<(Row & { date: Date; entity: string; del: boolean })[]>(
    () =>
      [...logs]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((log) => {
          const user = findUser(log.userId, allUser);
          const failed = (log as any).status === "FAILED";
          const del = log.action === "delete";
          const date = new Date(log.createdAt);
          const entity = String(log.collectionName);
          return {
            date, entity, del,
            h: hhmm(date),
            u: user ? `${user.name} ${user.lastName}` : "system",
            a: ACTION[log.action] ?? String(log.action),
            r: `/api/${entity.toLowerCase()}`,
            ok: !failed,
            ip: (log as any).ip ?? (log as any).ipAddress ?? "—",
            risk: (failed ? "Moyen" : del ? "Moyen" : "Faible") as Level,
          };
        }),
    [logs, allUser]
  );

  const hasData = real.length > 0;
  const rows: Row[] = hasData ? real : DEMO_ROWS;
  const total = hasData ? real.length : 12487;
  const pageCount = Math.max(1, Math.ceil(rows.length / 6));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * 6, current * 6);

  const kpi = useMemo(() => {
    if (!hasData) return { events: "12 487", threats: "2", conf: "99,8%" };
    const day = real.filter((r) => Date.now() - r.date.getTime() < 86400000).length;
    const threats = real.filter((r) => !r.ok || r.del).length;
    const conf = (((real.length - real.filter((r) => !r.ok).length) / real.length) * 100).toFixed(1).replace(".", ",");
    return { events: day.toLocaleString("fr-FR"), threats: String(threats), conf: `${conf}%` };
  }, [real, hasData]);

  const anomalies = useMemo(() => {
    if (!hasData) return DEMO_ANOMALIES;
    const list = real.filter((r) => !r.ok || r.del).slice(0, 3).map((r) => ({
      t: r.ok ? "Suppression à vérifier" : "Échec d'opération détecté",
      s: `${r.u} — ${r.a.toLowerCase()} sur ${r.entity.toLowerCase()} (IP : ${r.ip})`,
      h: ago(r.date),
      lvl: (r.ok ? "Moyen" : "Élevé") as Level,
      kind: r.ok ? "warn" : "bad",
    }));
    return list.length ? list : DEMO_ANOMALIES.slice(1, 2);
  }, [real, hasData]);

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    const low = q.toLowerCase();
    let answer: Msg;
    const pick = (f: (r: (typeof real)[number]) => boolean) => real.filter(f).slice(0, 5);
    if (/(échec|echec|connexion|failed)/.test(low)) {
      const l = pick((r) => !r.ok);
      answer = l.length
        ? { from: "ai", text: `J'ai trouvé ${l.length} échec(s) récent(s) :`, list: l.map((r) => `${r.h} – IP ${r.ip} (${r.u})`), safe: "Aucun risque critique détecté." }
        : { from: "ai", text: "Aucun échec enregistré dans les journaux.", safe: "Aucun risque critique détecté." };
    } else if (/suppress|delete/.test(low)) {
      const l = pick((r) => r.del);
      answer = { from: "ai", text: l.length ? `${l.length} suppression(s) récente(s) :` : "Aucune suppression enregistrée.", list: l.map((r) => `${r.h} – ${r.entity} (${r.u})`) };
    } else {
      answer = { from: "ai", text: `Je surveille ${total.toLocaleString("fr-FR")} événements, dont ${kpi.threats} à vérifier. Taux de conformité : ${kpi.conf}.` };
    }
    setMessages((m) => [...m, { from: "user", text: q }, answer]);
    setQuestion("");
  };

  const stat = (Icon: LucideIcon, label: string, value: string, sub: string, color: string) => (
    <div className="flex items-center gap-3 pl-5 border-l border-white/20 first:border-0">
      <div className="w-11 h-11 rounded-full border border-white/40 flex items-center justify-center"><Icon size={22} /></div>
      <div>
        <p className="text-[11px] opacity-90">{label}</p>
        <p className={`text-lg font-bold leading-tight ${color}`}>{value} <span className="text-[10px] opacity-60 font-normal">{sub}</span></p>
      </div>
    </div>
  );

  return (
    <section className="rounded-xl overflow-hidden border border-[#1c4fb5] shadow-md">
      {/* Bandeau */}
      <div className="bg-gradient-to-r from-[#0a2a73] via-[#0b3590] to-[#0d46b5] text-white px-5 py-3 flex flex-wrap items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-[#1d6fe0]/80 flex items-center justify-center shrink-0"><Bot size={28} /></div>
        <div className="mr-auto">
          <h3 className="text-xl font-bold flex items-center gap-2">
            Audit Logs <span className="font-normal opacity-80">—</span> Géré par l'IA
            <span className="text-[10px] bg-[#1fae6a] px-2 py-0.5 rounded-full">IA</span>
          </h3>
          <p className="text-xs opacity-90">Surveillance intelligente, sécurité renforcée</p>
        </div>
        {stat(Wrench, "Événements analysés", kpi.events, "(24h)", "text-[#4aa3ff]")}
        {stat(ShieldAlert, "Menaces détectées", kpi.threats, "(bloquées)", "text-[#4aa3ff]")}
        {stat(CheckCircle2, "Taux de conformité", kpi.conf, "", "text-[#4ade80]")}
        {onSetToAudit && currentUser?.role === "Propriétaire" && (
          <button onClick={() => onSetToAudit("Audit")} className="bg-white text-[#0b2a6b] text-xs font-bold px-3 py-2 rounded-md hover:bg-blue-50">
            Voir tout
          </button>
        )}
      </div>

      {/* Corps */}
      <div className="bg-[#eef4fd] p-3 grid grid-cols-1 xl:grid-cols-[1.45fr_1fr_0.95fr] gap-3 text-[#10285e]">
        {/* Activité récente */}
        <div className="bg-white rounded-lg border border-[#d4e0f3] p-3">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-sm">Activité récente (analyse IA)</h4>
            <span className="text-[10px] text-[#1255d6]">Voir tout</span>
          </div>
          <div className="overflow-x-auto border border-[#d4e0f3] rounded-md">
            <table className="w-full text-[10px]">
              <thead className="bg-[#e6eefb] text-[#12306e]">
                <tr>{["Heure", "Utilisateur", "Action", "Ressource", "Résultat", "IP", "Risque"].map((h) => <th key={h} className="text-left font-semibold px-2 py-1.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} className={i % 2 ? "bg-[#f4f8fe]" : "bg-white"}>
                    <td className="px-2 py-1.5">{r.h}</td>
                    <td className="px-2">{r.u}</td>
                    <td className="px-2">{r.a}</td>
                    <td className="px-2">{r.r}</td>
                    <td className="px-2">
                      <span className={`px-1.5 py-0.5 rounded border ${r.ok ? "bg-[#e3f7ec] text-[#14894f] border-[#bfe8d1]" : "bg-[#ffe3e6] text-[#d02925] border-[#f5c2c0]"}`}>{r.ok ? "Succès" : "Échec"}</span>
                    </td>
                    <td className="px-2">{r.ip}</td>
                    <td className="px-2"><span className={`px-1.5 py-0.5 rounded-full border ${badge[r.risk]}`}>{r.risk}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, pageCount) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`w-5 h-5 rounded border text-[10px] ${p === current ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-white"}`}>{p}</button>
              ))}
              <button disabled={current === pageCount} onClick={() => setPage(current + 1)} className="w-5 h-5 rounded border bg-white disabled:opacity-40">›</button>
            </div>
            <span>Total : {total.toLocaleString("fr-FR").replace(/\s/g, "")} événements</span>
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-white rounded-lg border border-[#d4e0f3] p-3">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-sm flex items-center gap-2"><ShieldCheck size={16} className="text-[#1255d6]" /> Détection des anomalies (IA)</h4>
            <span className="text-[10px] text-[#1255d6]">Voir tout</span>
          </div>
          <ul className="space-y-3">
            {anomalies.map((a) => {
              const { c, Icon } = kindStyle[a.kind];
              return (
                <li key={a.t + a.h} className="flex items-start gap-2.5 text-[11px] border border-[#e1eaf7] rounded-lg p-2">
                  <span className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${c}`}><Icon size={16} /></span>
                  <div className="flex-1">
                    <p className="font-semibold text-[#e0592a]" style={{ color: a.kind === "info" ? "#14894f" : a.kind === "bad" ? "#d02925" : "#d97706" }}>{a.t}</p>
                    <p className="text-gray-600">{a.s}</p>
                    <p className="text-gray-400 text-[10px]">{a.h}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badge[a.lvl]}`}>{a.lvl}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Phoenix AI */}
        <div className="bg-gradient-to-b from-[#0b2a6b] to-[#0a2457] border border-[#2a5bc0] rounded-lg p-3 text-white text-[11px] flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Ship size={26} />
            <div>
              <p className="font-bold text-xs">Phoenix AI <span className="font-normal">— Assistant Audit</span></p>
              <p className="text-[10px] opacity-80">Posez vos questions sur la sécurité et les logs.</p>
            </div>
          </div>
          <div className="flex-1 space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {messages.map((m, i) =>
              m.from === "user" ? (
                <div key={i} className="bg-[#3b6fe0] rounded-lg px-3 py-2 ml-6 w-fit self-end">{m.text}</div>
              ) : (
                <div key={i} className="flex gap-2 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#1fae6a] flex items-center justify-center shrink-0"><Bot size={13} /></span>
                  <div className="bg-[#2a58b8] rounded-lg p-2">
                    <p>{m.text}</p>
                    {m.list && <ul className="list-disc pl-4 my-1">{m.list.map((l) => <li key={l}>{l}</li>)}</ul>}
                    {m.safe && <p className="text-[#4ade80] flex items-center gap-1"><CheckCircle2 size={12} /> {m.safe}</p>}
                  </div>
                </div>
              )
            )}
          </div>
          <div className="flex items-center bg-white/10 border border-white/20 rounded-md mt-3 pr-1">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Posez votre question..." className="bg-transparent flex-1 px-3 py-2 outline-none placeholder:text-white/60" />
            <button onClick={ask} className="w-7 h-7 rounded bg-[#1d6fe0] flex items-center justify-center"><Send size={13} /></button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ====== Fin section Audit ======

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

      {/* Section Audit Logs IA */}
      <AuditSection onSetToAudit={onSetToAudit} />

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