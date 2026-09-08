import { FC, useState } from "react";
import { Button } from "./ui/button";
import { Hammer, Plus, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import BoatForm from './BoatForm';
import BoatModal from "./BoatModal";
import { Boat } from "../data/type";

const BoatComponant: FC = () => {
  const [showModalForm, setShowModalForm] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentBoat, setCurrentBoat] = useState<Boat>()

  const boats = useSelector((state: RootState) => state.stJude.boat);
  const capitaines = useSelector((state :RootState)=> state.users.allUser);

  const capitaine = capitaines.filter(({role})=> role === "Capitaine")
  const boatS = boats.filter(({ state }) => state === "En service");
  const boatC = boats.filter(({ state }) => state === "En construction");


  const findCurrentBoat = (boat: Boat) => {
    setCurrentBoat(boat);
    setShowModal(true);
  }

  return (
    <div className="flex flex-col">
      <div className="w-full min-h-[100px] sticky border-b-2 py-4 px-2 top-0 bg-white flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-primary mb-2">Gestion des Bateaux</h2>
          <p className="text-gray-600">Construction des nouveaux Bateaux, Tonage et volume</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowModalForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un bateau
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Ship className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tous les bateaux</p>
                <p className="text-2xl font-bold">{boats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Ship className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En service</p>
                <p className="text-2xl font-bold">{boatS.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Hammer className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En construction</p>
                <p className="text-2xl font-bold">{boatC.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Ship className="h-5 w-5 mr-2" />
            Liste des bateaux ( {boats.length} )
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Capacité (T)</TableHead>
                  <TableHead>Etat</TableHead>
                  <TableHead>Capitaine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boats.map((boat) => {
                  const currentCapitaine = capitaine.find(({id})=> boat.crew.includes(id));

                  return (
                    <TableRow key={boat.id} className="hover:bg-gray-50" onClick={() => findCurrentBoat(boat)}>
                      <TableCell className="font-medium text-[#001F3F]">{boat.id}</TableCell>
                      <TableCell className="font-medium">{boat.name}</TableCell>
                      <TableCell className="font-medium">{boat.capacity}</TableCell>
                      <TableCell className="font-medium">{boat.state}</TableCell>
                      <TableCell className="font-medium"> {currentCapitaine ? `${currentCapitaine.name} ${currentCapitaine.lastName}` : "-" }</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {showModalForm && <BoatForm onClose={() => setShowModalForm(false)} />}
      {showModal && currentBoat && <BoatModal currentBoat={currentBoat} onClose={() => setShowModal(false)} />}
    </div>
  )
}
export default BoatComponant;