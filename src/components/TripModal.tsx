import { FC, useEffect, useState } from "react";
import { InputField } from "./tools/InputField";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useDispatch, useSelector } from "react-redux";
import { setTrip } from "../redux/feature/stJude";
import { TABLE_DATA_BASE, Trip } from "../data/type";
import { RootState } from "../redux";
import { onAddService } from "../data/service";
import { toast } from "react-toastify";
// import {}

const inputFields = [
  { key: "depart", label: "Date depart", type: "datetime-local", required: false },
  { key: "arrive", label: "Date Arriver", type: "datetime-local", required: false },
]
interface TripModalUpdateProps {
  onClose: () => void;
  currentTrip: Trip
}
const TripModalUpdate: FC<TripModalUpdateProps> = ({ onClose, currentTrip }) => {
  const boat = useSelector((state: RootState) => state.stJude.boat);
  const [tripState, setTripState] = useState<Trip>(currentTrip);

  const currentUser = useSelector((state :RootState)=> state.users.currentUser);
  const dispatch = useDispatch();

  useEffect(() => {
    setTripState(currentTrip);
  }, [currentTrip]);

  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
    return formatted;
  };


  const handleInput = (field: keyof Trip, value: string) => {
    if (field !== "arrive" && field !== "depart")
      setTripState({ ...tripState, arrive: formatDateForInput(tripState.arrive), depart: formatDateForInput(tripState.depart), [field]: value } as Trip);
    else setTripState({ ...tripState, [field]: value } as Trip)
  }
  const onUpdate = async(e: React.FormEvent) => {
    e.preventDefault();
    let trip: Trip = {
      id: currentTrip.id,
      arrive: tripState.arrive,
      boatId: boat.length === 1 ? boat[0].id : tripState.boatId,
      depart: tripState.depart,
      from: tripState.from,
      status: tripState.status,
      to: tripState.to,
      userId : currentUser ? currentUser.id : ''
    }
      const response = await onAddService(TABLE_DATA_BASE.TRIP, trip);
    
      if (response === "success") {
        dispatch(setTrip(trip));
        toast.success("Voyage Modifier avec succès !");
        onClose();
      } else {
        toast.error("Erreur lors du modification du trajet.");
      }
  }
  return (
    <div className="flex items-center justify-center inset-0 fixed z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="relative z-50 bg-white p-6 rounded-lg shadow-lg w-[50%]">
        <h2 className="text-xl font-semibold mb-4">Ajouter un Trajet</h2>
        <form className="flex flex-col gap-4" onSubmit={onUpdate}>
          {boat.length !== 1 &&
            <div className="flex flex-col gap-2">
              <Label className="text-card-foreground">Bateau</Label>
              <Select value={tripState.boatId || ""} onValueChange={(v) => handleInput('boatId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {boat.map((b) => { return <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem> })}
                </SelectContent>
              </Select>
            </div>
          }
          {inputFields.map(({ key, label, type }) => {
            const rawValue = tripState[key as keyof Trip] || "";
            const value = formatDateForInput(rawValue);

            return (
              <InputField
                key={key}
                label={label}
                type={type}
                value={value}
                onChange={(val) => handleInput(key as keyof Trip, val)}
              />
            );
          })}

          <Label className="text-card-foreground">De</Label>
          <Select value={tripState.from || ""} onValueChange={(v) => handleInput('from', v)}>
            <SelectTrigger>
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Antalaha">Antalaha</SelectItem>
              <SelectItem value="Tamatave">Tamatave</SelectItem>
            </SelectContent>
          </Select>
          <Label className="text-card-foreground">Vers</Label>
          <Select value={tripState.to || ""} onValueChange={(v) => handleInput('to', v)}>
            <SelectTrigger>
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Antalaha">Antalaha</SelectItem>
              <SelectItem value="Tamatave">Tamatave</SelectItem>
            </SelectContent>
          </Select>
          <Label className="text-card-foreground">Statue</Label>
          <Select value={tripState.status || ""} onValueChange={(v) => handleInput('status', v)}>
            <SelectTrigger>
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Prévu">Programmé</SelectItem>
              <SelectItem value="Encours">En cours</SelectItem>
              <SelectItem value="Arriver">Terminer</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Modifier</Button>
        </form>
      </div>
    </div>
  )
}
export default TripModalUpdate;