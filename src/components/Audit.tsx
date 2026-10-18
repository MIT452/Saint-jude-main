import { FC, useEffect, useMemo, useState } from "react";
import { Ship, Wrench, ShieldAlert, CheckCircle2, AlertTriangle, BarChart3, ShieldCheck, Send, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { onGetService } from "../data/service";
import { AuditLog } from "../data/type";
import { findUser } from "../Tools/Tools";
import { askAI, askAIJson } from "../data/auditAI";
import AuditModal from "./AuditModal";

type types = "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";
type Level = "Faible" | "Moyen" | "Élevé";
type Row = {
  h: string; u: string; a: string; r: string; ok: boolean; ip: string; risk: Level;
  date: Date; entity: string; del: boolean; docId?: string;
};
type Anomaly = { t: string; s: string; h: string; lvl: Level };
type Msg = { from: "user" | "ai"; text: string; local?: boolean };

const PAGE = 8;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ACTION: Record<string, string> = { create: "Création", update: "Mise à jour", delete: "Suppression" };
const SUGGESTIONS = ["Montre-moi les échecs récents.", "Y a-t-il des suppressions suspectes ?", "Résume l'activité du jour."];

const badge: Record<Level, string> = {
  Faible: "bg-[#e3f7ec] text-[#14894f] border-[#bfe8d1]",
  Moyen: "bg-[#ffe9e3] text-[#e0592a] border-[#f7c9b8]",
  Élevé: "bg-[#ffe3e6] text-[#d02925] border-[#f5c2c0]",
};
const kind: Record<Level, { c: string; text: string; Icon: LucideIcon }> = {
  Faible: { c: "bg-[#e3f7ec] text-[#14894f] border-[#bfe8d1]", text: "#14894f", Icon: BarChart3 },
  Moyen: { c: "bg-[#fff0d9] text-[#f59e0b] border-[#f9d9a0]", text: "#d97706", Icon: AlertTriangle },
  Élevé: { c: "bg-[#ffe3e6] text-[#e5342f] border-[#f5c2c0]", text: "#d02925", Icon: ShieldAlert },
};

const ago = (d: Date) => {
  const m = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `Il y a ${h} heure${h > 1 ? "s" : ""}` : `Il y a ${Math.round(h / 24)} j`;
};

const toLevel = (v: any): Level => (v === "Élevé" || v === "Moyen" || v === "Faible" ? v : "Moyen");

// ---------- Analyse locale (repli si l'IA est indisponible) : calculée sur les vrais logs
const localAnomalies = (rows: Row[]): Anomaly[] => {
  const out: Anomaly[] = [];
  const failed = rows.filter((r) => !r.ok);
  if (failed.length)
    out.push({ t: "Échecs d'opération détectés", s: `${failed.length} échec(s) — dernier par ${failed[0].u} (IP : ${failed[0].ip})`, h: ago(failed[0].date), lvl: "Élevé" });
  const dels = rows.filter((r) => r.del);
  const byUser = new Map<string, Date[]>();
  dels.forEach((r) => byUser.set(r.u, [...(byUser.get(r.u) ?? []), r.date]));
  let burstUser = "";
  byUser.forEach((ds, u) => {
    const s = ds.map((d) => d.getTime()).sort((a, b) => a - b);
    for (let i = 2; i < s.length; i++) if (s[i] - s[i - 2] <= 600000) burstUser = u;
  });
  if (burstUser) out.push({ t: "Suppressions en rafale", s: `${burstUser} a supprimé 3 éléments ou plus en moins de 10 minutes`, h: ago(dels[0].date), lvl: "Élevé" });
  else if (dels.length) out.push({ t: "Suppressions à vérifier", s: `${dels.length} suppression(s) — dernière par ${dels[0].u} sur ${dels[0].entity.toLowerCase()}`, h: ago(dels[0].date), lvl: "Moyen" });
  const night = rows.filter((r) => Date.now() - r.date.getTime() < 86400000 && r.date.getHours() < 6);
  if (night.length) out.push({ t: "Activité nocturne", s: `${night.length} action(s) entre 00h et 06h sur les dernières 24h`, h: ago(night[0].date), lvl: "Moyen" });
  return out.slice(0, 3);
};

const buildContext = (rows: Row[]) => {
  const failed = rows.filter((r) => !r.ok).length;
  const dels = rows.filter((r) => r.del).length;
  const lines = rows.slice(0, 40).map((r) => `${r.date.toISOString().slice(0, 16)} | ${r.u} | ${r.a} | ${r.entity} | ${r.ok ? "Succès" : "Échec"} | IP ${r.ip}`);
  return `Journaux d'audit SAINT-JUDE (transport maritime). Total: ${rows.length}, échecs: ${failed}, suppressions: ${dels}.\nDerniers événements (date | utilisateur | action | ressource | résultat | IP):\n${lines.join("\n")}`;
};

const localAnswer = (q: string, rows: Row[]): string => {
  const low = q.toLowerCase();
  if (!rows.length) return "Aucun événement enregistré pour le moment.";
  const fmt = (list: Row[]) => list.slice(0, 5).map((r) => `${r.date.toLocaleDateString("fr-FR")} ${r.h} – ${r.u} (${r.a} ${r.entity.toLowerCase()}, IP ${r.ip})`).join("\n");
  if (/(échec|echec|failed|erreur)/.test(low)) {
    const l = rows.filter((r) => !r.ok);
    return l.length ? `${l.length} échec(s) enregistré(s). Les plus récents :\n${fmt(l)}` : "Aucun échec enregistré.";
  }
  if (/suppress|delete/.test(low)) {
    const l = rows.filter((r) => r.del);
    return l.length ? `${l.length} suppression(s). Les plus récentes :\n${fmt(l)}` : "Aucune suppression enregistrée.";
  }
  const day = rows.filter((r) => Date.now() - r.date.getTime() < 86400000);
  return `${day.length} événement(s) sur les dernières 24h, ${rows.filter((r) => !r.ok).length} échec(s) et ${rows.filter((r) => r.del).length} suppression(s) au total.`;
};

const Audit: FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ id: string; type: types } | null>(null);
  const [aiAnom, setAiAnom] = useState<Anomaly[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
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

  const rows = useMemo<Row[]>(
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
            risk: (failed || del ? "Moyen" : "Faible") as Level,
            docId: (log as any).after?.id,
          };
        }),
    [logs, allUser]
  );

  const kpi = useMemo(() => {
    if (!rows.length) return { events: "0", threats: "0", conf: "—" };
    const day = rows.filter((r) => Date.now() - r.date.getTime() < 86400000).length;
    const threats = rows.filter((r) => !r.ok || r.del).length;
    const conf = (((rows.length - rows.filter((r) => !r.ok).length) / rows.length) * 100).toFixed(1).replace(".", ",");
    return { events: day.toLocaleString("fr-FR"), threats: String(threats), conf: `${conf}%` };
  }, [rows]);

  // ---------- Détection d'anomalies par l'IA (repli : règles locales)
  const signature = rows.length ? `${rows.length}-${rows[0].date.getTime()}` : "";
  useEffect(() => {
    if (!rows.length) return;
    let off = false;
    setAiBusy(true);
    const prompt = `${buildContext(rows)}\n\nTu es l'IA d'audit de sécurité. Détecte au plus 3 anomalies ou comportements suspects dans ces journaux (n'invente rien qui n'y figure pas). Réponds UNIQUEMENT par un tableau JSON: [{"title":"","detail":"","level":"Faible|Moyen|Élevé"}]. Tableau vide [] s'il n'y a rien de suspect.`;
    askAIJson<{ title: string; detail: string; level: string }[]>(prompt).then((res) => {
      if (off) return;
      setAiAnom(Array.isArray(res) ? res.slice(0, 3).map((x) => ({ t: x.title, s: x.detail, h: "Analyse IA", lvl: toLevel(x.level) })) : null);
      setAiBusy(false);
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const anomalies = aiAnom ?? localAnomalies(rows);
  const fromAI = aiAnom !== null;

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE, current * PAGE);
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => Math.max(1, Math.min(current - 2, pageCount - 4)) + i);

  const ask = async (text?: string) => {
    const q = (text ?? question).trim();
    if (!q || chatBusy) return;
    setQuestion("");
    setMessages((m) => [...m, { from: "user", text: q }]);
    setChatBusy(true);
    const reply = await askAI(`${buildContext(rows)}\n\nQuestion de l'administrateur: ${q}\nRéponds en français, de façon concise, uniquement à partir des journaux ci-dessus.`);
    setMessages((m) => [...m, reply ? { from: "ai", text: reply } : { from: "ai", text: localAnswer(q, rows), local: true }]);
    setChatBusy(false);
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
          {stat(ShieldAlert, "Menaces détectées", kpi.threats, "(à vérifier)", "text-[#4aa3ff]")}
          {stat(CheckCircle2, "Taux de conformité", kpi.conf, "", "text-[#4ade80]")}
        </div>

        {/* Corps */}
        <div className="bg-[#eef4fd] p-3 grid grid-cols-1 xl:grid-cols-[1.45fr_1fr_0.95fr] gap-3 text-[#10285e]">
          {/* Activité récente */}
          <div className="bg-white rounded-lg border border-[#d4e0f3] p-3">
            <h4 className="font-bold text-sm mb-2">Activité récente (analyse IA)</h4>
            <div className="overflow-x-auto border border-[#d4e0f3] rounded-md">
              <table className="w-full text-[10px]">
                <thead className="bg-[#e6eefb] text-[#12306e]">
                  <tr>{["Heure", "Utilisateur", "Action", "Ressource", "Résultat", "IP", "Risque"].map((h) => <th key={h} className="text-left font-semibold px-2 py-1.5">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-gray-500">Aucun événement enregistré.</td></tr>}
                  {pageRows.map((r, i) => (
                    <tr key={i} className={`${i % 2 ? "bg-[#f4f8fe]" : "bg-white"} ${r.docId ? "cursor-pointer hover:bg-blue-50" : ""}`}
                      onClick={() => r.docId && setModal({ id: r.docId, type: r.entity as types })}>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.h}</td>
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
                <button disabled={current === 1} onClick={() => setPage(current - 1)} className="w-5 h-5 rounded border bg-white disabled:opacity-40">‹</button>
                {pages.map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`w-5 h-5 rounded border text-[10px] ${p === current ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-white"}`}>{p}</button>
                ))}
                <button disabled={current === pageCount} onClick={() => setPage(current + 1)} className="w-5 h-5 rounded border bg-white disabled:opacity-40">›</button>
              </div>
              <span>Total : {rows.length} événements</span>
            </div>
          </div>

          {/* Anomalies */}
          <div className="bg-white rounded-lg border border-[#d4e0f3] p-3">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-sm flex items-center gap-2"><ShieldCheck size={16} className="text-[#1255d6]" /> Détection des anomalies (IA)</h4>
              <span className="text-[10px] text-gray-500">{aiBusy ? "Analyse en cours…" : fromAI ? "Analyse IA" : "Analyse locale"}</span>
            </div>
            <ul className="space-y-3">
              {anomalies.length === 0 && <li className="text-xs text-gray-500">{rows.length ? "Aucune anomalie détectée." : "Aucun événement à analyser."}</li>}
              {anomalies.map((a, i) => {
                const k = kind[a.lvl];
                return (
                  <li key={i} className="flex items-start gap-2.5 text-[11px] border border-[#e1eaf7] rounded-lg p-2">
                    <span className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${k.c}`}><k.Icon size={16} /></span>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: k.text }}>{a.t}</p>
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
            <div className="flex-1 space-y-2 min-h-[150px] max-h-[230px] overflow-y-auto pr-1">
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-2.5 py-1 text-left">{s}</button>
                  ))}
                </div>
              )}
              {messages.map((m, i) =>
                m.from === "user" ? (
                  <div key={i} className="bg-[#3b6fe0] rounded-lg px-3 py-2 ml-6">{m.text}</div>
                ) : (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-6 h-6 rounded-full bg-[#1fae6a] flex items-center justify-center shrink-0"><Bot size={13} /></span>
                    <div className="bg-[#2a58b8] rounded-lg p-2 whitespace-pre-line">
                      {m.text}
                      {m.local && <p className="text-[9px] opacity-60 mt-1">Réponse calculée localement (IA indisponible)</p>}
                    </div>
                  </div>
                )
              )}
              {chatBusy && <p className="opacity-70">Phoenix AI analyse…</p>}
            </div>
            <div className="flex items-center bg-white/10 border border-white/20 rounded-md mt-3 pr-1">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder="Posez votre question..." className="bg-transparent flex-1 px-3 py-2 outline-none placeholder:text-white/60" />
              <button onClick={() => ask()} disabled={chatBusy} className="w-7 h-7 rounded bg-[#1d6fe0] flex items-center justify-center disabled:opacity-50"><Send size={13} /></button>
            </div>
          </div>
        </div>
      </section>
      {modal && <AuditModal idAfter={modal.id} type={modal.type} onClose={() => setModal(null)} />}
    </div>
  );
};

export default Audit;