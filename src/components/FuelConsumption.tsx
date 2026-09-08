import { FC, useState } from "react";
import { Button } from "./ui/button";
import { Calculator, Filter, Fuel, Plus, Search } from "lucide-react";
import CashFuelConsumption from "./FuelConsumptionForm";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { findBoat, findTrip, findUser, formatDate } from "../Tools/Tools";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const FuelConsumption: FC = () => {
  const [showFuel, setShowFuel] = useState<boolean>(false);
  const [filterFuelConsumption, setfilterFuelConsumption] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { boat: allBoat, trip: allTrip, fuelConsumption } = useSelector((state: RootState) => state.stJude);
  const { allUser, currentUser } = useSelector((state: RootState) => state.users);

const fuelConsumptionFilter = fuelConsumption.filter((f) => {
  const search = searchTerm.toLowerCase();
  const user = findUser(f.userId, allUser);
  const trip = findTrip(f.tripId, allTrip);
  const boat = findBoat(trip.boatId, allBoat);

  // Restriction par rôle
  if (currentUser)
  if (currentUser.role === "Capitaine") {
    if (!boat.crew.includes(currentUser.id)) return false;
  }

  // 1. Filtrage par trajet (depuis le Select)
  if (filterFuelConsumption !== "all") {
    const trajet = `${trip.from} → ${trip.to}`.toLowerCase();
    if (!trajet.includes(filterFuelConsumption.toLowerCase())) {
      return false;
    }
  }

  // 2. Recherche (utilisateur, trajet, bateau, prix, type carburant)
  return (
    user.name.toLowerCase().includes(search) ||
    user.lastName.toLowerCase().includes(search) ||
    `${trip.from} → ${trip.to}`.toLowerCase().includes(search) ||
    boat.name.toLowerCase().includes(search) ||
    f.fuelType.toLowerCase().includes(search) ||
    f.fuelPrice.toString().includes(search) ||
    f.cost.toString().includes(search)
  );
});


  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-8 w-full items-center min-h-[100px] sticky z-50 border-b-2 py-4 px-2 top-0 bg-white flex justify-between">
        <div className="flex flex-col">
          <h2 className="text-2xl font-semibold text-primary mb-2">Gestion de Consomation de carburant</h2>
          <p className="text-gray-600">Suivi les consomation de carburant</p>
        </div>
        {currentUser && currentUser.role === "Capitaine" &&
          <div className="flex gap-2">
            <Button onClick={() => setShowFuel(true)}><Plus className="h-7 w-7" />Gesttion de Garburant</Button>
          </div>}
      </div>
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par trajet , utilisateur"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={filterFuelConsumption} onValueChange={setfilterFuelConsumption}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrer par trajet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les trajets</SelectItem>
                  <SelectItem value="Antalaha">Antalaha → Tamatave</SelectItem>
                  <SelectItem value="Tamatave">Tamatave → Antalaha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Fuel className="h-7 w-7" />
            Consomation ({fuelConsumptionFilter.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilsateur</TableHead>
                  <TableHead className="text-right">Prix Du carburant</TableHead>
                  <TableHead className='text-center'>Prix total</TableHead>
                  <TableHead className='text-center'>Date</TableHead>
                  <TableHead className='text-center'>Voyage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuelConsumptionFilter.map((f) => {
                  const user = findUser(f.userId, allUser);
                  const trip = findTrip(f.tripId, allTrip);
                  const boat = findBoat(trip.boatId, allBoat);
                  return (
                    <TableRow key={f.id} className="hover:bg-gray-50">
                      <TableCell>{`${user.name} ${user.lastName}`}</TableCell>
                      <TableCell className="text-right">{f.fuelPrice}</TableCell>
                      <TableCell className="text-right">{f.cost}</TableCell>
                      <TableCell className="text-center">{formatDate(f.createdAt as string)}</TableCell>
                      <TableCell className='text-center'>
                        {`${trip.from} → ${trip.to} ( ${formatDate(trip.depart)} avec ${boat.name} ) `}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {fuelConsumptionFilter.length === 0 && (
            <div className="text-center py-8">
              <Calculator className="h-12 w-12" />
              <p className="">Aucune transaction trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>
      {showFuel && <CashFuelConsumption onClose={() => setShowFuel(false)}></CashFuelConsumption>}
    </div>
  )
}
export default FuelConsumption;