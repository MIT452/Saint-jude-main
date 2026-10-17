import { FC, useEffect, useMemo, useState } from "react";
import {
  Search, Calendar, FileText, CheckCircle2, XCircle, Users, User, Server,
  Database, BarChart3, ShieldCheck, Info, ClipboardList, Check,
} from "lucide-react";
import { onGetService } from "../data/service";
import { AuditLog } from "../data/type";
import { findUser } from "../Tools/Tools";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import AuditModal from "./AuditModal";

type types = "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";

const PAGE_SIZE = 8;

const ACTION_SUFFIX: Record<string, string> = {
  create: "CREATED",
  update: "UPDATED",
  delete: "DELETED",
};

const toSnake = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

const fmtDate = (d: string | Date) => {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

const getStatus = (log: AuditLog): "SUCCESS" | "FAILED" =>
  (log as any).status === "FAILED" ? "FAILED" : "SUCCESS";

const STEPS = [
  {
    n: 1, title: "Action réalisée", icon: User,
    box: "bg-[#eaf3ff] border-[#4f8df0]", iconBg: "bg-[#1d6fe0]",
    bullets: ["Création d'une réservation", "Validation / annulation", "Envoi d'e-mail", "Connexion / déconnexion", "Modification de données"],
  },
  {
    n: 2, title: "Backend SAINT-JUDE", icon: Server,
    box: "bg-[#e7f8f1] border-[#34b98a]", iconBg: "bg-[#0f9d78]",
    text: "Identifie l'action, l'utilisateur ou le système, la date, le résultat et les détails.",
  },
  {
    n: 3, title: "Table audit_logs", icon: Database,
    box: "bg-[#f1ecff] border-[#8b6be0]", iconBg: "bg-[#6a43d6]",
    text: "Enregistre l'événement dans la base PostgreSQL pour un suivi complet.",
  },
  {
    n: 4, title: "Consultation", icon: BarChart3,
    box: "bg-[#fff3e6] border-[#f5a35c]", iconBg: "bg-[#f58a1f]",
    text: "L'administrateur consulte les journaux via le tableau de bord.",
  },
];

const FIELDS: [string, string][] = [
  ["id", "Identifiant unique du journal"],
  ["user_id", "Utilisateur responsable (si applicable)"],
  ["action", "Type d'action réalisée (ex. : RESERVATION_CREATED)"],
  ["entity_type", "Type d'objet concerné (ex. : reservation)"],
  ["entity_id", "Identifiant de l'objet concerné"],
  ["status", "SUCCESS ou FAILED"],
  ["details", "Informations complémentaires sans mots de passe ni secrets"],
  ["created_at", "Date et heure de l'événement"],
];

const ADVANTAGES = [
  "Traçabilité complète des actions",
  "Sécurité et détection des anomalies",
  "Suivi des erreurs et des échecs",
  "Aide au diagnostic en cas de problème",
  "Conformité et audit facilité",
];

const AuditLogs: FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModalAudit, setShowModalAudit] = useState<boolean>(false);
  const [auditShow, setAuditShow] = useState<{ idAudit: string; type: types }>();

  // filtres saisis
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // filtres appliqués (bouton Rechercher)
  const [applied, setApplied] = useState({ search: "", dateFrom: "", dateTo: "", type: "", status: "" });
  const [page, setPage] = useState(1);

  const allUser = useSelector((state: RootState) => state.users.allUser);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await onGetService<AuditLog>("allaudit");
        setLogs(response);
      } catch (error) {
        console.error("Erreur lors de la récupération des logs", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const rows = useMemo(
    () =>
      logs.map((log, i) => {
        const user = findUser(log.userId, allUser);
        const userName = user ? `${user.name} ${user.lastName}` : "system";
        const entity = String(log.collectionName);
        return {
          log,
          num: `#${String(i + 1).padStart(3, "0")}`,
          date: fmtDate(log.createdAt),
          userName,
          action: `${toSnake(entity)}_${ACTION_SUFFIX[log.action] ?? String(log.action).toUpperCase()}`,
          entity,
          status: getStatus(log),
          details: (log as any).details ?? "—",
        };
      }),
    [logs, allUser]
  );

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.action} ${r.userName} ${r.log.documentId} ${r.details}`.toLowerCase().includes(q)) return false;
      if (applied.type && r.entity !== applied.type) return false;
      if (applied.status && r.status !== applied.status) return false;
      const t = new Date(r.log.createdAt).getTime();
      if (applied.dateFrom && t < new Date(applied.dateFrom).getTime()) return false;
      if (applied.dateTo && t > new Date(applied.dateTo).getTime() + 86399999) return false;
      return true;
    });
  }, [rows, applied]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const success = filtered.filter((r) => r.status === "SUCCESS").length;
    const failed = total - success;
    const users = new Set(filtered.map((r) => r.log.userId)).size;
    const now = new Date();
    const inMonth = (d: Date, m: number, y: number) => d.getMonth() === m && d.getFullYear() === y;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cur = filtered.filter((r) => inMonth(new Date(r.log.createdAt), now.getMonth(), now.getFullYear())).length;
    const last = filtered.filter((r) => inMonth(new Date(r.log.createdAt), prev.getMonth(), prev.getFullYear())).length;
    const growth = last === 0 ? 0 : Math.round(((cur - last) / last) * 100);
    return {
      total, success, failed, users, growth,
      okPct: total ? ((success / total) * 100).toFixed(1) : "0.0",
      koPct: total ? ((failed / total) * 100).toFixed(1) : "0.0",
    };
  }, [filtered]);

  const typeOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.entity))), [rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
    const first = Math.max(1, Math.min(current - 2, pageCount - 4));
    return first + i;
  });

  const onSearch = () => {
    setApplied({ search, dateFrom, dateTo, type: typeFilter, status: statusFilter });
    setPage(1);
  };
  const onReset = () => {
    setSearch(""); setDateFrom(""); setDateTo(""); setTypeFilter(""); setStatusFilter("");
    setApplied({ search: "", dateFrom: "", dateTo: "", type: "", status: "" });
    setPage(1);
  };

  if (loading) {
    return <p className="text-center p-4">Chargement des logs...</p>;
  }

  return (
    <div className="p-5 bg-[#f4f7fc] min-h-full space-y-4">
      {/* Bandeau */}
      <div className="rounded-xl bg-gradient-to-r from-[#0b3a9e] to-[#0e4fc2] text-white px-6 py-4 flex items-center gap-5 shadow">
        <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
          <ClipboardList size={34} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            Audit Logs <span className="mx-2 font-normal">—</span>
            <span className="text-lg font-semibold">Traçabilité et sécurité des actions</span>
          </h1>
          <p className="text-sm opacity-95">
            Le module Audit Logs enregistre toutes les actions importantes réalisées dans SAINT-JUDE afin d'assurer la
            traçabilité, la sécurité et le suivi des événements.
          </p>
        </div>
      </div>

      {/* Étapes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 items-stretch">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.n} className="contents">
              <div className={`rounded-xl border ${s.box} p-4`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-14 h-14 rounded-full ${s.iconBg} text-white flex items-center justify-center`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="font-bold text-[#123a8f]">{s.n}. {s.title}</h3>
                </div>
                {s.bullets ? (
                  <ul className="list-disc pl-5 text-sm font-medium text-[#12306e] space-y-0.5">
                    {s.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-[#12306e]">{s.text}</p>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex items-center text-[#1d6fe0] text-2xl font-bold">➜</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        {/* Panneau principal */}
        <div className="bg-white rounded-xl border border-[#cdd9ee] shadow-sm p-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[240px] relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une action, un utilisateur, un ID..."
                className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-[#f8fafd]"
              />
            </div>
            <label className="flex items-center border rounded-md text-sm bg-[#f8fafd] overflow-hidden">
              <span className="px-3 text-gray-600">Du</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="py-2 pr-2 bg-transparent outline-none" />
            </label>
            <label className="flex items-center border rounded-md text-sm bg-[#f8fafd] overflow-hidden">
              <span className="px-3 text-gray-600">Au</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="py-2 pr-2 bg-transparent outline-none" />
            </label>
          </div>
          <div className="flex flex-wrap gap-3 items-center mt-3">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-[#f8fafd] min-w-[190px]">
              <option value="">Tous les types</option>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-[#f8fafd] min-w-[190px]">
              <option value="">Tous les statuts</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>
            <button onClick={onSearch} className="flex items-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-sm font-semibold px-5 py-2 rounded-md">
              <Search size={14} /> Rechercher
            </button>
            <button onClick={onReset} className="border border-[#9db8ea] text-[#1255d6] text-sm px-5 py-2 rounded-md hover:bg-blue-50">
              Réinitialiser
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-lg border border-[#b9d3f7] bg-[#eef5ff] p-3 flex gap-3 items-center">
              <div className="w-11 h-11 rounded-lg bg-[#1d6fe0] text-white flex items-center justify-center"><FileText size={22} /></div>
              <div>
                <p className="text-xs text-gray-700">Total des événements</p>
                <p className="text-3xl font-bold text-[#0b2a6b] leading-tight">{stats.total}</p>
                <p className="text-[11px] text-green-600">↑ {stats.growth >= 0 ? "+" : ""}{stats.growth}% <span className="text-gray-500">vs mois précédent</span></p>
              </div>
            </div>
            <div className="rounded-lg border border-[#a9e3c9] bg-[#eefbf5] p-3 flex gap-3 items-center">
              <div className="w-11 h-11 rounded-full bg-[#1fae6a] text-white flex items-center justify-center"><Check size={24} /></div>
              <div>
                <p className="text-xs text-gray-700">Succès</p>
                <p className="text-3xl font-bold text-[#0b4a35] leading-tight">{stats.success}</p>
                <p className="text-[11px] text-green-700">{stats.okPct}%</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#f5bcbc] bg-[#fff1f1] p-3 flex gap-3 items-center">
              <div className="w-11 h-11 rounded-full bg-[#e5342f] text-white flex items-center justify-center"><XCircle size={24} /></div>
              <div>
                <p className="text-xs text-gray-700">Échecs</p>
                <p className="text-3xl font-bold text-[#c0201c] leading-tight">{stats.failed}</p>
                <p className="text-[11px] text-red-600">{stats.koPct}%</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#d4c6f7] bg-[#f5f0ff] p-3 flex gap-3 items-center">
              <div className="w-11 h-11 rounded-lg bg-[#6a43d6] text-white flex items-center justify-center"><Users size={22} /></div>
              <div>
                <p className="text-xs text-gray-700">Utilisateurs</p>
                <p className="text-3xl font-bold text-[#2d1a75] leading-tight">{stats.users}</p>
                <p className="text-[11px] text-gray-500">actifs</p>
              </div>
            </div>
          </div>

          {/* Tableau */}
          <h3 className="font-bold text-[#0b2a6b] mt-5 mb-2">Journaux d'audit</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Aucun log disponible.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-xs bg-white">
                <thead className="bg-[#eef2f9] text-[#12306e]">
                  <tr>
                    {["ID", "Date / Heure", "Utilisateur", "Action", "Type d'entité", "ID Entité", "Statut", "Détails"].map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-2 border-b">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr
                      key={r.log._id}
                      className="hover:bg-blue-50/50 border-b last:border-b-0"
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setAuditShow({ idAudit: r.log.after?.id, type: r.log.collectionName as types });
                        setShowModalAudit(true);
                      }}
                    >
                      <td className="px-3 py-3 text-[#12306e]">{r.num}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-3">{r.userName}</td>
                      <td className="px-3 py-3 font-medium text-[#12306e]">{r.action}</td>
                      <td className="px-3 py-3 text-[#2b5fc7]">{r.entity.toLowerCase()}</td>
                      <td className="px-3 py-3">{r.log.documentId}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                            r.status === "SUCCESS"
                              ? "bg-[#e9f9f0] text-[#14894f] border-[#bfe8d1]"
                              : "bg-[#fff0f0] text-[#d02925] border-[#f5c2c0]"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === "SUCCESS" ? "bg-[#1fae6a]" : "bg-[#e5342f]"}`} />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#2b5fc7]">{r.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
            <span>
              Affichage de {filtered.length === 0 ? 0 : start + 1} à {Math.min(start + PAGE_SIZE, filtered.length)} sur {filtered.length} événements
            </span>
            <div className="flex gap-1">
              <button disabled={current === 1} onClick={() => setPage(current - 1)} className="w-7 h-7 border rounded bg-white disabled:opacity-40">‹</button>
              {pages.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 border rounded ${p === current ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-white"}`}
                >
                  {p}
                </button>
              ))}
              <button disabled={current === pageCount} onClick={() => setPage(current + 1)} className="w-7 h-7 border rounded bg-white disabled:opacity-40">›</button>
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#cdd9ee] shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><Database size={18} /></div>
              <h3 className="font-bold text-[#0b2a6b]">Données enregistrées dans audit_logs</h3>
            </div>
            <table className="w-full text-xs border">
              <thead className="bg-[#eef2f9] text-[#12306e]">
                <tr>
                  <th className="text-left px-3 py-2 w-28">Champ</th>
                  <th className="text-left px-3 py-2">Rôle / Description</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(([f, d]) => (
                  <tr key={f} className="border-t">
                    <td className="px-3 py-2 font-bold text-[#0b2a6b]">{f}</td>
                    <td className="px-3 py-2 text-[#2b5fc7]">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-[#cdd9ee] shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><ShieldCheck size={18} /></div>
              <h3 className="font-bold text-[#0b2a6b]">Avantages</h3>
            </div>
            <ul className="space-y-2.5">
              {ADVANTAGES.map((a) => (
                <li key={a} className="flex items-center gap-3 text-sm text-[#12306e]">
                  <CheckCircle2 size={20} className="text-[#1fae6a] shrink-0" /> {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bandeau bas */}
      <div className="bg-white border border-[#cdd9ee] rounded-xl px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-[#12306e]">
          <div className="w-10 h-10 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><Info size={20} /></div>
          <p>
            <b>L'audit log est un élément essentiel</b> pour garantir la sécurité, la fiabilité et la transparence des
            opérations dans <b>SAINT-JUDE</b>.
          </p>
        </div>
        <p className="hidden md:block italic text-[#1255d6] text-sm">SAINT-JUDE — Plus qu'un transport, une confiance.</p>
      </div>

      {showModalAudit && auditShow && (
        <AuditModal idAfter={auditShow.idAudit} onClose={() => setShowModalAudit(false)} type={auditShow.type} />
      )}
    </div>
  );
};

export default AuditLogs;