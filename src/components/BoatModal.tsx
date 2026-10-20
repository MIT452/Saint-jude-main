import { FC, useRef, useState } from "react";
import type { DragEvent, ChangeEvent, FormEvent, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  Search, Bell, ChevronDown, Calendar, UserCircle2, Ship, ClipboardList, Weight, Image as ImageIcon, Settings, User,
  FileText, UploadCloud, X, RotateCcw, Save,
} from "lucide-react";
import { RootState } from "../redux";
import { Boat, TABLE_DATA_BASE } from "../data/type";
import { setBoat as setBoats } from "../redux/feature/stJude";
import * as service from "../data/service";

const pad = (n: number) => String(n).padStart(2, "0");
const STATES = ["En construction", "En service", "En maintenance", "En panne", "Désarmé", "Hors service"];
const dotColor = (s: string) => (s === "En service" ? "bg-[#1fae6a]" : s === "En maintenance" || s === "En construction" ? "bg-[#f59e0b]" : s === "" ? "bg-gray-300" : "bg-[#e5342f]");
const MAX_MB = 5;

const Label = ({ icon, text, required }: { icon: ReactNode; text: string; required?: boolean }) => (
  <label className="flex items-center gap-3 text-[15px] font-semibold text-[#0b3aa8] mb-2">
    <span className="text-[#1255d6]">{icon}</span>
    <span>{text}{required && <span className="text-red-500"> *</span>}</span>
  </label>
);

const BoatForm: FC = () => {
  const dispatch = useDispatch();
  const { allUser, currentUser } = useSelector((state: RootState) => state.users);
  const capitaines = allUser.filter(({ role }) => role === "Capitaine");

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [state, setState] = useState("En service");
  const [captain, setCaptain] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpe?g|png)$/i.test(f.type)) { toast.error("Format accepté : JPG ou PNG."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Image trop lourde (max ${MAX_MB} Mo).`); return; }
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(f);
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { readFile(e.target.files?.[0]); e.target.value = ""; };
  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); };

  const reset = () => { setId(""); setName(""); setCapacity(""); setImage(undefined); setState("En service"); setCaptain(""); setDescription(""); };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !name.trim() || !(Number(capacity) > 0)) {
      toast.error("Veuillez renseigner le matricule, le nom et la capacité.");
      return;
    }
    if (capitaines.length > 0 && !captain) {
      toast.error("Veuillez choisir un capitaine.");
      return;
    }
    // Fonction d'ajout du service (même fichier que onUpdateService)
    const create: any = (service as any).onPostService ?? (service as any).onAddService ?? (service as any).onCreateService ?? (service as any).onSaveService;
    if (!create) { toast.error("Service d'ajout introuvable (data/service)."); return; }

    const newBoat = {
      id: id.trim(),
      name: name.trim(),
      capacity: Number(capacity),
      state,
      crew: captain ? [captain] : [],
      image,
      ...(description.trim() ? { description: description.trim() } : {}),
      userId: currentUser ? currentUser.id : "",
    } as Boat;

    setSaving(true);
    try {
      const response = await create(TABLE_DATA_BASE.BOAT, newBoat);
      if (response === "success") {
        dispatch(setBoats(newBoat));
        toast.success("Bateau ajouté avec succès !");
        reset();
      } else {
        toast.error("Erreur lors de l'ajout du bateau.");
      }
    } catch {
      toast.error("Erreur lors de l'ajout du bateau.");
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const input = "w-full h-12 border border-[#d3def2] rounded-lg bg-white px-4 text-sm text-[#10285e] placeholder:text-gray-400 outline-none focus:border-[#1255d6]";

  return (
    <div className="bg-[#f3f7fd] min-h-full text-[#10285e]">
      {/* Barre du haut */}
      <div className="bg-white border-b border-[#e3eaf6] px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[260px] max-w-[500px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1255d6]" />
          <input placeholder="Rechercher un bateau, un numéro, une capacité..." className="w-full bg-[#eef3fb] rounded-lg pl-11 pr-3 py-3 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Bell size={22} className="text-[#1255d6]" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><UserCircle2 size={22} /></div>
            <span className="text-sm text-[#1255d6]">{currentUser?.role === "Propriétaire" ? "Administrateur" : currentUser?.name ?? "Administrateur"}</span>
            <ChevronDown size={14} />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Calendar size={26} className="text-[#1255d6]" />
            <div><p className="capitalize">{dateLabel}</p><p>{pad(now.getHours())}:{pad(now.getMinutes())}</p></div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Bandeau titre */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#f1f7ff] via-[#e6f1fd] to-[#cfe3f8]">
          <svg className="absolute right-0 bottom-0 h-full w-[55%] opacity-70" viewBox="0 0 600 100" preserveAspectRatio="none">
            <path d="M0,70 C80,45 170,95 270,68 C370,40 450,85 600,52 L600,100 L0,100 Z" fill="#b9d8f5" />
            <path d="M0,86 C100,62 210,100 310,82 C410,62 510,96 600,78 L600,100 L0,100 Z" fill="#8fc0ee" />
          </svg>
          <div className="relative px-6 py-5 flex items-center gap-5">
            <div className="w-[100px] h-[100px] rounded-full bg-[#0b3aa8] text-white flex items-center justify-center shrink-0 shadow-lg"><Ship size={52} /></div>
            <div className="mr-auto">
              <h1 className="text-4xl font-extrabold text-[#0b3aa8]">Ajouter un bateau</h1>
              <p className="text-lg text-[#2a4f95]">Enregistrez un nouveau bateau dans le système</p>
            </div>
            <Ship size={84} className="hidden md:block text-[#2f6fb8] mr-10" />
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={onSubmit} className="bg-white rounded-xl border border-[#dbe5f5] shadow-sm p-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="md:pl-4">
              <Label icon={<ClipboardList size={22} />} text="Matricule" required />
              <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Ex : MA-1234TA" className={input} />
            </div>
            <div>
              <Label icon={<Ship size={22} />} text="Nom" required />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : St Jude" className={input} />
            </div>

            <div className="md:pl-4">
              <Label icon={<Weight size={22} />} text="Capacité en tonnage (T)" required />
              <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Ex : 5000" className={input} />
            </div>
            <div>
              <Label icon={<ImageIcon size={22} />} text="Image du bateau" />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                  className={`min-h-[136px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer px-4 ${drag ? "border-[#1255d6] bg-[#e6f0ff]" : "border-[#8fb3ee] bg-[#f3f8ff]"}`}
                >
                  <UploadCloud size={30} className="text-[#1255d6] mb-2" />
                  <p className="text-sm text-[#2a4f95]">Glissez une image ici ou cliquez pour parcourir</p>
                  <p className="text-xs text-gray-500 mt-2">Formats acceptés : JPG, PNG (Max {MAX_MB} Mo)</p>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={onFile} className="hidden" />
                </div>
                {image && (
                  <div className="relative rounded-lg border border-[#d3def2] overflow-hidden bg-white">
                    <img src={image} alt="Aperçu" className="w-full h-[96px] object-cover" />
                    <button type="button" onClick={() => setImage(undefined)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#1255d6] text-white flex items-center justify-center"><X size={14} /></button>
                    <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-[#1255d6] py-2"><ImageIcon size={16} /> Changer l'image</button>
                  </div>
                )}
              </div>
            </div>

            <div className="md:pl-4">
              <Label icon={<Settings size={22} />} text="État du bateau" required />
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${dotColor(state)}`} />
                <select value={state} onChange={(e) => setState(e.target.value)} className={`${input} appearance-none pl-11 pr-10`}>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <Label icon={<User size={22} />} text="Capitaine" required />
              <div className="relative">
                <select value={captain} onChange={(e) => setCaptain(e.target.value)} className={`${input} appearance-none pr-10 ${captain ? "" : "text-gray-400"}`}>
                  <option value="">Choisir un capitaine...</option>
                  {capitaines.map((c) => <option key={c.id} value={c.id} className="text-[#10285e]">{`${c.name} ${c.lastName}`}</option>)}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="mt-6 md:pl-4">
            <Label icon={<FileText size={22} />} text="Description / Remarques" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Informations supplémentaires sur le bateau (type, équipements, etc.)..."
              className="w-full border border-[#d3def2] rounded-lg bg-white px-4 py-3 text-sm placeholder:text-gray-400 outline-none focus:border-[#1255d6] resize-y" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <button type="button" onClick={reset} className="h-12 rounded-lg border border-[#9db8ea] text-[#1255d6] font-semibold flex items-center justify-center gap-2 hover:bg-blue-50">
              <RotateCcw size={18} /> Réinitialiser
            </button>
            <button type="submit" disabled={saving} className="h-12 rounded-lg bg-[#1255d6] hover:bg-[#0e45b3] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={18} /> {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BoatForm;