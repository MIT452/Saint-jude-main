import { FC, useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Calendar, ShieldCheck, ShieldAlert, AlertTriangle, Bell, ChevronDown, ArrowUp, ArrowDown, ArrowRight, Bot, Brain,
  Settings2, Trash2, Pencil, CalendarCheck, Cog, MoreHorizontal, Box, UserCircle2, FileText, X, Clock, LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { onGetService } from "../data/service";
import { AuditLog } from "../data/type";
import { findUser } from "../Tools/Tools";
import { askAI } from "../data/auditAI";
import { fetchAuditAlerts, fetchAuditLogs, reviewAuditAlert, verifyAuditChain } from "../data/auditApi";
import type { ChainState, ServerAlert, ServerLog } from "../data/auditApi";
import AuditModal from "./AuditModal";

type types = "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";
type Level = "Faible" | "Moyen" | "Élevé";
type Risk = "Normal" | "Anomalie" | "Risque";
type Row = {
  log: AuditLog; date: Date; user: string; userId: string; entity: string; entityFr: string; act: string; actKey: string;
  ok: boolean; risk: Risk; ip: string; details: string; docId?: string;
};
type AlertItem = { id: string; t: string; s: string; h: string; lvl: Level };

const PAGE = 8;
const DAY = 86400000;
const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#94a3b8"];
const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ACTION: Record<string, string> = {
  create: "CRÉATION", update: "MODIFICATION", delete: "SUPPRESSION", login: "CONNEXION", login_failed: "ÉCHEC DE CONNEXION",
};
const ENTITY_FR: Record<string, string> = {
  Goods: "marchandise", User: "utilisateur", Reservation: "réservation", Trip: "trajet", Boat: "bateau", CashMovement: "caisse",
  FuelConsumption: "carburant", Auth: "connexion",
};
const MODAL_ENTITIES = ["Goods", "User", "Reservation", "Trip", "Boat", "CashMovement", "FuelConsumption"];

// Nom de table du backend -> clé d'entité utilisée par la page
const RESOURCE_TO_ENTITY: Record<string, string> = {
  goods: "Goods", user: "User", reservations: "Reservation", "reservations-ai": "Reservation", trips: "Trip",
  boats: "Boat", cashmovements: "CashMovement", fuelconsumptions: "FuelConsumption", auth: "Auth",
};

// Règles de détection déterministes (côté backend)
const RULE_LABEL: Record<string, string> = {
  BRUTE_FORCE: "Tentatives de connexion répétées (force brute)",
  LOGIN_FAILED_REPEAT: "Échecs de connexion répétés",
  CASH_MODIFIED: "Mouvement de caisse modifié",
  OFF_HOURS: "Activité hors horaires (22h–5h)",
};

const riskStyle: Record<Risk, string> = {
  Normal: "bg-[#e3f6ec] text-[#14894f]",
  Anomalie: "bg-[#ffe3e3] text-[#d02925]",
  Risque: "bg-[#fff0d9] text-[#d97706]",
};
const lvlBadge: Record<Level, string> = {
  Faible: "bg-[#e3f6ec] text-[#14894f]",
  Moyen: "bg-[#fff0d9] text-[#d97706]",
  Élevé: "bg-[#ffe3e3] text-[#d02925]",
};
const lvlIcon: Record<Level, string> = { Faible: "text-[#14894f]", Moyen: "text-[#f59e0b]", Élevé: "text-[#e5342f]" };

const actStyle = (k: string): { color: string; bg: string; Icon: LucideIcon } => {
  if (k === "delete") return { color: "text-[#e5342f]", bg: "bg-[#e5342f]", Icon: Trash2 };
  if (k === "update") return { color: "text-[#10b981]", bg: "bg-[#10b981]", Icon: Pencil };
  if (k === "create") return { color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]", Icon: CalendarCheck };
  if (k === "login") return { color: "text-[#1255d6]", bg: "bg-[#1255d6]", Icon: LogIn };
  if (k === "login_failed") return { color: "text-[#e5342f]", bg: "bg-[#e5342f]", Icon: ShieldAlert };
  return { color: "text-gray-500", bg: "bg-gray-400", Icon: Cog };
};

const ago = (d: Date) => {
  const m = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `Il y a ${h} h` : `Il y a ${Math.round(h / 24)} j`;
};
const trend = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

// Texte lisible pour une entrée du journal sécurisé
const describe = (l: ServerLog): string => {
  const d = l.details;
  if (l.action === "LOGIN") return "Connexion réussie";
  if (l.action === "LOGIN_FAILED") return `Échec de connexion${d?.email ? ` (${d.email})` : ""}`;
  if (d?.event === "register") return "Inscription d'un nouvel utilisateur";
  if (d?.event === "change-password") return "Changement de mot de passe";
  const label = ACTION[l.action.toLowerCase()] ?? l.action;
  const name = ENTITY_FR[RESOURCE_TO_ENTITY[l.resource] ?? l.resource] ?? l.resource;
  const http = d?.httpStatus ? ` (HTTP ${d.httpStatus})` : "";
  return `${label.charAt(0) + label.slice(1).toLowerCase()} — ${name}${http}`;
};

// Convertit une entrée du journal sécurisé au format attendu par la page
const toAuditLog = (l: ServerLog): AuditLog =>
  ({
    _id: String(l.id),
    createdAt: l.created_at,
    userId: l.user_id ?? "",
    collectionName: RESOURCE_TO_ENTITY[l.resource] ?? l.resource,
    action: l.action.toLowerCase(),
    documentId: l.resource_id ?? "",
    status: l.result === "FAILURE" ? "FAILED" : "SUCCESS",
    ip: l.ip_address ?? "—",
    details: describe(l),
    serverStatus: l.status,
    actor: l.details?.email,
    after: l.resource_id ? { id: l.resource_id } : undefined,
  }) as unknown as AuditLog;

// Contexte envoyé à l'IA : elle résume, elle ne décide pas
const buildContext = (rows: Row[], alerts: AlertItem[]) => {
  const lines = rows.slice(0, 40).map((r) => `${r.date.toISOString().slice(0, 16)} | ${r.user} | ${r.act} | ${r.entityFr} | ${r.ok ? "Succès" : "Échec"} | IP ${r.ip}`);
  const alertLines = alerts.slice(0, 10).map((a) => `${a.t} (${a.lvl})`).join("; ") || "aucune";
  return `Journaux d'audit SAINT-JUDE (transport maritime). Total: ${rows.length}, échecs: ${rows.filter((r) => !r.ok).length}, suppressions: ${rows.filter((r) => r.actKey === "delete").length}.\nAlertes levées par les règles de détection (${alerts.length}): ${alertLines}\nDerniers événements (date | utilisateur | action | ressource | résultat | IP):\n${lines.join("\n")}`;
};

const Audit: FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);
  const [chain, setChain] = useState<ChainState | null | undefined>(undefined);
  const [source, setSource] = useState<"server" | "legacy">("server");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ id: string; type: types } | null>(null);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [userF, setUserF] = useState("");
  const [actF, setActF] = useState("");
  const [resF, setResF] = useState("");
  const [statF, setStatF] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ search: "", user: "", act: "", res: "", stat: "", from: "", to: "" });

  const [refresh, setRefresh] = useState(0);
  const [showParams, setShowParams] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const allUser = useSelector((state: RootState) => state.users.allUser);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  const load = useCallback(async () => {
    try {
      const [serverLogs, serverAlerts, chainState] = await Promise.all([
        fetchAuditLogs(500),
        fetchAuditAlerts(false),
        verifyAuditChain().catch(() => null),
      ]);
      setLogs(serverLogs.map(toAuditLog));
      setAlerts(serverAlerts);
      setChain(chainState);
      setSource("server");
    } catch (e) {
      console.error("Journal d'audit sécurisé indisponible, repli sur l'ancien journal", e);
      try {
        setLogs(await onGetService<AuditLog>("allaudit"));
        setAlerts([]);
        setChain(null);
        setSource("legacy");
      } catch (e2) {
        console.error("Erreur logs", e2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refresh]);

  const rows = useMemo<Row[]>(
    () =>
      [...logs]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((log) => {
          const u = findUser(log.userId, allUser);
          const entity = String(log.collectionName);
          const ok = (log as any).status !== "FAILED";
          const actKey = String(log.action);
          const act = ACTION[actKey] ?? actKey.toUpperCase();
          const entityFr = ENTITY_FR[entity] ?? entity.toLowerCase();
          const serverStatus = (log as any).serverStatus as string | undefined;
          const risk: Risk = serverStatus
            ? serverStatus === "CRITIQUE" ? "Anomalie" : serverStatus === "SUSPECT" ? "Risque" : "Normal"
            : !ok ? "Risque" : actKey === "delete" ? "Anomalie" : "Normal";
          return {
            log, entity, entityFr, act, actKey, ok, risk,
            date: new Date(log.createdAt),
            user: u ? `${u.name} ${u.lastName}` : ((log as any).actor ?? "system"),
            userId: String(log.userId),
            ip: (log as any).ip ?? (log as any).ipAddress ?? "—",
            details: (log as any).details ?? `${act.charAt(0) + act.slice(1).toLowerCase()} — ${entityFr}`,
            docId: MODAL_ENTITIES.includes(entity) ? (log as any).after?.id : undefined,
          };
        }),
    [logs, allUser]
  );

  // ---------- Alertes : levées par les règles du backend (l'IA ne décide pas)
  const anomalies = useMemo<AlertItem[]>(
    () =>
      alerts.map((a) => ({
        id: String(a.id),
        t: RULE_LABEL[a.rule] ?? a.rule,
        s: `${ENTITY_FR[RESOURCE_TO_ENTITY[a.resource] ?? a.resource] ?? a.resource} · IP ${a.ip_address ?? "—"}`,
        h: ago(new Date(a.created_at)),
        lvl: (a.severity === "CRITIQUE" ? "Élevé" : "Moyen") as Level,
      })),
    [alerts]
  );

  const onReview = async (id: string, falsePositive: boolean) => {
    try {
      await reviewAuditAlert(id, falsePositive);
      setAlerts((prev) => prev.filter((a) => String(a.id) !== id));
    } catch (e) {
      console.error("Revue de l'alerte impossible", e);
    }
  };

  // ---------- Statistiques réelles
  const now = Date.now();
  const stats = useMemo(() => {
    const cur = rows.filter((r) => now - r.date.getTime() < 30 * DAY);
    const prev = rows.filter((r) => now - r.date.getTime() >= 30 * DAY && now - r.date.getTime() < 60 * DAY);
    const sec = (r: Row) => !r.ok || r.risk !== "Normal" || r.actKey === "delete" || r.entity === "User";
    const users = (list: Row[]) => new Set(list.map((r) => r.userId)).size;
    const day = rows.filter((r) => now - r.date.getTime() < DAY);
    return {
      total: rows.length, totalT: trend(cur.length, prev.length),
      security: rows.filter(sec).length, securityT: trend(cur.filter(sec).length, prev.filter(sec).length),
      users: users(cur), usersT: trend(users(cur), users(prev)),
      resources: new Set(rows.map((r) => r.entity)).size,
      critical24: day.filter((r) => !r.ok || r.risk !== "Normal" || r.actKey === "delete").length,
      conf24: day.length ? Math.round((day.filter((r) => r.ok).length / day.length) * 100) : null,
    };
  }, [rows, now]);

  const series = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const x = new Date();
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - (29 - i));
      return { d: `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`, key: x.getTime(), normal: 0, anomalies: 0, echecs: 0 };
    });
    rows.forEach((r) => {
      const t = new Date(r.date); t.setHours(0, 0, 0, 0);
      const day = days.find((x) => x.key === t.getTime());
      if (!day) return;
      if (!r.ok) day.echecs++; else if (r.actKey === "delete" || r.risk !== "Normal") day.anomalies++; else day.normal++;
    });
    return days;
  }, [rows]);

  const pie = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.entityFr, (map.get(r.entityFr) ?? 0) + 1));
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (others) top.push(["autres", others]);
    return top.map(([name, value], i) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: PIE_COLORS[i % PIE_COLORS.length], pct: Math.round((value / rows.length) * 100) }));
  }, [rows]);

  const critical = useMemo(() => rows.filter((r) => r.risk !== "Normal").slice(0, 5), [rows]);

  // ---------- Filtres + pagination
  const options = useMemo(() => ({
    users: Array.from(new Set(rows.map((r) => r.user))),
    acts: Array.from(new Set(rows.map((r) => r.act))),
    res: Array.from(new Set(rows.map((r) => r.entity))),
  }), [rows]);

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.act} ${r.user} ${r.log.documentId} ${r.details} ${r.entityFr}`.toLowerCase().includes(q)) return false;
      if (applied.user && r.user !== applied.user) return false;
      if (applied.act && r.act !== applied.act) return false;
      if (applied.res && r.entity !== applied.res) return false;
      if (applied.stat === "ok" && !r.ok) return false;
      if (applied.stat === "ko" && r.ok) return false;
      const t = r.date.getTime();
      if (applied.from && t < new Date(applied.from).getTime()) return false;
      if (applied.to && t > new Date(applied.to).getTime() + DAY - 1) return false;
      return true;
    });
  }, [rows, applied]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE;
  const pageRows = filtered.slice(start, start + PAGE);
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => Math.max(1, Math.min(current - 2, pageCount - 4)) + i);

  const onSearch = () => { setApplied({ search, user: userF, act: actF, res: resF, stat: statF, from, to }); setPage(1); };
  const onReset = () => {
    setSearch(""); setUserF(""); setActF(""); setResF(""); setStatF(""); setFrom(""); setTo("");
    setApplied({ search: "", user: "", act: "", res: "", stat: "", from: "", to: "" }); setPage(1);
  };

  // ---------- Rapport IA (à la demande) : l'IA résume, les règles ont déjà décidé
  const genReport = async () => {
    setShowReport(true);
    setReportBusy(true);
    const text = await askAI(`${buildContext(rows, anomalies)}\n\nLes alertes ci-dessus ont été levées par des règles déterministes : ne les contredis pas et n'en invente pas. Rédige en français un court rapport d'audit du dernier jour (5 lignes maximum): activité, anomalies, recommandations. Appuie-toi uniquement sur les journaux ci-dessus.`);
    setReport(text ?? `Rapport calculé localement : ${rows.filter((r) => now - r.date.getTime() < DAY).length} événement(s) sur 24h, ${stats.critical24} critique(s), ${anomalies.length} alerte(s) à examiner.${stats.conf24 != null ? ` Conformité : ${stats.conf24}%.` : ""} (IA indisponible)`);
    setReportBusy(false);
  };

  if (loading) return <p className="text-center p-4">Chargement des logs...</p>;

  const d = new Date();
  const dateLabel = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Badge d'intégrité de la chaîne SHA-256
  const badgeIntegrity =
    chain === undefined ? { t: "Vérification…", c: "bg-gray-100 text-gray-500" }
    : chain === null ? { t: "Intégrité non vérifiée", c: "bg-[#fff0d9] text-[#d97706]" }
    : chain.ok ? { t: `Journal intègre (${chain.count ?? 0} entrées)`, c: "bg-[#d9f5e6] text-[#14894f]" }
    : { t: `Chaîne rompue${chain.brokenAtId ? ` (entrée ${chain.brokenAtId})` : ""}`, c: "bg-[#ffe3e3] text-[#d02925]" };

  const kpis: { label: string; value: number; t: number | null; icon: LucideIcon; bg: string; lc?: string }[] = [
    { label: "Total des logs", value: stats.total, t: stats.totalT, icon: FileText, bg: "bg-[#1d6fe0]" },
    { label: "Événements de sécurité", value: stats.security, t: stats.securityT, icon: ShieldCheck, bg: "bg-[#12a66a]" },
    { label: "Alertes à examiner", value: anomalies.length, t: null, icon: AlertTriangle, bg: "bg-[#e5342f]", lc: "text-[#e5342f]" },
    { label: "Utilisateurs actifs", value: stats.users, t: stats.usersT, icon: UserCircle2, bg: "bg-[#7c3aed]", lc: "text-[#7c3aed]" },
    { label: "Ressources surveillées", value: stats.resources, t: null, icon: Box, bg: "bg-[#f59e0b]", lc: "text-[#f59e0b]" },
  ];

  return (
    <div className="p-5 bg-[#f3f7fd] min-h-full space-y-4 text-[#10285e]">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#10285e] text-white flex items-center justify-center"><ShieldCheck size={26} /></div>
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold flex items-center gap-3">
            Audit Logs — SAINT-AI
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeIntegrity.c}`}>● {badgeIntegrity.t}</span>
          </h1>
          <p className="text-sm text-[#3e5788]">Traçabilité · Détection d'anomalies · Sécurité · Assistant intelligent</p>
        </div>
        <div className="relative min-w-[300px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Rechercher un utilisateur, une action, une ressource..." className="w-full bg-white border border-[#dbe5f5] rounded-full pl-9 pr-3 py-2 text-xs" />
        </div>
        <div className="relative w-10 h-10 bg-white border border-[#dbe5f5] rounded-full flex items-center justify-center">
          <Bell size={18} />
          {anomalies.length > 0 && <span className="absolute -top-1 -right-1 bg-[#e5342f] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{anomalies.length}</span>}
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#dbe5f5] rounded-full pl-1 pr-3 py-1">
          <div className="w-8 h-8 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><UserCircle2 size={18} /></div>
          <span className="text-sm font-semibold">{currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.name ?? "Administrateur"}</span>
          <ChevronDown size={14} />
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#dbe5f5] rounded-xl px-3 py-1.5 text-xs">
          <Calendar size={20} className="text-[#1255d6]" />
          <div><p className="font-semibold capitalize">{dateLabel}</p><p>{pad(d.getHours())}:{pad(d.getMinutes())}</p></div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-[#dbe5f5] p-4 flex gap-3 items-center shadow-sm">
              <div className={`w-14 h-14 rounded-full ${k.bg} text-white flex items-center justify-center shrink-0`}><Icon size={26} /></div>
              <div>
                <p className={`text-xs font-semibold ${k.lc ?? ""}`}>{k.label}</p>
                <p className="text-3xl font-extrabold leading-tight">{k.value.toLocaleString("fr-FR")}</p>
                {k.t !== null ? (
                  <p className={`text-[11px] font-semibold flex items-center gap-1 ${k.t >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {k.t >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{k.t >= 0 ? "+" : ""}{k.t}%
                    <span className="text-gray-500 font-normal">vs période précédente</span>
                  </p>
                ) : <p className="text-[11px] text-gray-400">&nbsp;</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Graphiques + IA */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr_1.05fr_1fr] gap-3">
        <div className="bg-white rounded-xl border border-[#dbe5f5] p-4 shadow-sm">
          <h3 className="font-bold text-[#1255d6]">Évolution des événements <span className="text-xs font-normal text-gray-500">(30 derniers jours)</span></h3>
          <div className="flex gap-4 text-[11px] my-2">
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#2563eb] inline-block" />Actions normales</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#ef4444] inline-block" />Anomalies</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#f59e0b] inline-block" />Échecs</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={series}>
              <defs><linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" />
              <XAxis dataKey="d" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RTooltip />
              <Area type="monotone" dataKey="normal" stroke="#2563eb" strokeWidth={2} fill="url(#gN)" name="Actions normales" />
              <Area type="monotone" dataKey="echecs" stroke="#f59e0b" strokeWidth={2} fill="none" name="Échecs" />
              <Area type="monotone" dataKey="anomalies" stroke="#ef4444" strokeWidth={2} fill="none" name="Anomalies" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#dbe5f5] p-4 shadow-sm">
          <h3 className="font-bold text-[#1255d6]">Répartition des actions</h3>
          {rows.length === 0 ? <p className="text-xs text-gray-500 py-16 text-center">Aucune donnée.</p> : (
            <div className="flex items-center gap-2">
              <div className="relative w-[170px] h-[190px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pie} dataKey="value" innerRadius={50} outerRadius={80} stroke="#fff">{pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-extrabold">{stats.total.toLocaleString("fr-FR")}</span><span className="text-xs">logs</span>
                </div>
              </div>
              <ul className="text-xs space-y-2 flex-1">
                {pie.map((p) => (
                  <li key={p.name} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} /><span className="flex-1">{p.name}</span><b>{p.pct}%</b></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#dbe5f5] p-4 shadow-sm">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-[#e5342f]" /> Derniers événements critiques</h3>
          <ul className="space-y-2.5">
            {critical.length === 0 && <li className="text-xs text-gray-500">Aucun événement critique.</li>}
            {critical.map((r) => (
              <li key={String(r.log._id)} className="flex items-start gap-2 text-xs border-b last:border-0 pb-2">
                <span className={`mt-1 w-2 h-2 rounded-full ${r.risk === "Anomalie" ? "bg-[#e5342f]" : "bg-[#f59e0b]"}`} />
                <div className="flex-1">
                  <p className="font-semibold">{r.act.charAt(0) + r.act.slice(1).toLowerCase()} — {r.entityFr}</p>
                  <p className="text-gray-500">{r.user} - {fmtDate(r.date)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskStyle[r.risk]}`}>{r.risk}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-[#dbe5f5] p-4 shadow-sm relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1d4fb8] text-white flex items-center justify-center"><Bot size={26} /></div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">SAINT-AI Audit Intelligence</h3>
              <p className="text-[10px] text-gray-500">Règles de détection + résumé par IA</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${source === "server" ? "bg-[#d9f5e6] text-[#14894f]" : "bg-gray-100 text-gray-500"}`}>● {source === "server" ? "Règles actives" : "Ancien journal"}</span>
          </div>
          <div className="mt-3 bg-[#eef4ff] rounded-lg p-3 text-[11px]">
            <p className="font-bold text-xs">{anomalies.length ? `${anomalies.length} alerte(s) à examiner` : "Aucune alerte à examiner"}</p>
            {anomalies.slice(0, 2).map((a) => <p key={a.id} className="text-gray-700">{a.t}</p>)}
          </div>
          <div className="grid grid-cols-[1.3fr_1fr] gap-2 mt-3">
            <button onClick={genReport} className="bg-[#1255d6] text-white text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-1"><Brain size={14} /> Voir le rapport IA</button>
            <button onClick={() => setShowParams((v) => !v)} className="border border-[#cfdcf3] text-xs py-2 rounded-md flex items-center justify-center gap-1"><Settings2 size={14} /> Paramètres</button>
          </div>
          {showParams && (
            <div className="absolute right-3 top-full mt-1 z-20 w-72 bg-white border border-[#cfdcf3] rounded-lg shadow-lg p-3 text-[11px] space-y-2">
              <p><b>Source :</b> {source === "server" ? "journal d'audit sécurisé (chaîne SHA-256)" : "ancien journal"}</p>
              <p><b>Règles :</b> 5 échecs de connexion en 10 min (critique), 3 échecs (suspect), modification de caisse, activité entre 22h et 5h.</p>
              <p><b>Entrées chargées :</b> {rows.length}</p>
              <button onClick={() => { setRefresh((n) => n + 1); setShowParams(false); }} className="w-full bg-[#1255d6] text-white rounded-md py-1.5 font-semibold">Actualiser</button>
            </div>
          )}
        </div>
      </div>

      {/* Tableau + colonne droite */}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-3">
        <div className="bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} placeholder="Rechercher dans les logs..." className="w-full border rounded-md pl-8 pr-2 py-2 text-xs bg-[#f8fafd]" />
            </div>
            <select value={userF} onChange={(e) => setUserF(e.target.value)} className="border rounded-md px-2 py-2 text-xs bg-[#f8fafd]"><option value="">Tous les utilisateurs</option>{options.users.map((u) => <option key={u}>{u}</option>)}</select>
            <select value={actF} onChange={(e) => setActF(e.target.value)} className="border rounded-md px-2 py-2 text-xs bg-[#f8fafd]"><option value="">Toutes les actions</option>{options.acts.map((u) => <option key={u}>{u}</option>)}</select>
            <select value={resF} onChange={(e) => setResF(e.target.value)} className="border rounded-md px-2 py-2 text-xs bg-[#f8fafd]"><option value="">Toutes les ressources</option>{options.res.map((u) => <option key={u} value={u}>{ENTITY_FR[u] ?? u}</option>)}</select>
            <select value={statF} onChange={(e) => setStatF(e.target.value)} className="border rounded-md px-2 py-2 text-xs bg-[#f8fafd]"><option value="">Tous les statuts</option><option value="ok">Succès</option><option value="ko">Échec</option></select>
            <div className="flex items-center gap-1 border rounded-md px-2 py-1 text-xs bg-[#f8fafd]">
              <Calendar size={13} />
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" />
              <ArrowRight size={12} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" />
            </div>
            <button onClick={onSearch} className="bg-[#1255d6] hover:bg-[#0e45b3] text-white text-xs font-semibold px-4 py-2 rounded-md">Rechercher</button>
            <button onClick={onReset} className="border border-[#9db8ea] text-[#1255d6] text-xs px-3 py-2 rounded-md hover:bg-blue-50">Réinitialiser</button>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="min-w-full text-[11px]">
              <thead className="bg-[#f1f5fb] text-[#12306e]">
                <tr>{["Date / Heure", "Utilisateur", "Action", "Ressource", "Détails", "IP Address", "Résultat", "Statut", "Actions"].map((h) => <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-500">Aucun log disponible.</td></tr>}
                {pageRows.map((r) => {
                  const st = actStyle(r.actKey);
                  return (
                    <tr key={String(r.log._id)} className={`border-b ${r.docId ? "cursor-pointer hover:bg-blue-50/50" : ""}`}
                      onClick={() => r.docId && setModal({ id: r.docId, type: r.entity as types })}>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2.5">{r.user}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-md ${st.bg} text-white flex items-center justify-center`}><st.Icon size={13} /></span>
                          <span className={`font-semibold ${st.color}`}>{r.act}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{r.entityFr}{r.log.documentId ? ` (ID: ${r.log.documentId})` : ""}</td>
                      <td className="px-3 py-2.5 max-w-[240px] truncate">{r.details}</td>
                      <td className="px-3 py-2.5">{r.ip}</td>
                      <td className={`px-3 py-2.5 font-medium ${r.ok ? "text-[#14894f]" : "text-[#e5342f]"}`}>{r.ok ? "Succès" : "Échec"}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskStyle[r.risk]}`}>{r.risk !== "Normal" && <AlertTriangle size={10} />}{r.risk}</span></td>
                      <td className="px-3 py-2.5"><MoreHorizontal size={16} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-[11px] text-gray-600">
            <span>Affichage de {filtered.length === 0 ? 0 : start + 1} à {Math.min(start + PAGE, filtered.length)} sur {filtered.length.toLocaleString("fr-FR")} logs</span>
            <div className="flex gap-1">
              <button disabled={current === 1} onClick={() => setPage(current - 1)} className="w-7 h-7 border rounded bg-white disabled:opacity-40">‹</button>
              {pages.map((p) => <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 border rounded ${p === current ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-white"}`}>{p}</button>)}
              {pageCount > 5 && current < pageCount - 2 && <><span className="px-1 self-center">...</span><button onClick={() => setPage(pageCount)} className="min-w-7 h-7 px-1 border rounded bg-white">{pageCount}</button></>}
              <button disabled={current === pageCount} onClick={() => setPage(current + 1)} className="w-7 h-7 border rounded bg-white disabled:opacity-40">›</button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-[#dbe5f5] p-4 shadow-sm">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-2"><ShieldAlert size={16} className="text-[#1255d6]" /> Alertes de détection</h3>
            <ul className="space-y-3">
              {anomalies.length === 0 && <li className="text-xs text-gray-500">{rows.length ? "Aucune alerte à examiner." : "Aucun événement à analyser."}</li>}
              {anomalies.slice(0, 5).map((a) => (
                <li key={a.id} className="flex gap-2 text-[11px] items-start">
                  <ShieldAlert size={18} className={lvlIcon[a.lvl]} />
                  <div className="flex-1">
                    <p className="font-semibold">{a.t}</p>
                    <p className="text-gray-500">{a.s}</p>
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => onReview(a.id, false)} className="text-[10px] border border-[#cfdcf3] rounded px-1.5 py-0.5 hover:bg-blue-50">Examinée</button>
                      <button onClick={() => onReview(a.id, true)} className="text-[10px] border border-[#f3cfcf] text-[#d02925] rounded px-1.5 py-0.5 hover:bg-red-50">Faux positif</button>
                    </div>
                  </div>
                  <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lvlBadge[a.lvl]}`}>{a.lvl === "Élevé" ? "Critique" : a.lvl}</span><p className="text-[9px] text-gray-400 mt-0.5">{a.h}</p></div>
                </li>
              ))}
            </ul>
            {anomalies.length > 5 && <p className="text-[10px] text-gray-400 mt-2">+ {anomalies.length - 5} autre(s) alerte(s)</p>}
          </div>

          <div className="bg-white rounded-xl border border-[#dbe5f5] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><FileText size={16} className="text-[#1255d6]" /> Rapport IA (dernier jour)</h3>
              <button onClick={genReport} className="bg-[#1255d6] text-white text-[11px] font-semibold px-3 py-1.5 rounded-md">Générer</button>
            </div>
            <div className="grid grid-cols-3 text-center text-[10px] text-gray-600 divide-x">
              <div><p className="text-lg font-bold text-[#e5342f]">{anomalies.length}</p>Alertes à examiner</div>
              <div><p className="text-lg font-bold text-[#f59e0b]">{stats.critical24}</p>Événements critiques</div>
              <div><p className="text-lg font-bold text-[#14894f]">{stats.conf24 != null ? `${stats.conf24}%` : "—"}</p>Taux de conformité</div>
            </div>
          </div>

          <div className="bg-[#0b2a6b] text-white rounded-xl p-4 flex items-center gap-3">
            <ShieldCheck size={32} />
            <div><p className="font-bold text-sm">SAINT-AI Audit Intelligence</p><p className="text-[11px] text-[#7fb2ff]">Une IA au service de votre sécurité</p></div>
          </div>
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold flex items-center gap-2"><Brain size={18} className="text-[#1255d6]" /> Rapport IA — dernier jour</h3>
              <button onClick={() => setShowReport(false)}><X size={18} /></button>
            </div>
            {reportBusy ? <p className="text-sm text-gray-500 flex items-center gap-2"><Clock size={14} /> SAINT-AI rédige le rapport…</p> : <p className="text-sm whitespace-pre-line">{report}</p>}
          </div>
        </div>
      )}

      {modal && <AuditModal idAfter={modal.id} type={modal.type} onClose={() => setModal(null)} />}
    </div>
  );
};

export default Audit;