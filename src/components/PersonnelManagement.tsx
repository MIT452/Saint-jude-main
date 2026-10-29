import { FC, useMemo, useState } from "react";
import {
  Search, Bell, ChevronDown, Calendar, Users, User, Anchor, Settings, ShieldCheck, Plus, Check, Clock, AlertCircle,
  Filter, Download, Eye, Pencil, Trash2, ArrowRight, ChevronLeft, ChevronRight, X, UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../redux";
import { addPersonnel, updatePersonnel, deletePersonnel } from "../redux/feature/users";

interface Props {
  onAdd?: () => void;
  onView?: (user: any) => void;
  onEdit?: (user: any) => void;
  onDelete?: (user: any) => void;
}

interface FormData {
  name: string;
  lastName: string;
  email: string;
  tel: string;
  role: string;
}

const ROLE_OPTIONS = ["Capitaine", "Gestionnaire", "Agent"];
const EMPTY_FORM: FormData = { name: "", lastName: "", email: "", tel: "", role: "Agent" };

const PAGE = 5;
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const pick = (u: any, ...keys: string[]) => { for (const k of keys) if (u?.[k] !== undefined && u[k] !== null && u[k] !== "") return u[k]; return undefined; };

type Kind = "admin" | "capitaine" | "gestionnaire" | "agent" | "autre";
const kindOf = (role: string): Kind =>
  /propri|admin/i.test(role) ? "admin" : /capitaine/i.test(role) ? "capitaine" : /gestion/i.test(role) ? "gestionnaire" : /agent/i.test(role) ? "agent" : "autre";
const roleBadge: Record<Kind, string> = {
  admin: "bg-[#dbe8ff] text-[#1d4fb8]", capitaine: "bg-[#d9f5e6] text-[#14894f]", gestionnaire: "bg-[#ffe9cc] text-[#d97706]",
  agent: "bg-[#ece3ff] text-[#6a43d6]", autre: "bg-[#d6f3f6] text-[#0e8a98]",
};
type St = "present" | "conge" | "absent" | null;
const stOf = (s: any): St => {
  if (!s) return null;
  const v = String(s);
  if (/cong/i.test(v)) return "conge";
  if (/abs|inactif|inactive|suspend/i.test(v)) return "absent";
  if (/actif|active|pr[ée]sent/i.test(v)) return "present";
  return null;
};
const stBadge: Record<string, string> = { present: "bg-[#d9f5e6] text-[#14894f]", conge: "bg-[#ffe9cc] text-[#d97706]", absent: "bg-[#ffe3e3] text-[#d02925]" };
const stLabel: Record<string, string> = { present: "Actif", conge: "Congé", absent: "Absent" };

const PersonnelManagement: FC<Props> = ({ onAdd, onView, onEdit, onDelete }) => {
  const dispatch = useDispatch<AppDispatch>();
  const allUser = useSelector((state: RootState) => state.users.allUser) as any[];
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  const [search, setSearch] = useState("");
  const [roleF, setRoleF] = useState("");
  const [statF, setStatF] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ search: "", role: "", stat: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const handleAdd = () => {
    if (onAdd) return onAdd();
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const handleEdit = (raw: any) => {
    if (onEdit) return onEdit(raw);
    setEditId(String(raw.id ?? raw._id));
    setForm({
      name: raw.name ?? "",
      lastName: raw.lastName ?? "",
      email: raw.email ?? "",
      tel: raw.tel ?? raw.phone ?? "",
      role: raw.role ?? "Agent",
    });
    setFormError("");
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Prénom et email sont obligatoires.");
      return;
    }
    const exists = (allUser ?? []).some(
      (u) => u.email?.toLowerCase() === form.email.trim().toLowerCase() && String(u.id ?? u._id) !== editId
    );
    if (exists) {
      setFormError("Cet email existe déjà.");
      return;
    }
    const data = { ...form, name: form.name.trim(), lastName: form.lastName.trim(), email: form.email.trim() };
    if (editId) {
      const old = (allUser ?? []).find((u) => String(u.id ?? u._id) === editId);
      await dispatch(updatePersonnel({ ...old, ...data } as any));
    } else {
      await dispatch(addPersonnel(data as any));
    }
    setShowForm(false);
  };

  // ---------- Normalisation des vrais utilisateurs
  const people = useMemo(
    () =>
      (allUser ?? []).map((u) => {
        const role = String(pick(u, "role") ?? "—");
        const hireRaw = pick(u, "hireDate", "dateEmbauche", "hiredAt", "createdAt");
        const hire = hireRaw ? new Date(hireRaw) : null;
        return {
          raw: u,
          id: String(pick(u, "_id", "id") ?? `${u.name}-${u.lastName}`),
          name: `${u.name ?? ""} ${u.lastName ?? ""}`.trim() || "—",
          email: pick(u, "email", "mail") ?? "—",
          phone: pick(u, "phone", "telephone", "tel", "phoneNumber", "contact") ?? "—",
          photo: pick(u, "photo", "image", "avatar", "picture") as string | undefined,
          role, kind: kindOf(role), status: stOf(pick(u, "status", "statut", "state")),
          hire: hire && !isNaN(hire.getTime()) ? hire : null,
        };
      }),
    [allUser]
  );

  const total = people.length;
  const count = (k: Kind) => people.filter((p) => p.kind === k).length;
  const cap = count("capitaine"), gest = count("gestionnaire"), agent = count("agent");
  const others = total - cap - gest - agent;
  const hasDates = people.some((p) => p.hire);
  const weekly = (list: typeof people) => list.filter((p) => p.hire && Date.now() - p.hire.getTime() < 7 * DAY).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const sub = (list: typeof people) => {
    if (!hasDates) return null;
    const n = weekly(list);
    return n > 0 ? { text: `+ ${n} cette semaine`, up: true } : { text: "Stable", up: false };
  };

  const cards: { label: string; value: number; Icon: LucideIcon; tint: string; icon: string; s: ReturnType<typeof sub> }[] = [
    { label: "Total", value: total, Icon: Users, tint: "from-[#eaf5ff] to-white border-[#bfe0fb]", icon: "bg-[#2aa3f0]", s: sub(people) },
    { label: "Capitaines", value: cap, Icon: Anchor, tint: "from-[#eafaf1] to-white border-[#bfe8d1]", icon: "bg-[#12a66a]", s: sub(people.filter((p) => p.kind === "capitaine")) },
    { label: "Gestionnaires", value: gest, Icon: Settings, tint: "from-[#fff4e8] to-white border-[#fad7aa]", icon: "bg-[#f59e0b]", s: sub(people.filter((p) => p.kind === "gestionnaire")) },
    { label: "Agents", value: agent, Icon: User, tint: "from-[#f5eeff] to-white border-[#d9c6f7]", icon: "bg-[#8b3fd9]", s: sub(people.filter((p) => p.kind === "agent")) },
    { label: "Autres rôles", value: others, Icon: ShieldCheck, tint: "from-[#e8f8f9] to-white border-[#b7e4e8]", icon: "bg-[#12a5b3]", s: sub(people.filter((p) => ["admin", "autre"].includes(p.kind))) },
  ];

  const pie = [
    { name: "Capitaines", value: cap, color: "#0b84f3" },
    { name: "Gestionnaires", value: gest, color: "#22b573" },
    { name: "Agents", value: agent, color: "#f59e0b" },
    { name: "Autres rôles", value: others, color: "#8b3fd9" },
  ];

  // Évolution des effectifs : cumul par mois (5 derniers mois) d'après la date d'embauche
  const evolution = useMemo(() => {
    if (!hasDates) return [];
    return Array.from({ length: 5 }, (_, i) => {
      const end = new Date();
      end.setMonth(end.getMonth() - (4 - i) + 1, 0);
      end.setHours(23, 59, 59, 999);
      const upTo = people.filter((p) => p.hire && p.hire.getTime() <= end.getTime());
      return {
        m: end.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
        total: upTo.length,
        capitaines: upTo.filter((p) => p.kind === "capitaine").length,
        agents: upTo.filter((p) => p.kind === "agent").length,
      };
    });
  }, [people, hasDates]);

  const statusKnown = people.some((p) => p.status);
  const present = people.filter((p) => p.status === "present").length;
  const conge = people.filter((p) => p.status === "conge").length;
  const absent = people.filter((p) => p.status === "absent").length;

  // ---------- Filtres + pagination
  const roles = Array.from(new Set(people.map((p) => p.role)));
  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    return people.filter((p) => {
      if (q && !`${p.name} ${p.email} ${p.phone} ${p.role}`.toLowerCase().includes(q)) return false;
      if (applied.role && p.role !== applied.role) return false;
      if (applied.stat && p.status !== applied.stat) return false;
      if (applied.from && (!p.hire || p.hire.getTime() < new Date(applied.from).getTime())) return false;
      if (applied.to && (!p.hire || p.hire.getTime() > new Date(applied.to).getTime() + DAY - 1)) return false;
      return true;
    });
  }, [people, applied]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE;
  const rows = filtered.slice(start, start + PAGE);
  const pages = Array.from({ length: Math.min(3, pageCount) }, (_, i) => Math.max(1, Math.min(current - 1, pageCount - 2)) + i);
  const onFilter = () => { setApplied({ search, role: roleF, stat: statF, from, to }); setPage(1); };

  const exportCsv = () => {
    const head = ["Nom", "Email", "Téléphone", "Rôle", "Statut", "Date d'embauche"];
    const body = filtered.map((p) => [p.name, p.email, p.phone, p.role, p.status ? stLabel[p.status] : "", p.hire ? fmt(p.hire) : ""]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "personnels.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const allChecked = rows.length > 0 && rows.every((p) => selected.includes(p.id));
  const toggleAll = () => setSelected(allChecked ? selected.filter((id) => !rows.some((p) => p.id === id)) : Array.from(new Set([...selected, ...rows.map((p) => p.id)])));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const remove = (p: (typeof people)[number]) => {
    if (!window.confirm(`Supprimer ${p.name} ?`)) return;
    if (onDelete) onDelete(p.raw);
    else dispatch(deletePersonnel(String(p.raw.id ?? p.raw._id)));
  };

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="bg-[#f3f7fd] min-h-full text-[#10285e]">
      {/* Barre du haut */}
      <div className="bg-white border-b border-[#e3eaf6] px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[260px] max-w-[440px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1255d6]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onFilter()}
            placeholder="Rechercher un utilisateur, un rôle, une action..." className="w-full bg-[#eef3fb] rounded-lg pl-9 pr-3 py-2.5 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-5">
          <div className="relative"><Bell size={22} className="text-[#1255d6]" /></div>
          <div className="flex items-center gap-2 border border-[#e3eaf6] rounded-lg pl-1.5 pr-3 py-1">
            <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><UserCircle2 size={20} /></div>
            <span className="text-sm font-semibold">{currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.name ?? "Administrateur"}</span>
            <ChevronDown size={14} />
          </div>
          <div className="flex items-center gap-2 border border-[#e3eaf6] rounded-lg px-3 py-1.5 text-xs">
            <Calendar size={22} className="text-[#1255d6]" />
            <div><p className="capitalize">{dateLabel}</p><p>{pad(now.getHours())}:{pad(now.getMinutes())}</p></div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Titre */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#1255d6] text-white flex items-center justify-center shrink-0">
            <Users size={32} />
          </div>
          <div className="mr-auto min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-[#0b3aa8]">Gestion des personnels</h1>
            <p className="text-sm text-[#3e5788]">Gérez tous les personnels, leurs rôles et accès à la plateforme</p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex w-auto shrink-0 items-center justify-center gap-2 whitespace-nowrap bg-[#1255d6] hover:bg-[#0e45b3] text-white text-sm font-semibold px-5 py-3 rounded-lg shadow"
          >
            <Plus size={18} /> Ajouter un personnel
          </button>
        </div>

        {/* Cartes */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-xl border bg-gradient-to-br ${c.tint} p-4 flex gap-4 items-center`}>
              <div className={`w-14 h-14 rounded-full ${c.icon} text-white flex items-center justify-center shrink-0`}><c.Icon size={26} /></div>
              <div>
                <p className="text-sm">{c.label}</p>
                <p className="text-4xl font-extrabold leading-tight">{c.value}</p>
                {c.s && <p className={`text-[11px] flex items-center gap-1 ${c.s.up ? "text-green-600" : "text-gray-500"}`}>{c.s.up ? "↗" : "—"} {c.s.text}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.1fr_0.95fr] gap-3">
          <div className="bg-white rounded-xl border border-[#dbe5f5] p-5 shadow-sm">
            <h3 className="font-bold flex items-center gap-2 mb-3"><Users size={18} className="text-[#1255d6]" /> Répartition des rôles</h3>
            {total === 0 ? <p className="text-xs text-gray-500 py-16 text-center">Aucun personnel.</p> : (
              <div className="flex items-center gap-4">
                <div className="relative w-[190px] h-[190px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={pie} dataKey="value" innerRadius={52} outerRadius={92} stroke="#fff">{pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie></PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-extrabold">{total}</span><span className="text-xs">personnels</span>
                  </div>
                </div>
                <ul className="text-sm space-y-3 flex-1">
                  {pie.map((p) => (
                    <li key={p.name} className="flex items-center gap-2">
                      <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                      <span className="flex-1 text-[#0b3aa8]">{p.name}</span>
                      <span className="text-gray-600">{p.value} ({pct(p.value)}%)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#dbe5f5] p-5 shadow-sm">
            <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-[#1255d6]" /> Évolution des effectifs</h3>
            <div className="flex justify-center gap-4 text-[11px] my-2">
              <span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-[#1d8bf0] inline-block" />Total</span>
              <span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-[#22b573] inline-block" />Capitaines</span>
              <span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-[#f59e0b] inline-block" />Agents</span>
            </div>
            {evolution.length === 0 ? <p className="text-xs text-gray-500 py-14 text-center">Dates d'embauche non renseignées.</p> : (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RTooltip />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#1d8bf0" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="capitaines" name="Capitaines" stroke="#22b573" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="agents" name="Agents" stroke="#f59e0b" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#dbe5f5] p-5 shadow-sm">
            <h3 className="font-bold flex items-center gap-2 mb-2"><Calendar size={18} className="text-[#1255d6]" /> Activité de l'équipe</h3>
            {!statusKnown ? <p className="text-xs text-gray-500 py-14 text-center">Statuts non renseignés.</p> : (
              <ul className="divide-y">
                {[
                  { l: "Présents aujourd'hui", n: present, Icon: Check, c: "bg-[#22b573]" },
                  { l: "En congé", n: conge, Icon: Clock, c: "bg-[#f59e0b]" },
                  { l: "Absents", n: absent, Icon: AlertCircle, c: "bg-[#e5342f]" },
                ].map((a) => (
                  <li key={a.l} className="flex items-center gap-3 py-4">
                    <span className={`w-10 h-10 rounded-full ${a.c} text-white flex items-center justify-center`}><a.Icon size={20} /></span>
                    <span className="flex-1 text-sm text-[#0b3aa8]">{a.l}</span>
                    <b className="w-8 text-center">{a.n}</b>
                    <span className="w-10 text-right text-sm text-gray-600">{pct(a.n)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-[#dbe5f5] p-3 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1255d6]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onFilter()} placeholder="Rechercher un personnel..." className="w-full border rounded-lg pl-9 pr-3 py-2.5 text-xs bg-[#f8fafd]" />
          </div>
          <select value={roleF} onChange={(e) => setRoleF(e.target.value)} className="border rounded-lg px-3 py-2.5 text-xs bg-[#f8fafd] min-w-[170px]">
            <option value="">Tous les rôles</option>{roles.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={statF} onChange={(e) => setStatF(e.target.value)} className="border rounded-lg px-3 py-2.5 text-xs bg-[#f8fafd] min-w-[170px]">
            <option value="">Tous les statuts</option><option value="present">Actif</option><option value="conge">Congé</option><option value="absent">Absent</option>
          </select>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 text-xs bg-[#f8fafd]">
            <Calendar size={15} className="text-[#1255d6]" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" />
            <ArrowRight size={13} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" />
          </div>
          <button type="button" onClick={onFilter} className="inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap bg-[#1255d6] hover:bg-[#0e45b3] text-white text-sm font-semibold px-6 py-2.5 rounded-lg"><Filter size={15} /> Filtrer</button>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-[#dbe5f5] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-[#1255d6]" /> Liste des personnels ({filtered.length})</h3>
            <button type="button" onClick={exportCsv} className="inline-flex w-auto items-center gap-2 whitespace-nowrap border border-[#cfdcf3] text-[#1255d6] text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-50"><Download size={14} /> Exporter</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#f1f5fb] text-[#12306e]">
                <tr>
                  <th className="px-3 py-3 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                  {["Nom", "Email", "Téléphone", "Rôle", "Statut", "Date d'embauche", "Actions"].map((h) => <th key={h} className="text-left font-semibold px-3 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-500">Aucun personnel trouvé.</td></tr>}
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-blue-50/40">
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} /></td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-3">
                        {p.photo ? <img src={p.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                          : <span className="w-9 h-9 rounded-full bg-[#dbe8ff] text-[#1d4fb8] font-bold text-[11px] flex items-center justify-center">{initials(p.name)}</span>}
                        {p.name}
                      </span>
                    </td>
                    <td className="px-3 py-3">{p.email}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{p.phone}</td>
                    <td className="px-3 py-3"><span className={`px-3 py-1 rounded-md font-semibold ${roleBadge[p.kind]}`}>{p.role}</span></td>
                    <td className="px-3 py-3">{p.status ? <span className={`px-3 py-1 rounded-md font-semibold ${stBadge[p.status]}`}>{stLabel[p.status]}</span> : "—"}</td>
                    <td className="px-3 py-3">{p.hire ? fmt(p.hire) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <button type="button" onClick={() => (onView ? onView(p.raw) : setDetail(p))} className="w-8 h-8 rounded-md bg-[#e3eeff] text-[#1255d6] flex items-center justify-center" title="Voir"><Eye size={15} /></button>
                        <button type="button" onClick={() => handleEdit(p.raw)} className="w-8 h-8 rounded-md bg-[#e3eeff] text-[#1255d6] flex items-center justify-center" title="Modifier"><Pencil size={15} /></button>
                        <button type="button" onClick={() => remove(p)} className="w-8 h-8 rounded-md bg-[#ffe3e3] text-[#e5342f] flex items-center justify-center" title="Supprimer"><Trash2 size={15} /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
            <span>Affichage de {filtered.length === 0 ? 0 : start + 1} à {Math.min(start + PAGE, filtered.length)} sur {filtered.length} personnels</span>
            <div className="flex gap-1.5">
              <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="w-9 h-9 border rounded-md bg-white flex items-center justify-center disabled:opacity-40"><ChevronLeft size={15} /></button>
              {pages.map((p) => <button type="button" key={p} onClick={() => setPage(p)} className={`w-9 h-9 border rounded-md ${p === current ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-white"}`}>{p}</button>)}
              <button type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)} className="w-9 h-9 border rounded-md bg-white flex items-center justify-center disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editId ? "Modifier le personnel" : "Ajouter un personnel"}</h3>
              <button type="button" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input placeholder="Prénom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded-lg px-3 py-2.5" />
              <input placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="border rounded-lg px-3 py-2.5" />
              <input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border rounded-lg px-3 py-2.5 col-span-2" />
              <input placeholder="Téléphone" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} className="border rounded-lg px-3 py-2.5" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border rounded-lg px-3 py-2.5">
                {Array.from(new Set([...ROLE_OPTIONS, form.role])).map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {!editId && <p className="text-[11px] text-gray-500 mt-3">Mot de passe par défaut : 0000</p>}
            {formError && <p className="text-xs text-red-600 mt-2">{formError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="border rounded-lg px-4 py-2 text-xs font-semibold">Annuler</button>
              <button type="button" onClick={submitForm} className="bg-[#1255d6] hover:bg-[#0e45b3] text-white rounded-lg px-5 py-2 text-xs font-semibold">
                {editId ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-bold">{detail.name}</h3><button type="button" onClick={() => setDetail(null)}><X size={18} /></button></div>
            <dl className="text-sm space-y-2">
              {[["Email", detail.email], ["Téléphone", detail.phone], ["Rôle", detail.role], ["Statut", detail.status ? stLabel[detail.status] : "—"], ["Date d'embauche", detail.hire ? fmt(detail.hire) : "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1"><dt className="text-gray-500">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelManagement;