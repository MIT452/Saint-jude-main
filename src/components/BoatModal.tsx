import { FC, useState } from "react";
import { InputField } from "./tools/InputField";
import { Button } from "./ui/button";
import { Boat, TABLE_DATA_BASE } from "../data/type";
import { useDispatch, useSelector } from "react-redux";
import { setBoat as setBoats } from '../redux/feature/stJude';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "./ui/select";
import { Label } from "./ui/label";
import { RootState } from "../redux";
import { onUpdateService } from "../data/service";
import { toast } from "react-toastify";


const inputFields = [
  { key: "id", label: "Matricule", type: "text", required: false, placeHolder: "Ex : MA-1234TA" },
  { key: "name", label: "Nom", type: "text", required: false, placeHolder: 'Ex : St Jude' },
  { key: "capacity", label: "Capacité en tonage (T)", type: "number", required: false },
]
interface TripeFormProps {
  onClose: () => void;
  currentBoat: Boat;
}
const BoatModal: FC<TripeFormProps> = ({ onClose, currentBoat }) => {
  const [boat, setBoat] = useState<Boat>(currentBoat);

  const dispatch = useDispatch()
  const { allUser: capitaines, currentUser } = useSelector((state: RootState) => state.users);

  const capitaine = capitaines.filter(({ role }) => role === "Capitaine")
  const handleInput = (field: keyof Boat, value: string) => {
    setBoat({ ...boat, [field]: value })
  }
  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentBoat: Boat = {
      ...boat,
      userId: currentUser ? currentUser.id : ""
    }
    const response = await onUpdateService(TABLE_DATA_BASE.BOAT, currentBoat);
    if (response === "success") {
      dispatch(setBoats(currentBoat));
      toast.success("Bateau modifier avec succès !");
      onClose();
    }
    else {
      toast.error("Erreur lors de modification du bateau.");
    }
  }
  return (
    <div className="flex items-center justify-center inset-0 fixed z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className=" p-6 w-[50%] relative z-50 rounded-lg shadow-lg bg-white">
        <h2 className="text-xl font-semibold mb-4">Ajouter un bateau</h2>
        <form className="flex flex-col gap-4">
          {inputFields.map(({ key, label, type, placeHolder }) => (
            <InputField key={key} label={label} type={type} value={boat[key as keyof typeof boat] || ''} placeHolder={placeHolder} onChange={(e) => handleInput(key as keyof Boat, e)} />
          ))}
          <div className="flex flex-col gap-2">
            <Label>Type de Mouvement</Label>
            <Select value={boat.state} onValueChange={(v) => handleInput("state", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="En construction">En construction</SelectItem>
                <SelectItem value="En service">En service</SelectItem>
                <SelectItem value="En maintenance">En maintenance</SelectItem>
                <SelectItem value="En panne">En panne</SelectItem>
                <SelectItem value="Désarmé">Désarmé</SelectItem>
                <SelectItem value="Hors service">Hors service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Capitaine</Label>
            <Select
              value={boat.crew[0] ?? ""}
              onValueChange={(v) => setBoat({ ...boat, crew: [v] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {capitaine.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.name} ${c.lastName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>
          <Button onClick={onUpdate}>Modifier</Button>
        </form>
      </div>
    </div>
  )
}
export default BoatModal;