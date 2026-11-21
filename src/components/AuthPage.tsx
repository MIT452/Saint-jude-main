import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../redux";
import { setCurrentUser } from "../redux/feature/users";
import {
  Anchor, ArrowRight, Camera, Check, Eye, EyeOff, Lock, LogIn, Mail, Phone,
  Ship, ShieldCheck, User, UserPlus, Users,
} from "lucide-react";
import { loginUser, registerUser } from "../data/service";
import type { Role } from "../data/service";

/* ---------- Images de fond ----------
   Laisser "" tant que le fichier n'existe pas dans public/images/.
   Ex. : const LOGIN_PHOTO = "login-bg.jpg";  (puis ajouter public/images/login-bg.jpg) */
const LOGIN_PHOTO = "";
const REGISTER_IMAGE = "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1600&q=85";

const BASE = (import.meta.env.BASE_URL as string | undefined) ?? "/";
const photoUrl = (file: string) => `url(${BASE}images/${file})`;
// Ajoute la photo seulement si un fichier est défini, sinon dégradé seul (aucun 404)
const withPhoto = (file: string, fallback: string) => (file ? `${photoUrl(file)}, ${fallback}` : fallback);

const LOGIN_BG = withPhoto(LOGIN_PHOTO, `linear-gradient(180deg,rgba(9,43,100,.12),rgba(4,39,100,.34)), url("${REGISTER_IMAGE}")`);

// Rôles proposés à l'inscription : Propriétaire, Admin, Gestionnaire.
// Chaque rôle est protégé par un code d'accès vérifié côté serveur (voir backend).
const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "proprietaire" as Role, label: "Propriétaire" },
  { value: "admin" as Role, label: "Administrateur" },
  { value: "gestionnaire" as Role, label: "Gestionnaire" },
];

const RULES: Array<[string, (p: string) => boolean]> = [
  ["Au moins 8 caractères", (p) => p.length >= 8],
  ["Une lettre majuscule", (p) => /[A-Z]/.test(p)],
  ["Une lettre minuscule", (p) => /[a-z]/.test(p)],
  ["Un chiffre", (p) => /\d/.test(p)],
  ["Un caractère spécial", (p) => /[^A-Za-z0-9]/.test(p)],
];
const isStrong = (p: string) => RULES.every(([, ok]) => ok(p));

// Numéro malgache : 034 12 345 67, 0341234567, +261 34 12 345 67 ou 261341234567
const isMgPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  return /^261\d{9}$/.test(d) || /^0\d{9}$/.test(d);
};

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

const Logo = () => (
  <div className="flex items-center gap-3 text-white">
    <div className="relative">
      <Ship size={52} strokeWidth={1.6} />
      <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-sky-300/80" />
    </div>
    <div className="leading-tight">
      <p className="text-3xl font-extrabold tracking-wide">SAINT-JUDE</p>
      <p className="text-lg tracking-wider">Transport Maritime</p>
    </div>
  </div>
);

interface FieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  labelIcon?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}
const Field = ({ id, label, icon, labelIcon, type = "text", value, onChange, placeholder, autoComplete }: FieldProps) => (
  <div>
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-[#10285e]">
      {labelIcon && <span className="text-[#1255d6]">{icon}</span>}
      {label}
    </label>
    <div className="mt-1.5 flex items-center gap-3 h-12 rounded-xl border border-[#cfdcf3] bg-white px-3 focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
      <span className="text-[#1255d6]">{icon}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="flex-1 bg-transparent outline-none text-sm text-[#10285e] placeholder:text-slate-400"
      />
    </div>
  </div>
);

interface PwdProps {
  id: string;
  label: string;
  labelIcon?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
}
const PwdField = ({ id, label, labelIcon, value, onChange, placeholder, autoComplete, show, onToggle }: PwdProps) => (
  <div>
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-[#10285e]">
      {labelIcon && <Lock size={16} className="text-[#1255d6]" />}
      {label}
    </label>
    <div className="mt-1.5 flex items-center gap-3 h-12 rounded-xl border border-[#cfdcf3] bg-white px-3 focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
      <Lock size={17} className="text-[#1255d6]" />
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="flex-1 bg-transparent outline-none text-sm text-[#10285e] placeholder:text-slate-400"
      />
      <button type="button" onClick={onToggle} tabIndex={-1} className="text-[#1255d6]" aria-label="Afficher ou masquer le mot de passe">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);

const AuthPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tel, setTel] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("gestionnaire");
  const [roleCode, setRoleCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoError("");
    if (!f.type.startsWith("image/")) {
      setPhotoError("Veuillez choisir une image (JPG, PNG…).");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setPhotoError("Image trop lourde (8 Mo maximum).");
      return;
    }
    try {
      setPhoto(await resizeImage(f));
    } catch {
      setPhotoError("Impossible de lire cette image.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (isRegistering) {
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
      if (!isStrong(password)) {
        setError("Le mot de passe ne respecte pas les règles de sécurité.");
        return;
      }
      if (!isMgPhone(tel)) {
        setError("Numéro de téléphone invalide (exemple : 034 12 345 67).");
        return;
      }
      if (!role || !ROLE_OPTIONS.some((r) => r.value === role)) {
        setError("Veuillez sélectionner un rôle valide.");
        return;
      }
      if (!roleCode.trim()) {
        setError("Le code d'accès du rôle est obligatoire.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const user = isRegistering
        ? await registerUser({
            name,
            lastName,
            email: login,
            tel,
            password,
            role,
            roleCode: roleCode.trim(),
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
    setInfo("");
  };

  const messages = (
    <>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {info && <p className="text-[#1255d6] text-sm">{info}</p>}
    </>
  );

  /* ============================ INSCRIPTION ============================ */
  if (isRegistering) {
    return (
      <div
        className="min-h-screen bg-[#0b4b9b] bg-cover bg-center bg-fixed"
        style={{ backgroundImage: LOGIN_BG }}
      >
        <div className="relative min-h-screen max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[.9fr_1.1fr] items-center gap-5 px-4 py-6 md:px-8 lg:gap-10">
          <div className="relative hidden min-h-[680px] overflow-hidden rounded-3xl border border-white/40 shadow-2xl lg:order-1 lg:block">
            <img
              src={REGISTER_IMAGE}
              alt="Bateau naviguant sur une mer turquoise"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#062c58]/90 via-[#075985]/25 to-[#087ca8]/20" />
            <div className="relative flex min-h-[680px] flex-col justify-between p-8 text-white">
              <Logo />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">SAINT-JUDE · Madagascar</p>
                <h2 className="mt-3 max-w-sm text-4xl font-extrabold leading-tight">Relier les îles, rapprocher les hommes.</h2>
                <p className="mt-3 text-white/90">Transport maritime de marchandises · Antalaha ↔ Toamasina</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-[650px] justify-self-center rounded-3xl border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur md:p-7 lg:order-2">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-[#1255d6] text-white flex items-center justify-center shadow-md -mt-14 md:-mt-16 mb-3 ring-4 ring-white">
                <UserPlus size={30} />
              </div>
              <h1 className="text-3xl font-extrabold text-[#0b3aa8]">Créer un compte</h1>
              <p className="text-[#3e5788] mt-2">Rejoignez SAINT-JUDE et accédez à vos réservations en toute sécurité.</p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {photo ? (
                  <img src={photo} alt="Votre photo" className="w-24 h-24 rounded-full object-cover border-4 border-[#dcebfb]" />
                ) : (
                  <span className="w-24 h-24 rounded-full bg-[#dcebfb] text-[#1255d6] flex items-center justify-center border-4 border-white shadow">
                    <User size={40} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="Explorer les fichiers pour choisir une photo"
                  aria-label="Explorer les fichiers pour choisir une photo de profil"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#10285e] text-white flex items-center justify-center border-2 border-white"
                >
                  <Camera size={16} />
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} className="hidden" aria-label="Choisir une photo de profil" />
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-[#1255d6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0e45b3]">
                {photo ? "Changer la photo" : "Explorer le fichier"}
              </button>
              <p className="text-[11px] text-[#3e5788]">Photo de profil facultative · JPG, PNG ou WEBP · 8 Mo maximum</p>
              {photoError && <p className="text-xs text-red-600">{photoError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="name" label="Prénom" icon={<User size={17} />} value={name} onChange={setName} placeholder="Votre prénom" autoComplete="given-name" />
              <Field id="lastName" label="Nom" icon={<User size={17} />} value={lastName} onChange={setLastName} placeholder="Votre nom" autoComplete="family-name" />
            </div>

            <Field id="email" label="Adresse e-mail" icon={<Mail size={17} />} type="email" value={login} onChange={setLogin} placeholder="exemple@domaine.com" autoComplete="email" />
            <Field id="tel" label="Téléphone" icon={<Phone size={17} />} type="tel" value={tel} onChange={setTel} placeholder="034 12 345 67" autoComplete="tel" />

            {/* ---------- Sélecteur de rôle : Propriétaire / Admin / Gestionnaire ---------- */}
            <div>
              <label htmlFor="role" className="flex items-center gap-2 text-sm font-semibold text-[#10285e]">
                <Users size={16} className="text-[#1255d6]" />
                Rôle / Accès
              </label>
              <div className="mt-1.5 flex items-center gap-3 h-12 rounded-xl border border-[#cfdcf3] bg-white px-3 focus-within:border-[#1255d6] focus-within:ring-2 focus-within:ring-[#1255d6]/20">
                <ShieldCheck size={17} className="text-[#1255d6]" />
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  required
                  className="flex-1 bg-transparent outline-none text-sm text-[#10285e] cursor-pointer"
                >
                  <option value="" disabled>
                    Sélectionnez un rôle…
                  </option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-[#3e5788]">
                Ce rôle détermine les droits d’accès dans la plateforme.
              </p>
            </div>

            {/* ---------- Code d'accès du rôle (vérifié par le serveur) ---------- */}
            <div>
              <Field
                id="roleCode"
                label="Code d'accès du rôle"
                icon={<Lock size={17} />}
                type="password"
                value={roleCode}
                onChange={setRoleCode}
                placeholder="Code fourni par le propriétaire"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-[#3e5788]">
                Chaque rôle (Propriétaire, Administrateur, Gestionnaire) est protégé par son propre code, remis par le propriétaire de SAINT-JUDE.
              </p>
            </div>

            <PwdField
              id="password"
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              placeholder="Votre mot de passe"
              autoComplete="new-password"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />
            <PwdField
              id="confirmPassword"
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirmez votre mot de passe"
              autoComplete="new-password"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />

            <div className="flex gap-4 rounded-xl bg-[#eaf3ff] border border-[#c7defa] p-4">
              <ShieldCheck size={34} className="text-[#1255d6] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#10285e]">Votre mot de passe doit contenir :</p>
                <ul className="mt-1.5 space-y-1">
                  {RULES.map(([label, ok]) => (
                    <li key={label} className={`flex items-center gap-2 text-sm ${ok(password) ? "text-[#14894f] font-medium" : "text-[#1255d6]"}`}>
                      <Check size={15} /> {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {messages}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-[#1255d6] hover:bg-[#0e45b3] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <UserPlus size={18} /> {isSubmitting ? "Veuillez patienter…" : "Créer mon compte"} {!isSubmitting && <ArrowRight size={18} />}
            </button>

            <div className="flex items-center gap-3 text-sm text-[#3e5788]">
              <span className="flex-1 h-px bg-[#dbe5f5]" />
              <span>
                Déjà inscrit ?{" "}
                <button type="button" onClick={switchMode} className="font-bold text-[#1255d6] hover:underline">
                  Se connecter
                </button>
              </span>
              <span className="flex-1 h-px bg-[#dbe5f5]" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#3e5788]">
              <span className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#eaf3ff] text-[#1255d6] flex items-center justify-center">
                  <Lock size={15} />
                </span>{" "}
                Vos données sont protégées
              </span>
              <span className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#eaf3ff] text-[#1255d6] flex items-center justify-center">
                  <ShieldCheck size={15} />
                </span>{" "}
                Connexion sécurisée
              </span>
            </div>
          </form>

        </div>

      </div>
    );
  }

  /* ============================ CONNEXION ============================ */
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundImage: LOGIN_BG, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-8">
        <form onSubmit={handleSubmit} className="w-full max-w-[640px] rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur md:p-10 space-y-5">
          <div className="text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#e8f3ff] text-[#1255d6] ring-1 ring-[#bfdafa]">
              <Anchor size={52} strokeWidth={1.7} />
            </div>
            <p className="mt-2 text-sm font-bold tracking-[0.16em] text-[#0b3aa8]">SAINT JUDE</p>
            <p className="text-xs italic text-[#3e5788]">Transport Maritime Antalaha ↔ Toamasina</p>
            <h1 className="mt-4 text-3xl font-extrabold text-[#101b3c]">Bienvenue sur <span className="text-[#1255d6]">Saint Jude</span></h1>
            <p className="text-[#3e5788] mt-2">Gestion du transport maritime de marchandises</p>
          </div>

          <Field id="login" label="E-mail ou téléphone" icon={<Mail size={17} />} labelIcon type="text" value={login} onChange={setLogin} placeholder="exemple@domaine.com ou 034 12 345 67" autoComplete="username" />
          <div>
            <PwdField
              id="password"
              label="Mot de passe"
              labelIcon
              value={password}
              onChange={setPassword}
              placeholder="Entrez votre mot de passe"
              autoComplete="current-password"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />
            <div className="text-right mt-2">
              <button
                type="button"
                className="text-sm text-[#1255d6] hover:underline"
                onClick={() => setInfo("Pour réinitialiser votre mot de passe, contactez l'administrateur de SAINT-JUDE.")}
              >
                Mot de passe oublié ?
              </button>
            </div>
          </div>

          {messages}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl bg-[#1255d6] hover:bg-[#0e45b3] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn size={18} /> {isSubmitting ? "Veuillez patienter…" : "Se connecter"}
          </button>

          <p className="text-center text-sm text-[#3e5788]">
            Pas encore de compte ?{" "}
            <button type="button" onClick={switchMode} className="font-bold text-[#1255d6] hover:underline">
              Créer un compte
            </button>
          </p>

          <div className="border-t border-[#dbe5f5] pt-4 flex items-center justify-center gap-3 text-[#3e5788]">
            <Anchor size={26} className="text-[#1255d6]" />
            <p className="text-sm italic">Saint Jude · Transport Maritime Antalaha ↔ Toamasina</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;