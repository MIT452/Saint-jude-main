import { FC } from "react";
import { CardContent } from "../ui/card";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectTrigger, SelectValue } from "../ui/select";
import { SelectItem } from "@radix-ui/react-select";
import { Trip } from "../../data/type";

interface PropsSelectField {
  trips: Trip[],
  handleInput: (tripId: string, value: string) => void
}
const SelectField: FC<PropsSelectField> = ({ handleInput, trips }) => {
  return (
    <CardContent className="flex flex-col gap-2">
      <Label>Prevue le</Label>
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
        </SelectContent>
      </Select>
    </CardContent>
  )
}
export default SelectField;