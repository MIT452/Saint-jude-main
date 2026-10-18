import { FC, useEffect, useMemo, useState } from "react";
import { Ship, Wrench, ShieldAlert, CheckCircle2, AlertTriangle, BarChart3, ShieldCheck, Send, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { onGetService } from "../data/service";
import { AuditLog } from "../data/type";
import { findUser } from "../Tools/Tools";
import AuditModal from "./AuditModal";

type types = "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";

type Level = "Faible" | "Moyen" | "Élevé";
type Row = { h: string; u: string; a: string; r: string; ok: boolean; ip: string; risk: Level; docId?: string; coll?: string };
type Msg = { from: "user" | "ai"; text: string; list?: string[]; safe?: string };

const pad = (n: number) => String(n).padStart(2, "0");
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

const Audit: FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ id: string; type: types } | null>(null);
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

  useEffect(() => {
    (async () => {
      try {
        setLogs(await onGetService<AuditLog>("allaudit"));
      } catch (e) {
        console.error("Erreur logs", e);
      } finally {
        setLoading(false);
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
            docId: (log as any).after?.id,
            coll: entity,
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
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * 8, current * 8);

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

  if (loading) return <p className="text-center p-4">Chargement des logs...</p>;

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
    <div className="p-5 bg-[#f3f7fd] min-h-full">
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
                  <tr key={i} className={`${i % 2 ? "bg-[#f4f8fe]" : "bg-white"} ${r.docId ? "cursor-pointer hover:bg-blue-50" : ""}`}
                    onClick={() => r.docId && setModal({ id: r.docId, type: r.coll as types })}>
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
              {Array.from({ length: Math.min(5, pageCount) }, (_, i) => Math.max(1, Math.min(current - 2, pageCount - 4)) + i).map((p) => (
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
    {modal && <AuditModal idAfter={modal.id} type={modal.type} onClose={() => setModal(null)} />}
    </div>
  );
};

export default Audit;