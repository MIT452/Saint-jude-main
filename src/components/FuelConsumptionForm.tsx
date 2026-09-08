import { FC, FormEvent, useEffect, useState } from "react";
import { InputField } from "./tools/InputField";
import { CashMovement, FuelConsumption, TABLE_DATA_BASE } from "../data/type";
import { fuelVoid } from "../data/dataVoid";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../redux";
import { findBoat } from "../Tools/Tools";
import { setCashMouvement, setFuelConsumption } from "../redux/feature/stJude";
import { v4 as uuid } from 'uuid';
import { onAddService } from "../data/service";
import { toast } from "react-toastify";

interface PropsFuelConsumption {
  onClose: () => void;
}
const inputFields = [
  { key: "fuelPrice", label: "Prix unitaire du carburant (Litre)", type: "number", required: false, placeHolder: " Ex : 5000" },
  { key: "quantity", label: "Quantité", type: "number", required: false, placeHolder: 'Ex : 200' },
]
const CashFuelConsumption: FC<PropsFuelConsumption> = ({ onClose }) => {
  const [fuelConsumption, setFuelConsumptions] = useState<FuelConsumption>(fuelVoid);

  const {trip : trips ,boat : allBoat} = useSelector((state: RootState) => state.stJude);
  const currentUser = useSelector((state : RootState)=> state.users.currentUser);

  const dispatch = useDispatch();

  const now = new Date();
  const futureTrips = trips.filter((trip) => new Date(trip.depart) > now);
  const onAddCashFuelConsumption = async (e: FormEvent) => {
    e.preventDefault();
    let curentFuelConsumption: FuelConsumption = {
      ...fuelConsumption, createdAt: new Date().toISOString(), id: uuid(), userId : currentUser ? currentUser.id : ''
    }
    const cashMouvement : CashMovement = {
      credit : 0,
      date : new Date().toISOString(),
      debit : fuelConsumption.cost,
      designation : "Achat du carburnant",
      id : uuid(),
      type : "debit",
      userId : currentUser ? currentUser.id : ''
    } 
    const response = await onAddService(TABLE_DATA_BASE.FUELCONSUMPTION, curentFuelConsumption);
    if(response === "success"){
      dispatch(setFuelConsumption(curentFuelConsumption));
      dispatch(setCashMouvement(cashMouvement));
      onClose()
      toast.success("Consommation de carburant ajouté avec succès !");
    }
    else{
      toast.error("Erreur lors de l'ajout de la consommation de carburant veuillez reessayer.");
    }
  }
  const handleInput = (field: keyof FuelConsumption, value: string) => {
    setFuelConsumptions({ ...fuelConsumption, [field]: value });
  }
  const calculatePrice = () => {
    const cost = fuelConsumption.fuelPrice * fuelConsumption.quantity;
    setFuelConsumptions({ ...fuelConsumption, cost });
  }
  useEffect(() => { calculatePrice() }, [fuelConsumption.fuelPrice, fuelConsumption.quantity])
  return (
    <div className="flex items-center justify-center inset-0 fixed z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="relative z-50 bg-white p-6 rounded-lg shadow-lg w-[50%]">
        <h2 className="text-xl font-semibold mb-4">Gestion de carburant</h2>
        <form className="flex flex-col gap-2" onSubmit={onAddCashFuelConsumption}>
          <div className="flex flex-col gap-2">
            <Label>Voyage du </Label>
            <Select onValueChange={(v) => handleInput('tripId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {futureTrips.map((trip) => {
                  const boat = findBoat(trip.boatId, allBoat)
                  return (
                    <SelectItem key={trip.id} value={trip.id}>{`${trip.from} → ${trip.to} ( ${new Date(trip.depart).toLocaleString('fr-Fr', {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} avec ${boat.name} ) `}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          {inputFields.map((inputField) =>
            <InputField label={inputField.label} type={inputField.type} value={fuelConsumption[inputField.key as keyof typeof fuelConsumption]} key={inputField.key}
              onChange={(v) => handleInput(inputField.key as keyof FuelConsumption, v)}></InputField>
          )
          }
          <InputField label="Coût Total" value={fuelConsumption.cost} readOnly />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default CashFuelConsumption;