import { FC, FormEvent, useState } from "react";
import { InputField } from "./tools/InputField";
import { CashMovement, TABLE_DATA_BASE } from "../data/type";
import { cashMouvementVoid } from "../data/dataVoid";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { v4 as uuid } from 'uuid';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../redux";
import { Card } from "./ui/card";
import { setCashMouvement } from "../redux/feature/stJude";
import { onAddService } from "../data/service";
import { toast } from "react-toastify";

interface PropsCashForm {
  onClose: () => void;
}

const CashMouvementForm: FC<PropsCashForm> = ({ onClose }) => {
  const [cashMouvement, setCurrentCashMouvement] = useState<CashMovement>(cashMouvementVoid);

  const dispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const trips = useSelector((state: RootState) => state.stJude.trip);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const finalCashMouvement: CashMovement = {
      ...cashMouvement,
      id: uuid(),
      date: new Date().toISOString(),
      userId: currentUser?.id ? currentUser.id : "",
      debit: cashMouvement.type === "debit" ? cashMouvement.debit : 0,
      credit: cashMouvement.type === "credit" ? cashMouvement.credit : 0,
    };
    const responce = await onAddService(TABLE_DATA_BASE.CASHMOVEMENT, finalCashMouvement);
    if (responce === "success") {
      toast.success("Mouvement de caisse ajouté avec succès !");
      dispatch(setCashMouvement(finalCashMouvement));
      onClose();
    } else {
      toast.error("Erreur lors de l'ajout du mouvement de caisse.");
    }
  };

  const handleInput = (field: keyof CashMovement, value: string | number) => {
    setCurrentCashMouvement((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>
      <Card className="relative z-50 flex flex-col bg-white p-6 w-[50%] rounded-xl shadow-lg">
        <form className="flex flex-col gap-4" onSubmit={onAdd}>
          <div className="flex flex-col gap-2">
            <Label>Type de Mouvement</Label>
            <Select value={cashMouvement.type} onValueChange={(v) => handleInput("type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Débit</SelectItem>
                <SelectItem value="credit">Crédit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <InputField label="Désignation" value={cashMouvement.designation} onChange={(v) => handleInput("designation", v)} />

          {cashMouvement.type === "debit" ? (
            <InputField label="Montant Débit" type="number" value={cashMouvement.debit || ""}
              onChange={(v) => handleInput("debit", Number(v))}
            />
          ) : (
            <InputField label="Montant Crédit" type="number" value={cashMouvement.credit || ""}
              onChange={(v) => handleInput("credit", Number(v))}
            />
          )}
          <div className="flex flex-col gap-2">
            <Label>En relation avec le voyage du</Label>
            <Select onValueChange={(v) => handleInput('tripId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>{`${trip.from} → ${trip.to} ( ${new Date(trip.depart).toLocaleString('fr-Fr', {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })} )`}
                  </SelectItem>
                ))}
                <SelectItem value="a">Aucun</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </Card>
    </div>

  );
};

export default CashMouvementForm;
