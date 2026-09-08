import { FC, useState } from "react";
import { InputField } from "./tools/InputField";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useDispatch, useSelector } from "react-redux";
import { setTrip } from "../redux/feature/stJude";
import { TABLE_DATA_BASE, Trip } from "../data/type";
import { v4 as uuid } from 'uuid';
import { RootState } from "../redux";
import { tripVoid } from "../data/dataVoid";
import { onAddService } from "../data/service";
import { toast } from "react-toastify";

const inputFields = [
  { key: "depart", label: "Date depart", type: "datetime-local", required: false },
  { key: "arrive", label: "Date Arriver", type: "datetime-local", required: false },
]
interface TripeFormProps {
  onClose: () => void;
}
const TripeForm: FC<TripeFormProps> = ({ onClose }) => {
  const boat = useSelector((state: RootState) => state.stJude.boat);
  const currentUser = useSelector((state :RootState)=> state.users.currentUser);
  const [formData, setFormData] = useState<Trip>(tripVoid);
  const dispatch = useDispatch()
  const handleInput = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }
const onAdd = async (e: React.FormEvent) => {
  e.preventDefault();

  const trip: Trip = {
    id: uuid(),
    arrive: formData.arrive,
    boatId: boat.length === 1 ? boat[0].id : formData.boatId,
    depart: formData.depart,
    from: formData.from,
    status: 'Prévu',
    to: formData.to,
    userId: currentUser ? currentUser.id : ""
  };

  const response = await onAddService(TABLE_DATA_BASE.TRIP, trip);

  if (response === "success") {
    dispatch(setTrip(trip));
    toast.success("Voyage ajouté avec succès !");
    onClose();
  } else {
    toast.error("Erreur lors de l'ajout du voyage.");
  }
};

  return (
    <div className="flex items-center justify-center inset-0 fixed z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="relative z-50 bg-white p-6 rounded-lg shadow-lg w-[50%]">
        <h2 className="text-xl font-semibold mb-4">Ajouter un Trajet</h2>
        <form className="flex flex-col gap-4" onSubmit={onAdd}>
          {boat.length !== 1 &&
            <div className="flex flex-col gap-2">
              <Label className="text-card-foreground">Bateau</Label>
              <Select onValueChange={(v) => handleInput('boatId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {boat.map((b) => { return <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem> })}
                </SelectContent>
              </Select>
            </div>
          }
          {inputFields.map(({ key, label, type }) => (
            <InputField key={key} label={label} type={type} value={formData[key as keyof typeof formData] || ''} onChange={(e) => handleInput(key, e)} />
          ))}
          <Label className="text-card-foreground">De</Label>
          <Select onValueChange={(v) => handleInput('from', v)}>
            <SelectTrigger>
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Antalaha">Antalaha</SelectItem>
              <SelectItem value="Tamatave">Tamatave</SelectItem>
            </SelectContent>
          </Select>
          <Label className="text-card-foreground">Vers</Label>
          <Select onValueChange={(v) => handleInput('to', v)}>
            <SelectTrigger>
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Antalaha">Antalaha</SelectItem>
              <SelectItem value="Tamatave">Tamatave</SelectItem>
            </SelectContent>
          </Select>
          <Button>Ajouter</Button>
        </form>
      </div>
    </div>
  )
}
export default TripeForm;