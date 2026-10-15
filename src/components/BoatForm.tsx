import { FC, useState } from "react";
import { InputField } from "./tools/InputField";
import { Button } from "./ui/button";
import { Boat, TABLE_DATA_BASE } from "../data/type";
import { boatVoid } from "../data/dataVoid";
import { useDispatch, useSelector } from "react-redux";
import { setBoat as setBoats } from "../redux/feature/stJude";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "./ui/select";
import { Label } from "./ui/label";
import { RootState } from "../redux";
import { onAddService } from "../data/service";
import { toast } from "react-toastify";
import BoatImagePicker from "./tools/BoatImagePicker";

const inputFields = [
  { key: "id", label: "Matricule", type: "text", placeHolder: "Ex : MA-1234TA" },
  { key: "name", label: "Nom", type: "text", placeHolder: "Ex : St Jude" },
  { key: "capacity", label: "Capacité en tonage (T)", type: "number", placeHolder: "Ex : 5000" },
];

interface BoatFormProps {
  onClose: () => void;
}

const BoatForm: FC<BoatFormProps> = ({ onClose }) => {
  const [boat, setBoat] = useState<Boat>(boatVoid);
  const [saving, setSaving] = useState(false);

  const { allUser, currentUser } = useSelector((state: RootState) => state.users);
  const dispatch = useDispatch();

  const capitaines = allUser.filter(({ role }) => role === "Capitaine");

  const handleInput = (field: keyof Boat, value: string) => {
    if (field === "capacity") {
      setBoat({ ...boat, capacity: Number(value) });
      return;
    }
    setBoat({ ...boat, [field]: value });
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!String(boat.id).trim() || !String(boat.name).trim() || !(Number(boat.capacity) > 0)) {
      toast.error("Veuillez renseigner le matricule, le nom et la capacité.");
      return;
    }

    setSaving(true);
    try {
      const newBoat: Boat = {
        ...boat,
        userId: currentUser ? currentUser.id : "",
      };
      const response = await onAddService(TABLE_DATA_BASE.BOAT, newBoat);
      if (response === "success") {
        dispatch(setBoats(newBoat));
        toast.success("Bateau ajouté avec succès !");
        onClose();
      } else {
        toast.error("Erreur lors de l'ajout du bateau.");
      }
    } catch {
      toast.error("Erreur lors de l'ajout du bateau.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center inset-0 fixed z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="relative z-50 bg-white p-6 rounded-lg shadow-lg w-[50%] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Ajouter un bateau</h2>
        <form className="flex flex-col gap-4" onSubmit={onAdd}>
          {inputFields.map(({ key, label, type, placeHolder }) => (
            <InputField
              key={key}
              label={label}
              type={type}
              value={boat[key as keyof typeof boat] || ""}
              placeHolder={placeHolder}
              onChange={(e) => handleInput(key as keyof Boat, e)}
            />
          ))}

          <BoatImagePicker
            value={boat.image}
            onChange={(img) => setBoat({ ...boat, image: img })}
          />

          <div className="flex flex-col gap-2">
            <Label>Etat du bateau</Label>
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
              value={boat.crew?.[0] ?? ""}
              onValueChange={(v) => setBoat({ ...boat, crew: [v] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {capitaines.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.name} ${c.lastName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Ajout en cours..." : "Ajouter"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BoatForm;