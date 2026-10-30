import { FC, FormEvent, useState } from "react";
import { InputField } from "./tools/InputField";
import { FuelConsumption } from "../data/type";
import { fuelVoid } from "../data/dataVoid";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../redux";
import { findBoat } from "../Tools/Tools";
import { setCashMouvement, setFuelConsumption } from "../redux/feature/stJude";
import { onRefuelService } from "../data/service";
import { toast } from "react-toastify";

interface PropsFuelConsumption {
  onClose: () => void;
}

const FUEL_TYPES = ["Gasoil", "Essence"];

const inputFields = [
  { key: "fuelPrice", label: "Prix unitaire du carburant (Litre)", type: "number" },
  { key: "quantity", label: "Quantité", type: "number" },
];

const CashFuelConsumption: FC<PropsFuelConsumption> = ({ onClose }) => {
  const [fuelConsumption, setFuelConsumptions] = useState<FuelConsumption>({
    ...fuelVoid,
    fuelType: fuelVoid.fuelType || FUEL_TYPES[0],
  });
  const [submitting, setSubmitting] = useState(false);

  const { trip: trips, boat: allBoat } = useSelector((state: RootState) => state.stJude);
  const dispatch = useDispatch();

  const now = new Date();
  const futureTrips = trips.filter((trip) => new Date(trip.depart) > now);

  // Le coût total est dérivé : plus d'état ni d'effet à synchroniser
  const cost = (Number(fuelConsumption.fuelPrice) || 0) * (Number(fuelConsumption.quantity) || 0);

  const handleInput = (field: keyof FuelConsumption, value: string) => {
    setFuelConsumptions((prev) => ({ ...prev, [field]: value }));
  };

  // Un seul appel serveur : le plein ET le mouvement de caisse sont enregistrés dans la même
  // transaction, ou aucun des deux.
  const onAddCashFuelConsumption = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const quantity = Number(fuelConsumption.quantity);
    const fuelPrice = Number(fuelConsumption.fuelPrice);
    if (!fuelConsumption.tripId) return void toast.error("Veuillez sélectionner un voyage.");
    if (!(quantity > 0)) return void toast.error("La quantité doit être supérieure à 0.");
    if (!(fuelPrice > 0)) return void toast.error("Le prix par litre doit être supérieur à 0.");

    const payload = { tripId: fuelConsumption.tripId, quantity, fuelPrice, fuelType: fuelConsumption.fuelType };

    setSubmitting(true);
    let result = await onRefuelService(payload);

    // Valeurs inhabituelles : on demande confirmation, puis on renvoie la même requête confirmée
    if (result.status === "needs-confirmation") {
      const warnings = (result.warnings ?? []).map((w) => `• ${w}`).join("\n");
      if (!window.confirm(`Vérifiez ce plein :\n\n${warnings}\n\nEnregistrer quand même ?`)) {
        setSubmitting(false);
        return;
      }
      result = await onRefuelService({ ...payload, confirm: true });
    }
    setSubmitting(false);

    if (result.status === "success" && result.fuel && result.cashMovement) {
      dispatch(setFuelConsumption(result.fuel));
      dispatch(setCashMouvement(result.cashMovement));
      toast.success("Plein enregistré et mouvement de caisse créé.");
      onClose();
    } else {
      toast.error(result.message ?? "Erreur lors de l'ajout du plein, veuillez réessayer.");
    }
  };

  return (
    <div className="flex items-center justify-center inset-0 fixed z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="relative z-50 bg-white p-6 rounded-lg shadow-lg w-[50%]">
        <h2 className="text-xl font-semibold mb-4">Gestion de carburant</h2>
        <form className="flex flex-col gap-2" onSubmit={onAddCashFuelConsumption}>
          <div className="flex flex-col gap-2">
            <Label>Voyage du </Label>
            <Select onValueChange={(v) => handleInput("tripId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {futureTrips.map((trip) => {
                  const boat = findBoat(trip.boatId, allBoat);
                  return (
                    <SelectItem key={trip.id} value={trip.id}>
                      {`${trip.from} → ${trip.to} ( ${new Date(trip.depart).toLocaleString("fr-Fr", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })} avec ${boat.name} ) `}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Type de carburant</Label>
            <Select value={fuelConsumption.fuelType} onValueChange={(v) => handleInput("fuelType", v)}>
              <SelectTrigger>
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {FUEL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {inputFields.map((inputField) => (
            <InputField
              label={inputField.label}
              type={inputField.type}
              value={fuelConsumption[inputField.key as keyof typeof fuelConsumption]}
              key={inputField.key}
              onChange={(v) => handleInput(inputField.key as keyof FuelConsumption, v)}
            ></InputField>
          ))}
          <InputField label="Coût Total" value={cost} readOnly />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Ajouter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default CashFuelConsumption;