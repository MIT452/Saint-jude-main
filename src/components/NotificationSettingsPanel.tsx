import { FC, ReactNode, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  Settings, MessageCircle, Mail, Send, Save, RefreshCw, CheckCircle2, AlertTriangle,
  Users, ShieldCheck, CalendarDays, Clock, Info, UserCircle2, Check, X, CreditCard, Wrench, MessageSquare,
} from "lucide-react";
import { RootState } from "../redux";

const API = ((import.meta as any).env?.VITE_API_URL ?? "").replace(/\/+$/, "");

type Form = {
  whatsappNumber: string;
  emailAddress: string;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  clientWhatsappEnabled: boolean;
  clientEmailEnabled: boolean;
  events: string[];
};
type Log = { id: number; channel: string; event: string; recipient: string | null; status: string; error: string | null; created_at: string };
type TabKey = "dest" | "events" | "models" | "history";

const EMPTY: Form = {
  whatsappNumber: "", emailAddress: "", whatsappEnabled: false, emailEnabled: false,
  clientWhatsappEnabled: true, clientEmailEnabled: true, events: [],
};

const EVENTS: { key: string; title: string; text: string; Icon: typeof Check; color: string }[] = [
  { key: "reservation.manual_review", title: "Nouvelle réservation en attente", text: "Une demande nécessite une décision", Icon: CalendarDays, color: "text-[#1255d6]" },
  { key: "reservation.auto_approved", title: "Réservation confirmée", text: "Une réservation est validée", Icon: Check, color: "text-[#0f9d78]" },
  { key: "reservation.rejected", title: "Réservation refusée", text: "Une demande est rejetée", Icon: X, color: "text-[#e5342f]" },
  { key: "payment.received", title: "Paiement reçu", text: "Un paiement est enregistré", Icon: CreditCard, color: "text-[#1255d6]" },
  { key: "system.error", title: "Échec technique", text: "Une erreur nécessite une alerte", Icon: Wrench, color: "text-[#f59e0b]" },
];

const MODELS = [
  {
    title: "Réservation confirmée automatiquement",
    client: "Bonjour {client}, votre demande de réservation a été acceptée. Trajet : {trajet}. Date : {date}. Total : {montant}. Statut : CONFIRMÉE.",
    admin: "Une réservation a été automatiquement confirmée. Client : {client}. Trajet : {trajet}. Montant : {montant}.",
  },
  {
    title: "Demande en attente de validation",
    client: "Bonjour {client}, votre demande a été transmise à notre équipe pour vérification. Statut : EN ATTENTE DE VALIDATION.",
    admin: "Action requise : nouvelle demande de {client} pour {trajet}. Merci d'accepter, refuser ou proposer une autre condition.",
  },
];

const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Authentification par cookie de session (sj_session), erreurs lues dans "error"
const call = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API}/api/notification-settings${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.message ?? "Erreur");
  return data;
};

const Switch: FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-[#1255d6]" : "bg-gray-300"}`}
  >
    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? "left-6" : "left-0.5"}`} />
  </button>
);

const Badge: FC<{ on: boolean }> = ({ on }) => (
  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${on ? "bg-[#dcf5e7] text-[#0f9d78]" : "bg-gray-100 text-gray-500"}`}>
    {on ? "Actif" : "Inactif"}
  </span>
);

// Ligne : icône | titre + sous-titre | pastille (valeur + badge + interrupteur)
const Row: FC<{ icon: ReactNode; title: string; sub: string; children: ReactNode }> = ({ icon, title, sub, children }) => (
  <div className="flex items-center gap-3">
    <div className="w-11 h-11 shrink-0 flex items-center justify-center">{icon}</div>
    <div className="w-36 shrink-0 border-l border-[#dbe5f5] pl-3">
      <p className="text-sm font-bold leading-tight">{title}</p>
      <p className="text-[11px] text-[#3e5788]">{sub}</p>
    </div>
    <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl bg-white border border-[#e5ebf5] shadow-sm px-3 py-2.5">
      {children}
    </div>
  </div>
);

const Note: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 rounded-lg bg-[#eef4ff] text-[#1255d6] text-xs p-3">
    <Info size={14} className="shrink-0 mt-0.5" />
    <p>{children}</p>
  </div>
);

const NotificationSettingsPanel: FC = () => {
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const allowed = /propri|admin/i.test(String(currentUser?.role ?? ""));

  const [tab, setTab] = useState<TabKey>("dest");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLogs = () => call("/history").then(setLogs).catch(() => setLogs([]));

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    call("")
      .then((d) => { setForm(d); setSaved(d); setOnline(true); })
      .catch((e) => { setOnline(false); setMsg({ ok: false, text: e.message }); })
      .finally(() => setLoading(false));
  }, [allowed]);

  useEffect(() => {
    if (allowed && tab === "history") loadLogs();
  }, [tab, allowed]);

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

  const toggleEvent = (k: string) =>
    setForm((f) => ({ ...f, events: f.events.includes(k) ? f.events.filter((x) => x !== k) : [...f.events, k] }));

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

  const reset = () => {
    if (saved) setForm(saved);
    setMsg(null);
  };

  const sendTest = async () => {
    if (!saved) return;
    const channels: ("whatsapp" | "email")[] = [];
    if (saved.whatsappEnabled && saved.whatsappNumber) channels.push("whatsapp");
    if (saved.emailEnabled && saved.emailAddress) channels.push("email");
    if (!channels.length) {
      setMsg({ ok: false, text: "Activez et enregistrez au moins un canal avant le test." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      for (const channel of channels) await call("/test", { method: "POST", body: JSON.stringify({ channel }) });
      setMsg({ ok: true, text: "Message de test envoyé." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  const tabs: { key: TabKey; label: string; Icon: typeof Users }[] = [
    { key: "dest", label: "Destinataires & Canaux", Icon: Users },
    { key: "events", label: "Événements", Icon: CalendarDays },
    { key: "models", label: "Modèles de Messages", Icon: MessageSquare },
    { key: "history", label: "Historique", Icon: Clock },
  ];

  const clientCard = (
    <div className="rounded-2xl border border-[#c9dafb] overflow-hidden bg-[#f7faff] shadow-sm">
      <div className="bg-[#dfe9ff] p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#1255d6] text-white flex items-center justify-center">
          <UserCircle2 size={28} />
        </div>
        <div>
          <h3 className="text-xl font-extrabold">Client / Voyageur</h3>
          <p className="text-sm text-[#3e5788]">Coordonnées issues de son compte</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <Row icon={<MessageCircle size={34} className="text-[#25d366]" />} title="WhatsApp client" sub="Numéro du compte client">
          <span className="flex-1 text-sm text-gray-500 truncate">+261 34 ** ** **</span>
          <Badge on={form.clientWhatsappEnabled} />
          <Switch checked={form.clientWhatsappEnabled} onChange={(v) => setForm({ ...form, clientWhatsappEnabled: v })} label="WhatsApp client" />
        </Row>
        <Row icon={<Mail size={34} className="text-[#1255d6]" />} title="E-mail client" sub="Adresse du compte client">
          <span className="flex-1 text-sm text-gray-500 truncate">client@••••••</span>
          <Badge on={form.clientEmailEnabled} />
          <Switch checked={form.clientEmailEnabled} onChange={(v) => setForm({ ...form, clientEmailEnabled: v })} label="E-mail client" />
        </Row>
        <Note>Chaque client reçoit uniquement ses propres notifications, directement sur son WhatsApp ou sa boîte e-mail. Ses coordonnées viennent de son compte et ne sont jamais affichées ici.</Note>
      </div>
    </div>
  );

  const adminCard = (
    <div className="rounded-2xl border border-[#f5d79a] overflow-hidden bg-[#fffdf7] shadow-sm">
      <div className="bg-[#fff0cc] p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#f59e0b] text-white flex items-center justify-center">
          <ShieldCheck size={26} />
        </div>
        <div>
          <h3 className="text-xl font-extrabold">Administrateur</h3>
          <p className="text-sm text-[#3e5788]">Coordonnées configurées dans le tableau de bord</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <Row icon={<MessageCircle size={34} className="text-[#25d366]" />} title="WhatsApp administrateur" sub="Numéro configuré">
          <input
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            placeholder="+261340000000"
            value={form.whatsappNumber}
            onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value.trim() })}
          />
          <Badge on={form.whatsappEnabled} />
          <Switch checked={form.whatsappEnabled} onChange={(v) => setForm({ ...form, whatsappEnabled: v })} label="WhatsApp administrateur" />
        </Row>
        {phoneBad && <p className="text-[11px] text-[#e5342f]">Format attendu : + suivi de l'indicatif et du numéro.</p>}
        <Row icon={<Mail size={34} className="text-[#1255d6]" />} title="E-mail administrateur" sub="Adresse configurée">
          <input
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            type="email"
            placeholder="admin@exemple.com"
            value={form.emailAddress}
            onChange={(e) => setForm({ ...form, emailAddress: e.target.value.trim() })}
          />
          <Badge on={form.emailEnabled} />
          <Switch checked={form.emailEnabled} onChange={(v) => setForm({ ...form, emailEnabled: v })} label="E-mail administrateur" />
        </Row>
        {mailBad && <p className="text-[11px] text-[#e5342f]">Adresse e-mail invalide.</p>}
        <Note>Ces coordonnées reçoivent les notifications administratives.</Note>
      </div>
    </div>
  );

  const eventsCard = (
    <div className="rounded-2xl border border-[#d9ccf5] overflow-hidden bg-white shadow-sm">
      <div className="bg-[#efe8ff] p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center">
          <CalendarDays size={26} />
        </div>
        <div>
          <h3 className="text-xl font-extrabold">Événements à notifier</h3>
          <p className="text-sm text-[#3e5788]">Choisissez les événements qui doivent déclencher une notification</p>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {EVENTS.map(({ key, title, text, Icon, color }) => (
          <div key={key} className="rounded-xl border border-[#e5ebf5] bg-white shadow-sm p-3 text-center flex flex-col items-center gap-2">
            <Icon size={28} className={color} />
            <p className="text-sm font-extrabold leading-tight">{title}</p>
            <p className="text-xs text-[#3e5788] flex-1">{text}</p>
            <Switch checked={form.events.includes(key)} onChange={() => toggleEvent(key)} label={title} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-5 bg-[#f3f7fd] min-h-full space-y-4 text-[#10285e]">
      {/* En-tête */}
      <div className="rounded-2xl bg-[#e3edff] p-4 flex flex-wrap items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#c9dafb] text-[#1255d6] flex items-center justify-center">
          <Settings size={32} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-3xl font-extrabold leading-tight">Configuration des Notifications</h1>
          <p className="text-sm text-[#3e5788]">Gérez les destinataires, les canaux et les événements à notifier</p>
        </div>
        <span className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${online ? "bg-[#e8f8ef] border-[#9fdcb8] text-[#0f9d78]" : "bg-[#ffe9e9] border-[#f3b4b4] text-[#e5342f]"}`}>
          {online ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {online ? "Système connecté" : "Serveur indisponible"}
        </span>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-3">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border shadow-sm ${
              tab === key ? "bg-[#1255d6] text-white border-[#1255d6]" : "bg-[#eef4ff] text-[#10285e] border-[#dbe5f5]"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Chargement…</p>
      ) : (
        <>
          {tab === "dest" && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {clientCard}
                {adminCard}
              </div>
              {eventsCard}
            </>
          )}

          {tab === "events" && eventsCard}

          {tab === "models" && (
            <div className="space-y-3">
              {MODELS.map((m) => (
                <div key={m.title} className="bg-white rounded-xl border border-[#dbe5f5] p-4 space-y-2 text-xs">
                  <h3 className="font-bold text-sm">{m.title}</h3>
                  <p><b className="text-[#1255d6]">Message client :</b> {m.client}</p>
                  <p><b className="text-[#b45309]">Message administrateur :</b> {m.admin}</p>
                </div>
              ))}
              <p className="text-[11px] text-gray-500">Aperçu en lecture seule. Les valeurs entre accolades sont remplacées par les vraies données au moment de l'envoi.</p>
            </div>
          )}

          {tab === "history" && (
            <div className="bg-white rounded-xl border border-[#dbe5f5] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Dernières notifications</h3>
                <button type="button" onClick={loadLogs} className="text-[11px] font-semibold text-[#1255d6] flex items-center gap-1">
                  <RefreshCw size={12} /> Actualiser
                </button>
              </div>
              {logs.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">Aucun envoi enregistré.</p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1">Date</th><th>Canal</th><th>Événement</th><th>Destinataire</th><th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="py-1.5">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                        <td>{l.channel}</td>
                        <td>{l.event}</td>
                        <td>{l.recipient ?? "—"}</td>
                        <td className={l.status === "sent" ? "text-[#0f9d78] font-semibold" : "text-[#e5342f] font-semibold"}>
                          {l.status === "sent" ? "Envoyé" : `Échec${l.error ? ` (${l.error})` : ""}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-[10px] text-gray-500 mt-3">Un envoi réussi n'est jamais une preuve de réservation confirmée : seul le backend valide.</p>
            </div>
          )}

          {/* Test */}
          <div className="rounded-2xl border border-[#9fdcb8] bg-[#e8f8ef] p-4 flex flex-wrap items-center gap-4">
            <Send size={30} className="text-[#1255d6]" />
            <div className="flex-1 min-w-[220px]">
              <h3 className="text-lg font-extrabold">Tester les notifications</h3>
              <p className="text-sm text-[#3e5788]">Envoyez un message de test pour vérifier vos paramètres.</p>
            </div>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy || changedContact}
              className="flex items-center gap-2 bg-white border border-[#1255d6] text-[#1255d6] text-sm font-bold px-5 py-2.5 rounded-full disabled:opacity-50"
            >
              <Send size={14} /> Envoyer un message de test
            </button>
          </div>
          {changedContact && <p className="text-[11px] text-[#b45309]">Enregistrez vos nouvelles coordonnées avant d'envoyer un test.</p>}

          {/* Actions */}
          <div className="rounded-2xl bg-white border border-[#dbe5f5] p-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="flex items-center gap-2 border border-[#dbe5f5] bg-[#f8fafd] text-sm font-bold px-5 py-2.5 rounded-full"
            >
              <RefreshCw size={14} /> Réinitialiser
            </button>
            {msg && (
              <span className={`flex items-center gap-1 text-xs ${msg.ok ? "text-[#0f9d78]" : "text-[#e5342f]"}`}>
                {msg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg.text}
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={busy || phoneBad || mailBad}
              className="ml-auto flex items-center gap-2 bg-[#1255d6] hover:bg-[#0e45b3] text-white text-sm font-bold px-7 py-3 rounded-full disabled:opacity-50"
            >
              <Save size={14} /> Enregistrer les paramètres
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationSettingsPanel;