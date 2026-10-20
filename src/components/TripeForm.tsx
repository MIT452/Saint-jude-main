import { FC, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { toast } from "react-toastify";
import {
  Search, Bell, ChevronDown, Calendar, Clock, UserCircle2, Ship, MapPin, Info, Ruler, FileText, RotateCcw, Save, Navigation,
} from "lucide-react";
import { RootState } from "../redux";
import { setTrip } from "../redux/feature/stJude";
import { TABLE_DATA_BASE, Trip } from "../data/type";
import { onAddService } from "../data/service";

interface TripeFormProps {
  onClose?: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const MAX_NOTES = 500;

// Ports proposés (mêmes valeurs qu'avant : Antalaha, Tamatave) avec leurs coordonnées réelles
const PORTS: { name: string; lon: number; lat: number }[] = [
  { name: "Antalaha", lon: 50.28, lat: -14.9 },
  { name: "Tamatave", lon: 49.41, lat: -18.15 },
];

// Contour simplifié de Madagascar (projection lon/lat -> SVG)
const proj = (lon: number, lat: number): [number, number] => [(lon - 43) * 20, (-lat - 11.7) * 20];
const COAST: [number, number][] = [
  [49.27, -12.0], [49.55, -12.5], [49.9, -13.1], [50.1, -13.9], [50.25, -14.6], [50.1, -15.3], [49.85, -15.7],
  [49.75, -16.4], [49.6, -17.0], [49.45, -17.6], [49.42, -18.2], [49.1, -19.0], [48.8, -19.9], [48.5, -20.8],
  [48.3, -21.5], [48.05, -22.2], [47.85, -22.9], [47.6, -23.6], [47.3, -24.4], [47.0, -25.0], [46.3, -25.3],
  [45.15, -25.6], [44.2, -25.2], [43.7, -24.4], [43.65, -23.4], [43.4, -22.4], [43.3, -21.6], [43.7, -20.9],
  [44.3, -20.2], [44.4, -19.4], [44.2, -18.6], [44.0, -18.0], [44.3, -17.2], [45.1, -16.6], [45.6, -15.9],
  [46.3, -15.7], [46.9, -15.3], [47.5, -14.8], [47.9, -14.3], [48.0, -13.6], [48.4, -13.2], [48.8, -12.7],
  [49.0, -12.2], [49.27, -11.95],
];
const MADA_PATH = COAST.map(([lo, la], i) => `${i ? "L" : "M"}${proj(lo, la).map((v) => v.toFixed(1)).join(",")}`).join(" ") + " Z";

const Label = ({ icon, text, required, optional }: { icon: ReactNode; text: string; required?: boolean; optional?: boolean }) => (
  <label className="flex items-center gap-3 text-[15px] font-semibold text-[#0b3aa8] mb-2">
    <span className="text-[#1255d6]">{icon}</span>
    <span>{text}{required && <span className="text-red-500"> *</span>}{optional && <span className="font-normal text-gray-500"> (optionnel)</span>}</span>
  </label>
);
const Hint = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 text-xs text-[#3e5788] mt-2"><Info size={14} className="text-[#1255d6]" /> {text}</p>
);

const box = "flex items-center gap-3 border border-[#d3def2] rounded-lg bg-white px-4 h-12 text-sm text-[#10285e]";
const field = "flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400";

const Select = ({ icon, value, onChange, placeholder, options }: { icon: ReactNode; value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; l: string }[] }) => (
  <div className={`${box} relative`}>
    <span className="text-[#1255d6]">{icon}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${field} appearance-none pr-6 ${value ? "" : "text-gray-400"}`}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.v} value={o.v} className="text-[#10285e]">{o.l}</option>)}
    </select>
    <ChevronDown size={18} className="absolute right-4 text-gray-500 pointer-events-none" />
  </div>
);

const TripeForm: FC<TripeFormProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const boat = useSelector((state: RootState) => state.stJude.boat);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  const [boatId, setBoatId] = useState(boat.length === 1 ? boat[0].id : "");
  const [dDate, setDDate] = useState("");
  const [dTime, setDTime] = useState("");
  const [aDate, setADate] = useState("");
  const [aTime, setATime] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setBoatId(boat.length === 1 ? boat[0].id : "");
    setDDate(""); setDTime(""); setADate(""); setATime("");
    setFrom(""); setTo(""); setDistance(""); setDuration(""); setNotes("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!boatId || !dDate || !dTime || !aDate || !aTime || !from || !to) {
      toast.error("Veuillez renseigner le bateau, les dates, le départ et la destination.");
      return;
    }
    if (from === to) { toast.error("Le départ et la destination doivent être différents."); return; }
    const depart = `${dDate}T${dTime}`;
    const arrive = `${aDate}T${aTime}`;
    if (new Date(arrive).getTime() <= new Date(depart).getTime()) {
      toast.error("La date d'arrivée doit être après la date de départ.");
      return;
    }

    // Champs optionnels envoyés seulement s'ils sont remplis (le backend doit les accepter)
    const trip = {
      id: uuid(),
      arrive,
      boatId,
      depart,
      from,
      status: "Prévu",
      to,
      userId: currentUser ? currentUser.id : "",
      ...(distance.trim() ? { distance: Number(distance) } : {}),
      ...(duration.trim() ? { duration: duration.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    } as Trip;

    setSaving(true);
    try {
      const response = await onAddService(TABLE_DATA_BASE.TRIP, trip);
      if (response === "success") {
        dispatch(setTrip(trip));
        toast.success("Voyage ajouté avec succès !");
        reset();
        onClose?.();
      } else {
        toast.error("Erreur lors de l'ajout du voyage.");
      }
    } catch {
      toast.error("Erreur lors de l'ajout du voyage.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Carte de la route (estimation basée sur les ports choisis)
  const pFrom = PORTS.find((p) => p.name === from);
  const pTo = PORTS.find((p) => p.name === to);
  const route = (() => {
    if (!pFrom || !pTo || pFrom.name === pTo.name) return null;
    const [x1, y1] = proj(pFrom.lon, pFrom.lat);
    const [x2, y2] = proj(pTo.lon, pTo.lat);
    const cx = Math.max(x1, x2) + 14, cy = (y1 + y2) / 2;
    return { x1, y1, x2, y2, cx, cy, mx: 0.25 * x1 + 0.5 * cx + 0.25 * x2, my: 0.25 * y1 + 0.5 * cy + 0.25 * y2 };
  })();

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const portOptions = PORTS.map((p) => ({ v: p.name, l: p.name }));

  return (
    <div className="bg-[#f3f7fd] min-h-full text-[#10285e]">
      {/* Barre du haut */}
      <div className="bg-white border-b border-[#e3eaf6] px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[260px] max-w-[500px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1255d6]" />
          <input placeholder="Rechercher un trajet, un bateau, un port..." className="w-full bg-[#eef3fb] rounded-lg pl-11 pr-3 py-3 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Bell size={22} className="text-[#1255d6]" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><UserCircle2 size={22} /></div>
            <span className="text-sm font-semibold">{currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.name ?? "Administrateur"}</span>
            <ChevronDown size={14} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar size={26} className="text-[#1255d6]" />
            <div className="font-semibold"><p className="capitalize">{dateLabel}</p><p className="font-normal">{pad(now.getHours())}:{pad(now.getMinutes())}</p></div>
          </div>
        </div>
      </div>

      {/* Bandeau titre */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#f4f9ff] via-[#eaf4ff] to-[#cfe3f8]">
        <svg className="absolute right-0 bottom-0 h-full w-[50%] opacity-80" viewBox="0 0 600 100" preserveAspectRatio="none">
          <path d="M0,72 C90,52 180,88 280,66 C380,44 470,82 600,58 L600,100 L0,100 Z" fill="#a9d0f3" />
          <path d="M0,88 C110,68 220,100 320,84 C420,66 520,96 600,80 L600,100 L0,100 Z" fill="#7db8ec" />
        </svg>
        <div className="relative px-8 py-4 flex items-center gap-4">
          <div className="w-[72px] h-[72px] rounded-full bg-[#1d4fb8] text-white flex items-center justify-center shadow-md shrink-0"><Ship size={38} /></div>
          <div className="mr-auto">
            <h1 className="text-3xl font-extrabold text-[#0b3aa8]">Ajouter un trajet</h1>
            <p className="text-base text-[#1d4fb8]">Planifiez un nouveau voyage maritime</p>
          </div>
          <Ship size={70} className="hidden md:block text-[#2f6fb8] mr-16" />
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={onSubmit} className="m-5 bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1px_480px] gap-6">
          {/* Colonne formulaire */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 content-start">
            <div>
              <Label icon={<Ship size={22} />} text="Bateau" required />
              <Select icon={<Ship size={18} />} value={boatId} onChange={setBoatId} placeholder="Sélectionner un bateau..." options={boat.map((b) => ({ v: b.id, l: b.name }))} />
              <Hint text="Choisissez le bateau qui effectuera le trajet." />
            </div>
            <div>
              <Label icon={<Calendar size={22} />} text="Date de départ" required />
              <div className={box}>
                <Calendar size={18} className="text-[#1255d6]" />
                <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} className={field} />
                <Clock size={18} className="text-[#1255d6]" />
                <input type="time" value={dTime} onChange={(e) => setDTime(e.target.value)} className="w-[88px] bg-transparent outline-none text-sm" />
              </div>
              <Hint text="Date et heure de départ du trajet." />
            </div>

            <div>
              <Label icon={<Calendar size={22} />} text="Date d'arrivée" required />
              <div className={box}>
                <Calendar size={18} className="text-[#1255d6]" />
                <input type="date" value={aDate} min={dDate || undefined} onChange={(e) => setADate(e.target.value)} className={field} />
                <Clock size={18} className="text-[#1255d6]" />
                <input type="time" value={aTime} onChange={(e) => setATime(e.target.value)} className="w-[88px] bg-transparent outline-none text-sm" />
              </div>
              <Hint text="Date et heure d'arrivée prévue." />
            </div>
            <div>
              <Label icon={<MapPin size={22} />} text="Départ" required />
              <Select icon={<MapPin size={18} />} value={from} onChange={setFrom} placeholder="Sélectionner un port..." options={portOptions} />
              <Hint text="Port ou lieu de départ." />
            </div>

            <div>
              <Label icon={<MapPin size={22} />} text="Destination" required />
              <Select icon={<MapPin size={18} />} value={to} onChange={setTo} placeholder="Sélectionner un port..." options={portOptions} />
              <Hint text="Port ou lieu d'arrivée." />
            </div>
            <div>
              <Label icon={<Ruler size={22} />} text="Distance (km)" optional />
              <div className="flex">
                <input type="number" min={0} value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Ex : 520" className="flex-1 h-12 border border-[#d3def2] rounded-l-lg px-4 text-sm outline-none focus:border-[#1255d6] placeholder:text-gray-400" />
                <span className="h-12 px-4 flex items-center border border-l-0 border-[#d3def2] rounded-r-lg bg-[#f8fafd] text-sm">km</span>
              </div>
              <Hint text="Distance estimée du trajet en kilomètres." />
            </div>

            <div className="md:col-span-2">
              <Label icon={<Clock size={22} />} text="Durée estimée" optional />
              <div className="flex">
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex : 12h 30min" className="flex-1 h-12 border border-[#d3def2] rounded-l-lg px-4 text-sm outline-none focus:border-[#1255d6] placeholder:text-gray-400" />
                <span className="h-12 px-4 flex items-center border border-l-0 border-[#d3def2] rounded-r-lg bg-[#f8fafd] text-sm">h</span>
              </div>
              <Hint text="Temps de navigation estimé." />
            </div>

            <div className="md:col-span-2">
              <Label icon={<FileText size={22} />} text="Observations / Notes" optional />
              <div className="relative">
                <textarea value={notes} maxLength={MAX_NOTES} onChange={(e) => setNotes(e.target.value)} rows={3}
                  placeholder="Informations supplémentaires sur le trajet, conditions météo, etc..."
                  className="w-full border border-[#d3def2] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#1255d6] placeholder:text-gray-400 resize-none" />
                <span className="absolute right-3 bottom-2 text-[11px] text-gray-500">{notes.length}/{MAX_NOTES}</span>
              </div>
            </div>
          </div>

          <div className="hidden xl:block bg-[#e3eaf6]" />

          {/* Aperçu de la route */}
          <div>
            <h3 className="font-bold text-[#0b3aa8] flex items-center gap-3 mb-3"><Navigation size={20} className="text-[#1255d6]" /> Aperçu de la route</h3>
            <div className="relative rounded-lg overflow-hidden h-[410px] bg-gradient-to-br from-[#8fd0f5] to-[#6bbcf0] border border-[#bcd8f2]">
              <svg viewBox="-30 0 220 290" className="w-full h-full">
                <path d={MADA_PATH} fill="#eaf0e2" stroke="#9db98b" strokeWidth="0.8" strokeLinejoin="round" />
                <text x="62" y="205" fontSize="9" fontWeight="700" fill="#2a3a5c">Madagascar</text>
                <text x="140" y="190" fontSize="8" fontStyle="italic" fill="#2f7fc6">Océan</text>
                <text x="140" y="200" fontSize="8" fontStyle="italic" fill="#2f7fc6">Indien</text>
                {route && (
                  <>
                    <path d={`M${route.x1},${route.y1} Q${route.cx},${route.cy} ${route.x2},${route.y2}`} fill="none" stroke="#1255d6" strokeWidth="1.6" strokeDasharray="4 3" />
                    <circle cx={route.mx} cy={route.my} r="5" fill="#fff" stroke="#1255d6" strokeWidth="1.2" />
                    <text x={route.mx} y={route.my + 3} fontSize="7" textAnchor="middle" fill="#1255d6">⛴</text>
                  </>
                )}
                {[pFrom, pTo].map((p) => {
                  if (!p) return null;
                  const [x, y] = proj(p.lon, p.lat);
                  return (
                    <g key={p.name}>
                      <circle cx={x} cy={y} r="4.5" fill="#e5342f" stroke="#fff" strokeWidth="1.5" />
                      <text x={x + 8} y={y + 3} fontSize="8" fontWeight="700" fill="#0b3aa8" stroke="#fff" strokeWidth="3" style={{ paintOrder: "stroke" }}>{p.name}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute top-3 right-4 flex flex-col items-center text-[#0b3aa8] font-extrabold leading-none">
                <Navigation size={26} /><span className="text-sm mt-1">N</span>
              </div>
            </div>
            <div className="mt-3 flex gap-3 rounded-lg border border-[#c7defa] bg-[#eaf3ff] p-4 text-xs text-[#3e5788]">
              <Info size={18} className="text-[#1255d6] shrink-0" />
              <p>Cet aperçu de la route est une estimation basée sur les ports sélectionnés. Il ne représente pas une position GPS en temps réel.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e3eaf6] mt-6 pt-6 grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-6">
          <button type="button" onClick={reset} className="h-12 rounded-lg border border-[#9db8ea] text-[#1255d6] font-semibold flex items-center justify-center gap-2 hover:bg-blue-50">
            <RotateCcw size={18} /> Réinitialiser
          </button>
          <button type="submit" disabled={saving} className="h-12 rounded-lg bg-[#1255d6] hover:bg-[#0e45b3] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            <Save size={18} /> {saving ? "Enregistrement..." : "Enregistrer le trajet"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TripeForm;