import { FC, useEffect, useState } from "react";
import { Brain, Mail, MessageCircle, Save, Sparkles, X } from "lucide-react";
import { askAIJson } from "../data/auditAI";
import {
  DEFAULT_SETTINGS, EVENT_LABELS, EVENT_TYPES, PLACEHOLDERS, fetchNotificationSettings,
  hasUnknownVars, saveNotificationSettings,
  type EventType, type NotificationSettings,
} from "../data/notificationSettings";

const TONES = ["professionnel et chaleureux", "formel", "simple et direct"];
const SAMPLE: Record<string, string> = {
  client: "Jean Dupont", trajet: "Toamasina → Mahajanga", date: "12/11/2026 08:00",
  passagers: "2", total: "150 000 Ar", reference: "SJ-001", motif: "solde à régler",
};
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => SAMPLE[k] ?? `{${k}}`);

const NotificationSettingsPanel: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [s, setS] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [active, setActive] = useState<EventType>("reservation.confirmed");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let off = false;
    fetchNotificationSettings()
      .then((r) => { if (!off) setS(r); })
      .catch((e: Error) => { if (!off) setMsg({ ok: false, text: e.message }); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, []);

  const set = <K extends keyof NotificationSettings>(k: K, v: NotificationSettings[K]) => setS((c) => ({ ...c, [k]: v }));

  const setTemplate = (field: "subject" | "body", value: string) =>
    setS((c) => ({
      ...c,
      templates: { ...c.templates, [active]: { subject: c.templates[active]?.subject ?? "", body: c.templates[active]?.body ?? "", [field]: value } },
    }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await saveNotificationSettings(s);
      setS(r);
      setMsg({ ok: true, text: "Configuration enregistrée dans la base de données." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Enregistrement impossible." });
    }
    setSaving(false);
  };

  const generate = async () => {
    setGenBusy(true);
    setMsg(null);
    const evs = EVENT_TYPES.filter((e) => s.events[e]);
    const prompt = `Tu rédiges les messages automatiques de SAINT-JUDE (transport maritime, Madagascar). Ton : ${s.aiTone}. Langue : français.
Pour chaque événement de cette liste : ${JSON.stringify(evs.map((e) => ({ event: e, description: EVENT_LABELS[e] })))}, écris {"subject":"objet court","body":"message de 4 à 7 lignes, utilisable par e-mail et WhatsApp"}.
Tu peux utiliser UNIQUEMENT ces variables entre accolades : ${PLACEHOLDERS.map((p) => `{${p}}`).join(" ")}.
N'écris aucune donnée réelle (nom, prix, numéro, date) : uniquement les variables. Dans les messages "en attente" et "refusé", ne confirme jamais la réservation.
Réponds UNIQUEMENT en JSON : {"templates":{"<event>":{"subject":"","body":""}}}`;
    try {
      const r = await askAIJson<{ templates: Record<string, { subject?: string; body?: string }> }>(prompt);
      if (!r || typeof r.templates !== "object") throw new Error("Réponse IA invalide.");
      const next = { ...s.templates };
      let n = 0;
      evs.forEach((e) => {
        const t = r.templates[e];
        if (!t || typeof t.subject !== "string" || typeof t.body !== "string") return;
        if (hasUnknownVars(t.subject) || hasUnknownVars(t.body)) return; // l'IA a inventé une variable : on ignore
        next[e] = { subject: t.subject.slice(0, 150), body: t.body.slice(0, 1500) };
        n += 1;
      });
      set("templates", next);
      setMsg(n ? { ok: true, text: `${n} message(s) proposé(s) par l'IA. Relisez-les, puis enregistrez.` } : { ok: false, text: "L'IA n'a rien proposé d'exploitable. Réessayez." });
    } catch {
      setMsg({ ok: false, text: "Le service IA n'a pas pu répondre. Vous pouvez écrire les messages à la main." });
    }
    setGenBusy(false);
  };

  const tpl = s.templates[active];
  const field = "w-full border border-[#dbe5f5] rounded-lg px-3 py-2 text-xs bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 text-xs space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-[#10285e]">Configuration des notifications</h3>
            <p className="text-gray-500">Coordonnées de l'administrateur et messages automatiques (e-mail et WhatsApp).</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={18} /></button>
        </div>

        {loading ? (
          <p className="text-gray-500 py-8 text-center">Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 font-semibold"><Mail size={14} className="text-[#1255d6]" /> E-mail administrateur</label>
                <input className={field} type="email" placeholder="admin@exemple.com" value={s.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
                <label className="flex items-center gap-2"><input type="checkbox" checked={s.emailEnabled} onChange={(e) => set("emailEnabled", e.target.checked)} /> Recevoir par e-mail</label>
              </div>
              <div className="border rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 font-semibold"><MessageCircle size={14} className="text-[#0f9d78]" /> WhatsApp administrateur</label>
                <input className={field} type="tel" placeholder="+261 34 00 000 00" value={s.adminWhatsapp} onChange={(e) => set("adminWhatsapp", e.target.value)} />
                <label className="flex items-center gap-2"><input type="checkbox" checked={s.whatsappEnabled} onChange={(e) => set("whatsappEnabled", e.target.checked)} /> Recevoir par WhatsApp</label>
              </div>
            </div>

            <div className="border rounded-xl p-3">
              <p className="font-semibold mb-2">Événements notifiés</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {EVENT_TYPES.map((e) => (
                  <label key={e} className="flex items-center gap-2">
                    <input type="checkbox" checked={s.events[e]} onChange={(ev) => set("events", { ...s.events, [e]: ev.target.checked })} />
                    {EVENT_LABELS[e]}
                  </label>
                ))}
              </div>
            </div>

            <div className="border rounded-xl p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold flex items-center gap-1.5 flex-1"><Brain size={14} className="text-[#7c3aed]" /> Messages rédigés par l'IA</p>
                <select className="border rounded-md px-2 py-1 bg-[#f8fafd]" value={s.aiTone} onChange={(e) => set("aiTone", e.target.value)}>
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" onClick={generate} disabled={genBusy} className="flex items-center gap-1.5 bg-[#7c3aed] text-white font-semibold rounded-md px-3 py-1.5 disabled:opacity-50">
                  <Sparkles size={12} /> {genBusy ? "Rédaction…" : "Proposer avec l'IA"}
                </button>
              </div>
              <p className="text-gray-500">
                L'IA ne voit aucune donnée client : elle n'écrit que le modèle. Le serveur remplace les variables {PLACEHOLDERS.map((p) => `{${p}}`).join(" ")} au moment de l'envoi.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((e) => (
                  <button key={e} type="button" onClick={() => setActive(e)} className={`px-2.5 py-1 rounded-md border ${active === e ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-[#f8fafd] border-[#dbe5f5]"}`}>
                    {EVENT_LABELS[e].split(" (")[0]}
                  </button>
                ))}
              </div>
              <input className={field} placeholder="Objet du message" value={tpl?.subject ?? ""} onChange={(e) => setTemplate("subject", e.target.value)} />
              <textarea className={`${field} min-h-[110px]`} placeholder="Texte du message (variables autorisées entre accolades)" value={tpl?.body ?? ""} onChange={(e) => setTemplate("body", e.target.value)} />
              {(tpl?.subject || tpl?.body) && (
                <div className="rounded-lg bg-[#eef4ff] p-3">
                  <p className="font-semibold text-[#1255d6] mb-1">Aperçu (exemple fictif)</p>
                  <p className="font-semibold">{fill(tpl?.subject ?? "")}</p>
                  <p className="whitespace-pre-line text-gray-700">{fill(tpl?.body ?? "")}</p>
                </div>
              )}
              <p className="text-gray-500">Sans modèle enregistré pour un événement, le serveur utilise son message par défaut.</p>
            </div>

            {msg && (
              <p className={`rounded-lg p-3 ${msg.ok ? "bg-[#eefaf5] text-[#0f9d78]" : "bg-[#ffe3e3] text-[#e5342f]"}`}>{msg.text}</p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#dbe5f5]">Fermer</button>
              <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1255d6] text-white font-semibold disabled:opacity-50">
                <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationSettingsPanel;