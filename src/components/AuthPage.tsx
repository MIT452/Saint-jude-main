import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../redux";
import { setCurrentUser } from "../redux/feature/users";
import {
  Anchor, ArrowRight, Bell, CalendarClock, Camera, Check, ChevronDown, Eye, EyeOff, FolderOpen,
  Headset, KeyRound, Lock, LogIn, Mail, Phone, Ship, ShieldCheck, User, UserCog, UserPlus,
} from "lucide-react";
import { loginUser, registerUser } from "../data/service";
import type { Role } from "../data/service";

/* ---------- Images ----------
   Mettre vos photos dans public/images/ puis renseigner le nom du fichier.
   Laisser "" pour utiliser le dégradé / l'image par défaut (aucun 404). */
const LOGIN_PHOTO = ""; // ex. "login-bg.jpg"
const SHIP_PHOTO = ""; // ex. "ship.jpg"
const SHIP_FALLBACK =
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=85";

const BASE = (import.meta.env.BASE_URL as string | undefined) ?? "/";
const photoUrl = (file: string) => `${BASE}images/${file}`;

const SEA = "linear-gradient(160deg,#1f74d6 0%,#3b8fe0 40%,#0d4aa8 100%)";
const LOGIN_BG = LOGIN_PHOTO ? `url(${photoUrl(LOGIN_PHOTO)}), ${SEA}` : SEA;
const SHIP_SRC = SHIP_PHOTO ? photoUrl(SHIP_PHOTO) : SHIP_FALLBACK;

/* Les 5 rôles de SAINT-JUDE à l'inscription :
   - Client / Voyageur : inscription publique, rôle attribué automatiquement, aucun code
   - Agent / Gestionnaire / Capitaine / Propriétaire-Administrateur : code d'accès
     généré par le Propriétaire (toujours revérifié côté serveur) */
const DEFAULT_ROLE = "client" as Role;
const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "client" as Role, label: "Client / Voyageur" },
  { value: "agent" as Role, label: "Agent" },
  { value: "gestionnaire" as Role, label: "Gestionnaire" },
  { value: "capitaine" as Role, label: "Capitaine" },
  { value: "proprietaire" as Role, label: "Propriétaire / Administrateur" },
];
const ROLES_WITH_CODE: string[] = ["agent", "gestionnaire", "capitaine", "proprietaire"];
const needsCode = (r: Role) => ROLES_WITH_CODE.includes(String(r));
const roleLabel = (r: Role) => ROLE_OPTIONS.find((o) => String(o.value) === String(r))?.label ?? String(r);

const MAX_PHOTO = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const RULES: Array<[string, (p: string) => boolean]> = [
  ["Au moins 8 caractères", (p) => p.length >= 8],
  ["Une lettre majuscule", (p) => /[A-Z]/.test(p)],
  ["Une lettre minuscule", (p) => /[a-z]/.test(p)],
  ["Un chiffre", (p) => /\d/.test(p)],
  ["Un caractère spécial", (p) => /[^A-Za-z0-9]/.test(p)],
];
const isStrong = (p: string) => RULES.every(([, ok]) => ok(p));

// Numéro malgache saisi après +261 : 34 12 345 67 ou 034 12 345 67 -> 9 chiffres
const localDigits = (v: string) => v.replace(/\D/g, "").replace(/^0/, "");
const isMgLocal = (v: string) => /^3\d{8}$/.test(localDigits(v));

const script = { fontFamily: "'Brush Script MT','Segoe Script',cursive" } as const;
const photoKey = (id: unknown) => `profilePhoto:${String(id ?? "")}`;

const resizeImage = (file: File, max = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lecture"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const size = Math.min(max, side);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

/* ---------- Petits composants ---------- */
const Wheel = ({ size = 84 }: { size?: number }) => (
  <div
    className="relative flex items-center justify-center rounded-full border-[5px] border-dashed border-[#0b3aa8] text-[#0b3aa8]"
    style={{ width: size, height: size }}
  >
    <Anchor size={size * 0.5} strokeWidth={2.4} />
  </div>
);

const Logo = () => (
  <div className="flex flex-col items-center text-[#0b3aa8]">
    <Wheel />
    <span className="-mt-1 h-1.5 w-20 rounded-full bg-sky-400/70" />
    <p className="mt-1 text-3xl font-extrabold tracking-wide">SAINT-JUDE</p>
    <p className="text-sm italic text-[#1255d6]">Transport Maritime</p>
  </div>
);

interface FieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  blockIcon?: boolean;
}
const Field = ({ id, label, icon, required = true, type = "text", value, onChange, placeholder, autoComplete, blockIcon }: FieldProps) => (
  <div>
    <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold text-[#10285e]">
      {!blockIcon && <span className="text-[#1255d6]">{icon}</span>}
      {label}
      {required && !blockIcon && <span className="text-red-500">*</span>}
    </label>
    <div className="mt-1.5 flex h-12 items-stretch overflow-hidden rounded-xl border border-[#cfdcf3] bg-white focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
      {blockIcon && <span className="flex w-12 items-center justify-center bg-[#0b3aa8] text-white">{icon}</span>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`flex-1 bg-transparent px-3 text-sm text-[#10285e] outline-none placeholder:text-slate-400 ${blockIcon ? "bg-[#eef4fd]" : ""}`}
      />
    </div>
  </div>
);

interface PwdProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  blockIcon?: boolean;
}
const PwdField = ({ id, label, value, onChange, placeholder, autoComplete, show, onToggle, blockIcon }: PwdProps) => (
  <div>
    <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold text-[#10285e]">
      {!blockIcon && <Lock size={15} className="text-[#1255d6]" />}
      {label}
      {!blockIcon && <span className="text-red-500">*</span>}
    </label>
    <div className="mt-1.5 flex h-12 items-stretch overflow-hidden rounded-xl border border-[#cfdcf3] bg-white focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
      {blockIcon && (
        <span className="flex w-12 items-center justify-center bg-[#0b3aa8] text-white">
          <Lock size={18} />
        </span>
      )}
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={`flex-1 px-3 text-sm text-[#10285e] outline-none placeholder:text-slate-400 ${blockIcon ? "bg-[#eef4fd]" : "bg-transparent"}`}
      />
      <button type="button" onClick={onToggle} tabIndex={-1} className="px-3 text-[#1255d6]" aria-label="Afficher ou masquer le mot de passe">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);

const features: Array<[ReactNode, string, string]> = [
  [<ShieldCheck size={22} />, "Réservez en toute confiance", "Sécurité et fiabilité garanties"],
  [<CalendarClock size={22} />, "Suivez vos réservations", "en temps réel"],
  [<Bell size={22} />, "Recevez des notifications", "par e-mail ou WhatsApp"],
  [<Headset size={22} />, "Assistance IA", "à votre écoute 24h/24"],
];

/* ============================ PAGE ============================ */
const AuthPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tel, setTel] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>(DEFAULT_ROLE);
  const [roleCode, setRoleCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const codeRequired = needsCode(role);

  // Ouvre l'explorateur de fichiers du système
  const openExplorer = () => fileRef.current?.click();

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoError("");
    if (!ALLOWED_TYPES.includes(f.type)) {
      setPhotoError("Format invalide : JPG, JPEG ou PNG uniquement.");
      return;
    }
    if (f.size > MAX_PHOTO) {
      setPhotoError("Image trop lourde (2 Mo maximum).");
      return;
    }
    try {
      setPhoto(await resizeImage(f));
    } catch {
      setPhotoError("Impossible de lire cette image.");
    }
  };

  // Changer de rôle efface le code saisi (il était destiné à un autre rôle)
  const handleRoleChange = (value: Role) => {
    setRole(value);
    setRoleCode("");
    setError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegistering) {
      if (password !== confirmPassword) return setError("Les mots de passe ne correspondent pas.");
      if (!isStrong(password)) return setError("Le mot de passe ne respecte pas les règles de sécurité.");
      if (!isMgLocal(tel)) return setError("Numéro invalide (exemple : 34 12 345 67).");
      if (codeRequired && !roleCode.trim()) return setError(`Le code d'accès du rôle ${roleLabel(role)} est obligatoire.`);
    }

    setIsSubmitting(true);
    try {
      const user = isRegistering
        ? await registerUser({
            name,
            lastName,
            email: login,
            tel: `+261${localDigits(tel)}`,
            password,
            role,
            roleCode: codeRequired ? roleCode.trim() : "",
          })
        : await loginUser({ email: login, password });

      if (isRegistering && photo) {
        try {
          const newId = (user as { id?: unknown } | null)?.id;
          if (newId !== undefined && newId !== null) localStorage.setItem(photoKey(newId), photo);
        } catch {
          /* stockage plein ou indisponible */
        }
      }
      dispatch(setCurrentUser(user));
    } catch (requestError) {
      const responseError = requestError as { response?: { data?: { error?: string } } };
      setError(responseError.response?.data?.error || "Connexion au serveur impossible. Vérifiez le backend et CORS.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setIsRegistering((v) => !v);
    setError("");
  };

  /* ============================ INSCRIPTION ============================ */
  if (isRegistering) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#7ec0f5] via-[#3b8fe0] to-[#0d4aa8] p-3 md:p-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[1fr_1.05fr]">
          {/* ---------- Colonne gauche ---------- */}
          <div className="relative hidden flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-[#e6f3ff] via-[#9fd0f7] to-[#1f74d6] p-6 lg:flex">
            <Logo />
            <p className="mt-4 text-center text-3xl text-[#0b3aa8]" style={script}>
              Plus qu'un transport,
              <br />
              une connexion
            </p>
            <img src={SHIP_SRC} alt="Cargo en mer" className="my-4 h-56 w-full rounded-2xl object-cover shadow-lg" />
            <div className="space-y-2.5">
              {features.map(([icon, t1, t2]) => (
                <div key={t1} className="flex items-center gap-3 rounded-xl bg-[#0d3f94]/90 px-4 py-2.5 text-white">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10">{icon}</span>
                  <p className="text-sm leading-tight">
                    <b>{t1}</b>
                    <br />
                    <span className="text-white/85">{t2}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-auto pt-4 text-center text-2xl text-white" style={script}>
              Ensemble vers
              <br />
              de nouveaux horizons
              <Anchor size={22} className="ml-2 inline-block" />
            </p>
          </div>

          {/* ---------- Carte formulaire ---------- */}
          <form onSubmit={handleSubmit} className="overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-b from-white to-[#eef5ff] shadow-2xl">
            <div className="bg-gradient-to-r from-[#0d4aa8] to-[#1f74d6] py-4 text-center text-white">
              <Anchor size={22} className="mx-auto" />
              <h1 className="text-2xl font-extrabold">Créer un compte</h1>
              <p className="text-sm tracking-wide">SAINT-JUDE</p>
            </div>

            <div className="space-y-4 p-5 md:p-7">
              {/* Photo + explorateur de fichiers */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {photo ? (
                    <img src={photo} alt="Votre photo" className="h-28 w-28 rounded-full border-4 border-[#1255d6] object-cover" />
                  ) : (
                    <span className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#1255d6] bg-[#dcebfb] text-[#1255d6]">
                      <User size={48} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={openExplorer}
                    title="Choisir une photo"
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#1255d6] text-white"
                  >
                    <Camera size={15} />
                  </button>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#10285e]">Ajouter une photo</p>
                  <p className="text-xs text-[#3e5788]">Choisissez une photo de profil (png, jpg, jpeg).</p>
                  <button
                    type="button"
                    onClick={openExplorer}
                    className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1255d6] text-sm font-semibold text-white hover:bg-[#0e45b3]"
                  >
                    <FolderOpen size={17} /> Explorer le fichier
                  </button>
                  <p className="mt-1 text-[11px] text-[#3e5788]">Taille max : 2 Mo • Format : JPG, PNG</p>
                  {photoError && <p className="text-xs text-red-600">{photoError}</p>}
                </div>
                <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={onPhoto} className="hidden" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="name" label="Prénom" icon={<User size={16} />} value={name} onChange={setName} placeholder="Entrez votre prénom" autoComplete="given-name" />
                <Field id="lastName" label="Nom" icon={<User size={16} />} value={lastName} onChange={setLastName} placeholder="Entrez votre nom" autoComplete="family-name" />
              </div>

              <Field id="email" label="Adresse email" icon={<Mail size={16} />} type="email" value={login} onChange={setLogin} placeholder="exemple@gmail.com" autoComplete="email" />

              {/* Téléphone avec préfixe +261 */}
              <div>
                <label htmlFor="tel" className="flex items-center gap-1.5 text-sm font-semibold text-[#10285e]">
                  <Phone size={16} className="text-[#1255d6]" /> Téléphone <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5 flex h-12 items-stretch overflow-hidden rounded-xl border border-[#cfdcf3] bg-white focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
                  <span className="flex items-center gap-1 border-r border-[#cfdcf3] bg-[#eef4fd] px-3 text-sm font-semibold text-[#10285e]">
                    +261 <ChevronDown size={14} />
                  </span>
                  <input
                    id="tel"
                    type="tel"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    placeholder="Votre numéro WhatsApp"
                    autoComplete="tel-national"
                    required
                    className="flex-1 bg-transparent px-3 text-sm text-[#10285e] outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Rôle (toujours visible) */}
              <div>
                <label htmlFor="role" className="flex items-center gap-1.5 text-sm font-semibold text-[#10285e]">
                  <UserCog size={16} className="text-[#1255d6]" /> Rôle <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5 flex h-12 items-stretch overflow-hidden rounded-xl border border-[#cfdcf3] bg-white focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
                  <select
                    id="role"
                    value={String(role)}
                    onChange={(e) => handleRoleChange(e.target.value as Role)}
                    required
                    className="flex-1 bg-transparent px-3 text-sm text-[#10285e] outline-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={String(r.value)} value={String(r.value)}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                {!codeRequired && (
                  <p className="mt-1 text-xs text-[#3e5788]">
                    Compte Client / Voyageur : aucun code requis. Vous pourrez consulter les bateaux et réserver avec l'assistant IA.
                  </p>
                )}
              </div>

              {/* Code d'accès : rôles du personnel uniquement */}
              {codeRequired && (
                <div className="space-y-2 rounded-xl border border-[#c7defa] bg-[#eaf3ff] p-3">
                  <Field
                    id="roleCode"
                    label={`Code d'accès — ${roleLabel(role)}`}
                    icon={<KeyRound size={16} />}
                    type="password"
                    value={roleCode}
                    onChange={setRoleCode}
                    placeholder="Code fourni par le Propriétaire"
                    autoComplete="off"
                  />
                  <p className="text-xs text-[#3e5788]">
                    Ce rôle est réservé au personnel : le code est remis par le Propriétaire, vérifié par le serveur et peut expirer.
                  </p>
                </div>
              )}

              <PwdField id="password" label="Mot de passe" value={password} onChange={setPassword} placeholder="Minimum 8 caractères" autoComplete="new-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
              <PwdField id="confirmPassword" label="Confirmer le mot de passe" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmez votre mot de passe" autoComplete="new-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} />

              {/* Règles du mot de passe : visibles dès que l'on tape */}
              {password && (
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {RULES.map(([label, ok]) => (
                    <li key={label} className={`flex items-center gap-1.5 text-xs ${ok(password) ? "font-medium text-[#14894f]" : "text-[#3e5788]"}`}>
                      <Check size={13} /> {label}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3 rounded-xl border border-[#c7defa] bg-[#eaf3ff] p-3">
                <ShieldCheck size={30} className="shrink-0 text-[#1255d6]" />
                <div>
                  <p className="text-sm font-semibold text-[#10285e]">Votre compte est sécurisé</p>
                  <p className="text-xs text-[#3e5788]">Vos données sont protégées selon les normes de sécurité.</p>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0d4aa8] to-[#1255d6] font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-60"
              >
                <UserPlus size={18} /> {isSubmitting ? "Veuillez patienter…" : "Créer mon compte"} {!isSubmitting && <ArrowRight size={18} />}
              </button>

              <p className="text-center text-sm text-[#3e5788]">
                Déjà inscrit ?{" "}
                <button type="button" onClick={switchMode} className="font-bold text-[#1255d6] hover:underline">
                  Se connecter
                </button>
              </p>

              <p className="flex items-center justify-center gap-2 border-t border-[#dbe5f5] pt-3 text-xs italic text-[#1255d6]">
                <Ship size={16} /> SAINT-JUDE – Transport Maritime Antalaha ↔ Toamasina
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ============================ CONNEXION ============================ */
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ backgroundImage: LOGIN_BG, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <img
        src={SHIP_SRC}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/3 object-cover opacity-70 lg:block"
        style={{ maskImage: "linear-gradient(to left, black 50%, transparent)", WebkitMaskImage: "linear-gradient(to left, black 50%, transparent)" }}
      />

      <form onSubmit={handleSubmit} className="relative w-full max-w-[560px] space-y-5 overflow-hidden rounded-[28px] bg-white/95 p-7 shadow-2xl md:p-10">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#0d4aa8] to-transparent opacity-80" />
        <Anchor size={90} className="pointer-events-none absolute left-4 top-24 -rotate-12 text-[#dcebfb]" />

        <div className="relative flex flex-col items-center text-center">
          <Wheel size={76} />
          <span className="-mt-1 h-1.5 w-16 rounded-full bg-sky-400/70" />
          <p className="mt-1 text-4xl font-extrabold tracking-wide text-[#10285e]">SAINT JUDE</p>
          <p className="text-sm italic text-[#3e5788]">— Transport Maritime Antalaha → Toamasina —</p>
          <h1 className="mt-4 text-3xl font-extrabold text-[#10285e]">
            Bienvenue sur{" "}
            <span className="relative text-[#1255d6]">
              Saint Jude
              <span className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-amber-400" />
            </span>
          </h1>
          <p className="mt-2 italic text-[#3e5788]">Gestion du transport maritime de marchandises</p>
        </div>

        <div className="relative space-y-4">
          <Field id="login" label="Adresse email" icon={<Mail size={18} />} blockIcon type="email" value={login} onChange={setLogin} placeholder="exemple@gmail.com" autoComplete="username" />
          <PwdField id="password" label="Mot de passe" blockIcon value={password} onChange={setPassword} placeholder="Entrez votre mot de passe" autoComplete="current-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
        </div>

        {error && <p className="relative text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="relative flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-[#1255d6] to-[#0b3aa8] text-lg font-semibold text-white shadow-lg hover:brightness-110 disabled:opacity-60"
        >
          <LogIn size={20} /> {isSubmitting ? "Veuillez patienter…" : "Se connecter"}
        </button>

        <p className="relative flex items-center justify-center gap-2 text-sm italic text-[#3e5788]">
          Pas encore de compte ?
          <button type="button" onClick={switchMode} className="flex items-center gap-1 font-bold not-italic text-[#1255d6] hover:underline">
            <UserPlus size={16} /> Créer un compte
          </button>
        </p>

        <p className="relative flex items-center justify-center gap-2 border-t border-[#dbe5f5] pt-3 text-xs italic text-[#3e5788]">
          <Ship size={16} className="text-[#1255d6]" /> Saint Jude – Transport Maritime Antalaha ↔ Toamasina
        </p>
      </form>
    </div>
  );
};

export default AuthPage;