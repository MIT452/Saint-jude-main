import { FC, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Ship, X, Gauge, User, Settings, ClipboardList, FileText, Route } from "lucide-react";
import { RootState } from "../redux";
import { Boat } from "../data/type";

interface BoatModalProps {
  currentBoat: Boat;
  onClose: () => void;
}

const nf = (n: number) => n.toLocaleString("fr-FR");

// Couleur du point d'état (même logique que BoatForm)
const dotColor = (s: string) =>
  s === "Disponible" || s === "En service"
    ? "bg-[#1fae6a]"
    : s === "En maintenance" || s === "En construction"
      ? "bg-[#f59e0b]"
      : s === ""
        ? "bg-gray-300"
        : "bg-[#e5342f]";

const formaterDate = (valeur?: string): string => {
  if (!valeur) return "—";
  const d = new Date(valeur);
  return Number.isNaN(d.getTime())
    ? valeur
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const Ligne: FC<{ icone: ReactNode; titre: string; children: ReactNode }> = ({ icone, titre, children }) => (
  <div className="flex items-start gap-3 rounded-lg border border-[#dbe5f5] bg-white p-3">
    <span className="mt-0.5 text-[#1255d6]">{icone}</span>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-[#3e5788]">{titre}</p>
      <div className="text-sm font-medium text-[#10285e] break-words">{children}</div>
    </div>
  </div>
);

const BoatModal: FC<BoatModalProps> = ({ currentBoat, onClose }) => {
  const allUser = useSelector((state: RootState) => state.users.allUser);
  const trips = useSelector((state: RootState) => state.stJude.trip);

  // Échap ferme la fenêtre
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onClose]);

  const capitaine = allUser.find(({ id }) => currentBoat.crew?.includes(id));
  const description = (currentBoat as Boat & { description?: string }).description;

  // Trajets réellement effectués ou prévus par ce bateau, du plus récent au plus ancien
  const trajets = useMemo(
    () =>
      trips
        .filter((t) => t.boatId === currentBoat.id)
        .sort((a, b) => String(b.depart).localeCompare(String(a.depart))),
    [trips, currentBoat.id],
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Détails du bateau ${currentBoat.name}`}
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-6 w-full max-w-[720px] overflow-hidden rounded-xl bg-[#f3f7fd] text-[#10285e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          title="Fermer"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1255d6] shadow hover:bg-white"
        >
          <X size={18} />
        </button>

        {currentBoat.image ? (
          <img src={currentBoat.image} alt={String(currentBoat.name)} className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gradient-to-b from-sky-500 via-blue-700 to-blue-950 text-white">
            <Ship size={64} className="opacity-40" />
          </div>
        )}

        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-2xl font-extrabold text-[#0b3aa8]">{currentBoat.name}</h2>
            <p className="text-sm text-[#2a4f95]">Matricule {currentBoat.id}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Ligne icone={<ClipboardList size={18} />} titre="Matricule">{currentBoat.id}</Ligne>
            <Ligne icone={<Gauge size={18} />} titre="Capacité">{nf(Number(currentBoat.capacity) || 0)} T</Ligne>
            <Ligne icone={<Settings size={18} />} titre="État">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dotColor(String(currentBoat.state))}`} />
                {currentBoat.state}
              </span>
            </Ligne>
            <Ligne icone={<User size={18} />} titre="Capitaine">
              {capitaine ? `${capitaine.name} ${capitaine.lastName}` : "Non renseigné"}
            </Ligne>
          </div>

          {description && (
            <Ligne icone={<FileText size={18} />} titre="Description / Remarques">{description}</Ligne>
          )}

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0b3aa8]">
              <Route size={18} /> Trajets de ce bateau ({trajets.length})
            </p>
            {trajets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#c5d5ef] bg-white p-3 text-sm text-gray-500">
                Aucun trajet enregistré pour ce bateau.
              </p>
            ) : (
              <ul className="divide-y divide-[#e3eaf6] overflow-hidden rounded-lg border border-[#dbe5f5] bg-white text-sm">
                {trajets.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-medium">{t.from} → {t.to}</span>
                    <span className="whitespace-nowrap text-xs text-gray-500">{formaterDate(t.depart)} · {String(t.status)}</span>
                  </li>
                ))}
              </ul>
            )}
            {trajets.length > 5 && (
              <p className="mt-1 text-xs text-gray-500">{trajets.length - 5} autre(s) trajet(s) non affiché(s).</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg bg-[#1255d6] px-6 text-sm font-semibold text-white hover:bg-[#0e45b3]"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoatModal;