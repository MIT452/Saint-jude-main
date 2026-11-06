import { FC, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Settings, MessageCircle, Mail, Send, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { RootState } from "../redux";

const API = (import.meta as any).env?.VITE_API_URL ?? "";

type Form = {
  whatsappNumber: string;
  emailAddress: string;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  events: string[];
};

const EVENT_LABELS: Record<string, string> = {
  "reservation.created": "Nouvelle réservation",
  "reservation.auto_approved": "Réservation acceptée automatiquement",
  "reservation.manual_review": "Demande en attente de validation",
  "payment.received": "Paiement reçu",
  "reservation.cancelled": "Réservation annulée",
  "boat.maintenance": "Bateau en maintenance",
};

const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const card = "bg-white rounded-xl border border-[#dbe5f5] shadow-sm";
const input = "w-full border border-[#dbe5f5] rounded-lg px-3 py-2 text-xs bg-white";

const call = async (path: string, init?: RequestInit) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}/api/notification-settings${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Erreur");
  return data;
};

const Toggle: FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-xs cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[#1255d6]" />
    {label}
  </label>
);

const NotificationSettingsPanel: FC = () => {
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const allowed = /propri|admin/i.test(String(currentUser?.role ?? ""));

  const [form, setForm] = useState<Form>({
    whatsappNumber: "", emailAddress: "", whatsappEnabled: false, emailEnabled: false, events: [],
  });
  const [saved, setSaved] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    call("")
      .then((d) => { setForm(d); setSaved(d); })
      .catch((e) => setMsg({ ok: false, text: e.message }))
      .finally(() => setLoading(false));
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="p-5 text-xs text-[#b45309] bg-[#fff8ea] rounded-xl border border-[#f5d79a]">
        Accès réservé au propriétaire et à l'administrateur.
      </div>
    );
  }

  const phoneBad = form.whatsappNumber !== "" && !PHONE_RE.test(form.whatsappNumber);
  const mailBad = form.emailAddress !== "" && !EMAIL_RE.test(form.emailAddress);
  const changedContact =
    saved !== null && (saved.whatsappNumber !== form.whatsappNumber || saved.emailAddress !== form.emailAddress);

  const toggleEvent = (e: string) =>
    setForm((f) => ({ ...f, events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e] }));

  const save = async () => {
    if (changedContact && !window.confirm("Vous modifiez vos coordonnées de notification. Confirmer ?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const d = await call("", { method: "PUT", body: JSON.stringify(form) });
      setForm(d);
      setSaved(d);
      setMsg({ ok: true, text: "Paramètres enregistrés." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  const test = async (channel: "whatsapp" | "email") => {
    setBusy(true);
    setMsg(null);
    try {
      await call("/test", { method: "POST", body: JSON.stringify({ channel }) });
      setMsg({ ok: true, text: "Message de test envoyé." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  return (
    <div className="p-5 bg-[#f3f7fd] min-h-full space-y-4 text-[#10285e]">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#e0ecff] text-[#1255d6] flex items-center justify-center">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Configuration</h1>
          <p className="text-xs text-[#3e5788]">Notifications administratives (WhatsApp et e-mail).</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-w-5xl">
          <div className={`${card} p-4 space-y-3`}>
            <h3 className="font-bold text-sm flex items-center gap-2"><MessageCircle size={16} className="text-[#0f9d78]" /> WhatsApp administratif</h3>
            <div>
              <label className="text-[11px] font-semibold text-[#3e5788]">Numéro WhatsApp (format international)</label>
              <input className={input} placeholder="+261340000000" value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value.trim() })} />
              {phoneBad && <p className="text-[10px] text-[#e5342f] mt-1">Format attendu : + suivi de l'indicatif et du numéro.</p>}
            </div>
            <Toggle checked={form.whatsappEnabled} onChange={(v) => setForm({ ...form, whatsappEnabled: v })} label="Activer les notifications WhatsApp" />
            <button type="button" disabled={busy || !saved?.whatsappNumber || changedContact} onClick={() => test("whatsapp")}
              className="flex items-center gap-2 text-[11px] font-semibold text-[#1255d6] disabled:opacity-50">
              <Send size={13} /> Envoyer un message de test
            </button>
          </div>

          <div className={`${card} p-4 space-y-3`}>
            <h3 className="font-bold text-sm flex items-center gap-2"><Mail size={16} className="text-[#1255d6]" /> E-mail administratif</h3>
            <div>
              <label className="text-[11px] font-semibold text-[#3e5788]">Adresse e-mail</label>
              <input className={input} type="email" placeholder="admin@exemple.com" value={form.emailAddress}
                onChange={(e) => setForm({ ...form, emailAddress: e.target.value.trim() })} />
              {mailBad && <p className="text-[10px] text-[#e5342f] mt-1">Adresse e-mail invalide.</p>}
            </div>
            <Toggle checked={form.emailEnabled} onChange={(v) => setForm({ ...form, emailEnabled: v })} label="Activer les notifications e-mail" />
            <button type="button" disabled={busy || !saved?.emailAddress || changedContact} onClick={() => test("email")}
              className="flex items-center gap-2 text-[11px] font-semibold text-[#1255d6] disabled:opacity-50">
              <Send size={13} /> Envoyer un e-mail de test
            </button>
          </div>

          <div className={`${card} p-4 space-y-2 xl:col-span-2`}>
            <h3 className="font-bold text-sm">Événements à notifier</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(EVENT_LABELS).map(([k, label]) => (
                <Toggle key={k} checked={form.events.includes(k)} onChange={() => toggleEvent(k)} label={label} />
              ))}
            </div>
            <p className="text-[10px] text-gray-500">
              Une notification envoyée n'est jamais une preuve de réservation confirmée : seul le backend valide.
            </p>
          </div>

          <div className="xl:col-span-2 flex items-center gap-3">
            <button type="button" onClick={save} disabled={busy || phoneBad || mailBad}
              className="flex items-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-xs font-semibold px-5 py-2 rounded-full disabled:opacity-50">
              <Save size={14} /> Enregistrer les paramètres
            </button>
            {msg && (
              <span className={`flex items-center gap-1 text-xs ${msg.ok ? "text-[#0f9d78]" : "text-[#e5342f]"}`}>
                {msg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettingsPanel;