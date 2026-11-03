import type { FC } from "react";
import { X, Ship } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../redux";
import type { Boat } from "../data/type";

interface BoatModalProps {
  currentBoat: Boat;
  onClose: () => void;
}

const BoatModal: FC<BoatModalProps> = ({ currentBoat, onClose }) => {
  const allUsers = useSelector((state: RootState) => state.users.allUser);
  const captains = (currentBoat.crew ?? [])
    .map((captainId) => allUsers.find((user) => user.id === captainId))
    .filter((captain) => captain !== undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="boat-modal-title"
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Ship size={21} /></span>
            <div>
              <h2 id="boat-modal-title" className="font-semibold text-slate-900">Détails du bateau</h2>
              <p className="text-xs text-slate-500">{currentBoat.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" title="Fermer" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-[180px_1fr]">
          {currentBoat.image ? (
            <img src={currentBoat.image} alt={currentBoat.name} className="h-40 w-full rounded-lg border bg-slate-50 object-cover" />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border bg-slate-50 text-slate-400"><Ship size={42} /></div>
          )}
          <dl className="grid content-start gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Nom</dt><dd className="font-medium text-slate-900">{currentBoat.name}</dd></div>
            <div><dt className="text-xs text-slate-500">Capacité</dt><dd className="font-medium text-slate-900">{Number(currentBoat.capacity).toLocaleString("fr-FR")} T</dd></div>
            <div><dt className="text-xs text-slate-500">État</dt><dd className="font-medium text-slate-900">{currentBoat.state || "Non renseigné"}</dd></div>
            <div>
              <dt className="text-xs text-slate-500">Capitaine(s)</dt>
              <dd className="font-medium text-slate-900">
                {captains.length ? captains.map((captain) => `${captain.name} ${captain.lastName}`).join(", ") : "Aucun capitaine assigné"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
};

export default BoatModal;