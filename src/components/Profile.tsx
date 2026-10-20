// src/components/Profile.tsx
import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../redux";
import { updateOwnPassword } from "../redux/feature/users";
import {
  Search, Bell, ChevronDown, Calendar, User, UserCircle2, Camera, Mail, Phone, Shield, ShieldCheck, Lock, Eye, EyeOff,
  Check, Lightbulb, Ship, Anchor,
} from "lucide-react";
import { toast } from "react-toastify";

const pad = (n: number) => String(n).padStart(2, "0");
const pick = (u: any, ...keys: string[]) => { for (const k of keys) if (u?.[k] !== undefined && u[k] !== null && u[k] !== "") return u[k]; return undefined; };

const isStrong = (p: string) => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

// Champ lecture seule avec icône (informations personnelles)
const ReadField = ({ label, value, icon, chevron, dot }: { label: string; value: string; icon?: ReactNode; chevron?: boolean; dot?: boolean }) => (
  <div>
    <label className="text-sm font-medium text-[#10285e]">{label}</label>
    <div className="mt-1.5 flex items-center gap-3 border border-[#cfdcf3] rounded-lg bg-white px-3 h-11 text-sm text-[#10285e]">
      {dot ? <span className="w-3 h-3 rounded-full bg-[#1fae6a]" /> : <span className="text-[#1255d6]">{icon}</span>}
      <span className="flex-1 truncate">{value}</span>
      {chevron && <ChevronDown size={16} className="text-gray-500" />}
    </div>
  </div>
);

// Champ mot de passe avec cadenas + œil
const PwdField = ({ label, placeholder, value, onChange, error }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; error?: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-sm font-medium text-[#10285e]">{label}</label>
      <div className={`mt-1.5 flex items-center gap-3 border rounded-lg bg-white px-3 h-11 ${error ? "border-red-400" : "border-[#cfdcf3]"}`}>
        <Lock size={16} className="text-[#1255d6]" />
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="flex-1 outline-none text-sm bg-transparent placeholder:text-gray-400" />
        <button type="button" onClick={() => setShow((s) => !s)} className="text-[#1255d6]" tabIndex={-1}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

const Profile = () => {
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const { error, success } = useSelector((state: RootState) => state.users);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(pick(currentUser, "photo", "image", "avatar", "picture"));
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChangePassword = async () => {
    if (!currentUser) return;
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast("Veuillez remplir tous les champs.");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      toast("Le nouveau mot de passe et la confirmation ne correspondent pas.");
      return;
    }
    if (!isStrong(newPassword.trim())) {
      toast("Le mot de passe ne respecte pas les règles de sécurité.");
      return;
    }
    try {
      setBusy(true);
      await dispatch(
        updateOwnPassword({ userId: currentUser.id, oldPassword: oldPassword.trim(), newPassword: newPassword.trim() })
      ).unwrap();
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Mot de passe modifié avec succès.");
    } catch {
      toast("Échec de la modification du mot de passe.");
    } finally {
      setBusy(false);
    }
  };

  if (!currentUser) return <p>Veuillez vous connecter.</p>;

  const u: any = currentUser;
  const phone = pick(u, "phone", "telephone", "tel", "phoneNumber", "contact") ?? "—";
  const statusRaw = String(pick(u, "status", "statut", "state") ?? "");
  const statusLabel = /cong/i.test(statusRaw) ? "Congé" : /abs|inactif|inactive/i.test(statusRaw) ? "Absent" : /actif|active/i.test(statusRaw) ? "Actif" : statusRaw || "—";
  const lastRaw = pick(u, "lastLogin", "lastLoginAt", "derniereConnexion", "lastConnection");
  const last = lastRaw ? new Date(lastRaw) : null;
  const lastLabel = last && !isNaN(last.getTime()) ? `${pad(last.getDate())}/${pad(last.getMonth() + 1)}/${last.getFullYear()} à ${pad(last.getHours())}:${pad(last.getMinutes())}` : "—";
  const fullName = `${currentUser.name ?? ""} ${currentUser.lastName ?? ""}`.trim();
  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const canSubmit = !!oldPassword.trim() && isStrong(newPassword) && newPassword === confirmPassword && !busy;

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhoto(URL.createObjectURL(f)); // aperçu local uniquement (non enregistré)
  };

  const Avatar = ({ size }: { size: string }) =>
    photo ? <img src={photo} alt="" className={`${size} rounded-full object-cover`} />
      : <span className={`${size} rounded-full bg-[#2aa3f0] text-white flex items-center justify-center`}><User size={40} /></span>;

  return (
    <div className="bg-[#f3f7fd] min-h-full text-[#10285e]">
      {/* Barre du haut */}
      <div className="bg-white border-b border-[#e3eaf6] px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[260px] max-w-[500px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1255d6]" />
          <input placeholder="Rechercher une fonction, un bateau, un trajet..." className="w-full bg-[#eef3fb] rounded-full pl-11 pr-3 py-3 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Bell size={22} className="text-[#1255d6]" />
          <div className="flex items-center gap-2 bg-[#eef3fb] rounded-full pl-1.5 pr-3 py-1">
            <div className="w-9 h-9 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><UserCircle2 size={20} /></div>
            <span className="text-sm">{currentUser.role === "Propriétaire" ? "Administrateur" : currentUser.name}</span>
            <ChevronDown size={14} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar size={26} className="text-[#1255d6]" />
            <div><p className="capitalize">{dateLabel}</p><p>{pad(now.getHours())}:{pad(now.getMinutes())}</p></div>
          </div>
        </div>
      </div>

      {/* Bandeau titre avec vagues */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#f4f9ff] via-[#eaf4ff] to-[#d6e9fb] border-b border-[#e3eaf6]">
        <svg className="absolute right-0 bottom-0 h-full w-[55%] opacity-70" viewBox="0 0 600 100" preserveAspectRatio="none">
          <path d="M0,70 C80,40 160,95 260,65 C360,35 440,85 600,50 L600,100 L0,100 Z" fill="#b9d8f5" />
          <path d="M0,85 C100,60 200,100 300,80 C400,60 500,95 600,75 L600,100 L0,100 Z" fill="#8fc0ee" />
        </svg>
        <div className="relative px-7 py-5 flex items-center gap-5">
          <div className="w-[72px] h-[72px] rounded-full bg-[#1d8bf0] text-white flex items-center justify-center shadow-md shrink-0"><User size={40} /></div>
          <div className="mr-auto">
            <h1 className="text-3xl font-extrabold text-[#0b3aa8]">Mon profil</h1>
            <p className="text-base text-[#3e5788]">Modifiez votre mot de passe pour protéger l'accès à votre compte</p>
          </div>
          <Ship size={54} className="hidden md:block text-[#2f6fb8]" />
          <p className="hidden md:flex items-center gap-2 italic text-[#1255d6] text-lg" style={{ fontFamily: "cursive" }}>Votre sécurité, notre priorité <Anchor size={20} /></p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        {/* Colonne gauche */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-5">
            <h3 className="text-lg font-bold text-[#0b3aa8] flex items-center gap-3 mb-4"><User size={22} className="text-[#1255d6]" /> Informations personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-5">
              <div className="flex flex-col items-center gap-2 pt-3">
                <div className="relative">
                  <Avatar size="w-[120px] h-[120px]" />
                  <button onClick={() => fileRef.current?.click()} title="Changer la photo (aperçu local)" className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-[#10285e] text-white flex items-center justify-center border-2 border-white"><Camera size={16} /></button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-xs text-[#1255d6]">Changer la photo</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <ReadField label="Nom *" value={currentUser.name ?? "—"} icon={<User size={16} />} />
                <ReadField label="Prénom *" value={currentUser.lastName ?? "—"} icon={<User size={16} />} />
                <ReadField label="Email *" value={currentUser.email ?? "—"} icon={<Mail size={16} />} />
                <ReadField label="Téléphone *" value={phone} icon={<Phone size={16} />} />
                <ReadField label="Rôle" value={currentUser.role ?? "—"} icon={<Shield size={16} />} chevron />
                <ReadField label="Statut" value={statusLabel} dot chevron />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-5">
            <h3 className="text-lg font-bold text-[#0b3aa8] flex items-center gap-3 mb-4"><Lock size={22} className="text-[#1255d6]" /> Changer mon mot de passe</h3>
            <div className="flex items-center gap-3 bg-[#eaf3ff] border border-[#c7defa] rounded-lg px-4 py-3 text-xs text-[#1d4fb8] mb-4">
              <ShieldCheck size={26} className="shrink-0" />
              <p>Votre mot de passe doit contenir au moins 8 caractères, une lettre majuscule, une lettre minuscule, un chiffre et un caractère spécial.</p>
            </div>
            <div className="space-y-4">
              <PwdField label="Ancien mot de passe" placeholder="Votre ancien mot de passe" value={oldPassword} onChange={setOldPassword} />
              <PwdField label="Nouveau mot de passe" placeholder="Votre nouveau mot de passe" value={newPassword} onChange={setNewPassword}
                error={newPassword && !isStrong(newPassword) ? "Le mot de passe ne respecte pas les règles ci-dessus" : undefined} />
              <PwdField label="Confirmer le nouveau mot de passe" placeholder="Confirmez votre nouveau mot de passe" value={confirmPassword} onChange={setConfirmPassword}
                error={confirmPassword && confirmPassword !== newPassword ? "Les mots de passe ne correspondent pas" : undefined} />
              <button onClick={handleChangePassword} disabled={!canSubmit}
                className="w-full h-11 rounded-lg bg-[#1255d6] hover:bg-[#0e45b3] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Lock size={16} /> {busy ? "Modification..." : "Modifier le mot de passe"}
              </button>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              {success && <p className="text-green-600 text-sm">{success}</p>}
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-5">
            <h3 className="text-lg font-bold text-[#0b3aa8] flex items-center gap-3 mb-3"><span className="w-9 h-9 rounded-full bg-[#10285e] text-white flex items-center justify-center"><UserCircle2 size={20} /></span> Aperçu du compte</h3>
            <ul className="text-sm">
              {[
                [<User size={18} key="a" />, "Nom", fullName || "—"],
                [<Mail size={18} key="b" />, "Email", currentUser.email ?? "—"],
                [<Phone size={18} key="c" />, "Téléphone", phone],
                [<Shield size={18} key="d" />, "Rôle", currentUser.role ?? "—"],
              ].map(([ic, l, v]: any) => (
                <li key={l} className="flex items-center gap-3 py-3.5 border-b">
                  <span className="text-[#1255d6]">{ic}</span><span className="w-28">{l}</span><span className="flex-1 break-all">{v}</span>
                </li>
              ))}
              <li className="flex items-center gap-3 py-3 border-b">
                <span className="w-[18px] h-[18px] rounded-full bg-[#1fae6a]" /><span className="w-28">Statut</span>
                <span className="px-3 py-1 rounded-md bg-[#d9f5e6] text-[#14894f] font-semibold text-xs">{statusLabel}</span>
              </li>
              <li className="flex items-center gap-3 py-3.5">
                <Calendar size={18} className="text-[#1255d6]" /><span className="w-28 text-xs">Dernière connexion</span><span className="flex-1 text-xs">{lastLabel}</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-5">
            <h3 className="text-lg font-bold text-[#0b3aa8] flex items-center gap-3 mb-3"><ShieldCheck size={24} className="text-[#1255d6]" /> Sécurité</h3>
            <ul className="divide-y">
              {[
                ["Compte protégé", "Votre compte est sécurisé"],
                ["Authentification active", "Connexion avec mot de passe"],
                ["Accès restreint", "Seuls les utilisateurs autorisés peuvent accéder"],
              ].map(([t, s]) => (
                <li key={t} className="flex items-center gap-3 py-3">
                  <span className="w-8 h-8 rounded-full bg-[#1fae6a] text-white flex items-center justify-center shrink-0"><Check size={16} /></span>
                  <div><p className="text-sm font-medium text-[#0b3aa8]">{t}</p><p className="text-xs text-gray-500">{s}</p></div>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-[#b7d4f6] bg-gradient-to-br from-[#eaf4ff] to-[#dbeafb] p-4 flex gap-3">
              <Lightbulb size={22} className="text-[#1255d6] shrink-0" />
              <div><p className="font-semibold text-sm text-[#0b3aa8]">Conseil</p><p className="text-xs text-[#3e5788] mt-1">Changez régulièrement votre mot de passe pour une meilleure sécurité de votre compte.</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;