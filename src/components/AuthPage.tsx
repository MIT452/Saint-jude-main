import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../redux";
import { setCurrentUser } from "../redux/feature/users";
import {
  Anchor, ArrowRight, Bell, Bot, CalendarDays, Check, Eye, EyeOff, Lock, LogIn, Mail, MapPin, Phone,
  Ship, ShieldCheck, User, UserPlus,
} from "lucide-react";
import { loginUser, registerUser } from "../data/service";

/* =====================================================================
   PHOTOS DES PAGES CONNEXION / INSCRIPTION
   ---------------------------------------------------------------------
   Placez vos photos dans le dossier :  public/images/
   Puis, si besoin, changez uniquement les noms de fichiers ci-dessous
   (par exemple "login-bg.png" si votre photo est un PNG).

     LOGIN_PHOTO     -> fond de la page de CONNEXION (mer, bateau, montagne)
     REGISTER_PHOTO  -> bandeau du haut de la page d'INSCRIPTION (bateau sur la mer)
     AINA_PHOTO      -> portrait de l'assistante « Aina » (page d'INSCRIPTION, à droite)

   Les photos doivent être SANS texte (le logo et les slogans sont dans le code).
   Si un fichier est absent, un dégradé bleu maritime s'affiche à la place.
===================================================================== */
const LOGIN_PHOTO = "login-bg.jpg";
const REGISTER_PHOTO = "register-banner.jpg";
const AINA_PHOTO = "aina.jpg";

const BASE = (import.meta.env.BASE_URL as string | undefined) ?? "/";
const photoUrl = (file: string) => `url(${BASE}images/${file})`;

const SEA = "linear-gradient(160deg,#1f74d6 0%,#3b8fe0 40%,#0d4aa8 100%)";
const LOGIN_BG = `${photoUrl(LOGIN_PHOTO)}, ${SEA}`;
const BANNER_BG = `${photoUrl(REGISTER_PHOTO)}, ${SEA}`;
const AINA_BG = `${photoUrl(AINA_PHOTO)}, linear-gradient(160deg,#6fb4f2 0%,#2f86dd 100%)`;

const RULES: Array<[string, (p: string) => boolean]> = [
  ["Au moins 8 caractères", (p) => p.length >= 8],
  ["Une lettre majuscule", (p) => /[A-Z]/.test(p)],
  ["Une lettre minuscule", (p) => /[a-z]/.test(p)],
  ["Un chiffre", (p) => /\d/.test(p)],
  ["Un caractère spécial", (p) => /[^A-Za-z0-9]/.test(p)],
];
const isStrong = (p: string) => RULES.every(([, ok]) => ok(p));

const script = { fontFamily: "'Brush Script MT','Segoe Script',cursive" } as const;

/* ---------- Petits composants (hors de AuthPage pour ne pas perdre le focus à chaque frappe) ---------- */
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

const Tagline = () => (
  <div className="text-white/95" style={script}>
    <p className="text-2xl md:text-3xl -rotate-6 leading-snug">
      Plus qu'un transport,
      <br />
      <span className="ml-8">une connexion</span>
      <Anchor size={26} className="inline-block ml-2 rotate-6" />
    </p>
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

const BENEFITS: Array<[ReactNode, string, string]> = [
  [<Ship size={26} key="a" />, "Réserver facilement", "Accédez aux disponibilités et réservez vos voyages."],
  [<CalendarDays size={26} key="b" />, "Suivre vos réservations", "Consultez l'état de vos réservations en temps réel."],
  [<Bell size={26} key="c" />, "Recevoir des notifications", "Soyez informé par e-mail ou WhatsApp des mises à jour importantes."],
  [<Bot size={26} key="d" />, "Assistant IA", "Posez vos questions et obtenez des réponses rapides."],
  [<ShieldCheck size={26} key="e" />, "Sécurité renforcée", "Votre compte est protégé et vos données restent privées."],
];

/* ====================================================================== */
const AuthPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tel, setTel] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    }

    setIsSubmitting(true);
    try {
      const user = isRegistering
        ? await registerUser({ name, lastName, email: login, tel, password })
        : await loginUser({ email: login, password });
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
      <div className="min-h-screen bg-gradient-to-b from-[#eaf4ff] to-[#d9eafc] flex flex-col">
        {/* Bandeau du haut (photo : REGISTER_PHOTO) */}
        <div className="relative h-[230px] md:h-[260px] overflow-hidden" style={{ backgroundImage: BANNER_BG, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d4aa8]/40 to-transparent" />
          <div className="relative max-w-6xl mx-auto px-6 pt-8 flex items-start justify-between gap-4">
            <Logo />
            <div className="hidden md:block pt-2"><Tagline /></div>
          </div>
        </div>

        <div className="relative max-w-6xl w-full mx-auto px-4 md:px-6 -mt-16 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 pb-10 flex-1">
          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-[#dbe5f5] p-6 md:p-8 space-y-5">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-[#1255d6] text-white flex items-center justify-center shadow-md -mt-14 md:-mt-16 mb-3 ring-4 ring-white">
                <UserPlus size={30} />
              </div>
              <h1 className="text-3xl font-extrabold text-[#0b3aa8]">Créer un compte</h1>
              <p className="text-[#3e5788] mt-2">Rejoignez SAINT-JUDE et accédez à vos réservations en toute sécurité.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="name" label="Prénom" icon={<User size={17} />} value={name} onChange={setName} placeholder="Votre prénom" autoComplete="given-name" />
              <Field id="lastName" label="Nom" icon={<User size={17} />} value={lastName} onChange={setLastName} placeholder="Votre nom" autoComplete="family-name" />
            </div>
            <Field id="email" label="Adresse e-mail" icon={<Mail size={17} />} type="email" value={login} onChange={setLogin} placeholder="exemple@domaine.com" autoComplete="email" />
            <Field id="tel" label="Téléphone" icon={<Phone size={17} />} type="tel" value={tel} onChange={setTel} placeholder="+261 34 12 34 567" autoComplete="tel" />
            <PwdField id="password" label="Mot de passe" value={password} onChange={setPassword} placeholder="Votre mot de passe" autoComplete="new-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
            <PwdField id="confirmPassword" label="Confirmer le mot de passe" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirmez votre mot de passe" autoComplete="new-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} />

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

            <button type="submit" disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-[#1255d6] hover:bg-[#0e45b3] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <UserPlus size={18} /> {isSubmitting ? "Veuillez patienter…" : "Créer mon compte"} {!isSubmitting && <ArrowRight size={18} />}
            </button>

            <div className="flex items-center gap-3 text-sm text-[#3e5788]">
              <span className="flex-1 h-px bg-[#dbe5f5]" />
              <span>Déjà inscrit ? <button type="button" onClick={switchMode} className="font-bold text-[#1255d6] hover:underline">Se connecter</button></span>
              <span className="flex-1 h-px bg-[#dbe5f5]" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#3e5788]">
              <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-[#eaf3ff] text-[#1255d6] flex items-center justify-center"><Lock size={15} /></span> Vos données sont protégées</span>
              <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-[#eaf3ff] text-[#1255d6] flex items-center justify-center"><ShieldCheck size={15} /></span> Connexion sécurisée</span>
            </div>
          </form>

          {/* Colonne droite */}
          <div className="space-y-4">
            {/* Portrait d'Aina (photo : AINA_PHOTO) */}
            <div className="relative h-[260px] rounded-2xl overflow-hidden shadow-lg" style={{ backgroundImage: AINA_BG, backgroundSize: "cover", backgroundPosition: "center top" }}>
              <div className="absolute right-4 top-6 max-w-[55%] text-white text-xl -rotate-6 drop-shadow-md" style={script}>
                Je suis Aina, votre assistant IA. Je suis là pour vous aider !
              </div>
            </div>

            <div className="bg-white/80 rounded-2xl border border-[#dbe5f5] shadow-sm p-6">
              <h2 className="text-xl font-bold text-[#0b3aa8] mb-4">Pourquoi créer un compte ?</h2>
              <ul className="divide-y divide-[#e3eaf6]">
                {BENEFITS.map(([icon, title, text]) => (
                  <li key={title} className="flex items-start gap-4 py-3.5">
                    <span className="w-14 h-14 rounded-full bg-[#dcebfb] text-[#1255d6] flex items-center justify-center shrink-0">{icon}</span>
                    <div>
                      <p className="font-semibold text-[#0b3aa8]">{title}</p>
                      <p className="text-sm text-[#3e5788]">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-right text-[#1255d6] text-xl -rotate-3" style={script}>
                Ensemble vers de « nouveaux horizons » <Anchor size={22} className="inline-block ml-1" />
              </p>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="bg-gradient-to-r from-[#0d4aa8] to-[#1255d6] text-white text-sm py-4 text-center">
          <Ship size={22} className="inline-block mr-2 -mt-1" />
          SAINT-JUDE <span className="mx-2">—</span> Transport Maritime Antalaha ↔ Toamasina
        </div>
      </div>
    );
  }

  /* ============================ CONNEXION ============================ */
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundImage: LOGIN_BG, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute top-8 left-8 md:left-14"><Logo /></div>
      <div className="hidden lg:block absolute top-44 left-24"><Tagline /></div>
      <Anchor size={72} className="hidden md:block absolute top-8 right-10 text-white/35 rotate-12" />
      <div className="hidden md:flex absolute bottom-8 left-8 md:left-14 items-start gap-2 text-white">
        <MapPin size={22} className="mt-0.5" />
        <div className="leading-tight">
          <p className="font-semibold">Saint-Jude — Madagascar</p>
          <p className="text-xs">Relier les îles, rapprocher les hommes</p>
        </div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center lg:justify-end px-4 pt-28 pb-10 lg:pt-0 lg:pr-[7%]">
        <form onSubmit={handleSubmit} className="w-full max-w-[560px] bg-white/95 rounded-2xl shadow-2xl p-7 md:p-10 space-y-5">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-[#dcebfb] text-[#1255d6] flex items-center justify-center">
              <Ship size={38} />
            </div>
            <h1 className="mt-4 text-3xl font-extrabold text-[#0b3aa8]">Bienvenue sur SAINT-JUDE</h1>
            <p className="text-[#3e5788] mt-2">Gestion du transport maritime de marchandises</p>
          </div>

          <Field id="email" label="Adresse e-mail" icon={<Mail size={17} />} labelIcon type="email" value={login} onChange={setLogin} placeholder="Entrez votre adresse e-mail" autoComplete="email" />
          <div>
            <PwdField id="password" label="Mot de passe" labelIcon value={password} onChange={setPassword} placeholder="Entrez votre mot de passe" autoComplete="current-password" show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
            <div className="text-right mt-2">
              <button type="button" className="text-sm text-[#1255d6] hover:underline"
                onClick={() => setInfo("Pour réinitialiser votre mot de passe, contactez l'administrateur de SAINT-JUDE.")}>
                Mot de passe oublié ?
              </button>
            </div>
          </div>

          {messages}

          <button type="submit" disabled={isSubmitting}
            className="w-full h-12 rounded-xl bg-[#1255d6] hover:bg-[#0e45b3] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            <LogIn size={18} /> {isSubmitting ? "Veuillez patienter…" : "Se connecter"}
          </button>

          <p className="text-center text-sm text-[#3e5788]">
            Pas encore de compte ? <button type="button" onClick={switchMode} className="font-bold text-[#1255d6] hover:underline">Créer un compte</button>
          </p>

          <div className="border-t border-[#dbe5f5] pt-4 flex items-center justify-center gap-3 text-[#3e5788]">
            <ShieldCheck size={30} className="text-[#1255d6]" />
            <div className="leading-tight">
              <p className="text-sm font-medium">Connexion sécurisée et protégée</p>
              <p className="text-xs">Vos données sont chiffrées et en sécurité.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;