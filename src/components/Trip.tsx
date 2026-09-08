import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Ship, Plus, MapPin, Calendar, User, Filter } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import TripeForm from './TripeForm';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { findBoat, formatHour, getDuration } from '../Tools/Tools';
import TripModal from "./TripModal"
import { statusTrip, Trip } from '../data/type';

export default function GestionTrajetPage() {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | statusTrip>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [showModalUpdate, setShowModalUpdate] = useState<boolean>(false);
  const [boatFilter, setBoatFilter] = useState<string>('all');
  const [capitaineFilter, setCapitaineFilter] = useState<string>('all');
  const [currentTrip, setCurrentTrip] = useState<Trip>()

  const { trip: trips, boat: allBoat } = useSelector((state: RootState) => state.stJude);
  const { allUser } = useSelector((state: RootState) => state.users);
  const allCapinaine = allUser.filter(u => u.role === 'Capitaine');

  // Filtrage combiné
  const filteredTrip = trips
    .filter(trip => statusFilter === 'all' ? true : trip.status === statusFilter)
    .filter(trip => {
      if (timeFilter === 'all') return true;
      const departDate = new Date(trip.depart);
      const now = new Date();
      switch (timeFilter) {
        case 'day': return departDate.toDateString() === now.toDateString();
        case 'week': {
          const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
          return departDate >= startOfWeek && departDate <= endOfWeek;
        }
        case 'month': return departDate.getMonth() === now.getMonth() && departDate.getFullYear() === now.getFullYear();
      }
    })
    .filter(trip => {
      if (!specificDate) return true;
      const filterDate = new Date(specificDate);
      const departDate = new Date(trip.depart);
      return departDate.getFullYear() === filterDate.getFullYear() &&
        departDate.getMonth() === filterDate.getMonth() &&
        departDate.getDate() === filterDate.getDate();
    })
    .filter(trip => boatFilter === 'all' ? true : trip.boatId === boatFilter)
    .filter(trip => {
      if (capitaineFilter === 'all') return true;
      const boat = findBoat(trip.boatId, allBoat);
      return boat.crew.includes(capitaineFilter);
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (statut: statusTrip) => {
    switch (statut) {
      case 'Arriver': return <Badge className="bg-green-100 text-green-800">Terminé</Badge>;
      case 'Encours': return <Badge className="bg-blue-100 text-blue-800">En cours</Badge>;
      case 'Prévu': return <Badge className="bg-orange-100 text-orange-800">Programmé</Badge>;
      default: return <Badge variant="secondary">{statut}</Badge>;
    }
  };

  const onShowUpdate = (trip: Trip) => {
    setCurrentTrip(trip);
    setShowModalUpdate(true)
  }
  return (
    <div className="min-h-screen text-gray-900">
      <div className="max-w-full flex flex-col gap-4">
        {/* Header */}
        <div className="w-full min-h-[100px] sticky border-b-2 py-4 px-2 top-0 bg-white flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-primary mb-2">Gestion des Trajets</h2>
            <p className="text-gray-600">Planification et suivi des voyages</p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter un trajet
          </Button>
        </div>

        {/* Filters */}
        <Card className="flex">
          <div className="grid md:grid-cols-5 gap-4 p-4 w-full">
            {/* Statut */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1 text-gray-600">Statut</label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="Arriver">Terminé</SelectItem>
                  <SelectItem value="Encours">En cours</SelectItem>
                  <SelectItem value="Prévu">Programmé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Période */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1 text-gray-600">Période</label>
              <Select value={timeFilter} onValueChange={v => setTimeFilter(v as any)}>
                <SelectTrigger className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="day">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date spécifique */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1 text-gray-600">Date spécifique</label>
              <Input
                type="date"
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Bateau */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1 text-gray-600">Bateau</label>
              <Select value={boatFilter} onValueChange={setBoatFilter}>
                <SelectTrigger className="w-full">
                  <Ship className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les bateaux</SelectItem>
                  {allBoat.map((b , ke) => (
                    <SelectItem key={ke} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Capitaine */}
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1 text-gray-600">Capitaine</label>
              <Select value={capitaineFilter} onValueChange={setCapitaineFilter}>
                <SelectTrigger className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les capitaines</SelectItem>
                  {allCapinaine.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>


        {/* Trips Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" /> Liste des Trajets ({filteredTrip.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Départ</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Bateau</TableHead>
                    <TableHead>Date Départ</TableHead>
                    <TableHead>Date Arrivée</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrip.map((trip, key) => {
                    const boat = findBoat(trip.boatId, allBoat);
                    // const boat = allCapinaine.find(c => boat.crew.includes(c.id));
                    return (
                      <TableRow key={key} className="hover:bg-gray-50" onClick={() => onShowUpdate(trip)}>
                        <TableCell>{trip.from}</TableCell>
                        <TableCell>{trip.to}</TableCell>
                        <TableCell>{boat ? `${boat.name}` : '-'}</TableCell>
                        <TableCell>{formatDate(trip.depart)}<br />{formatHour(trip.depart)}</TableCell>
                        <TableCell>{formatDate(trip.arrive)}<br />{formatHour(trip.arrive)}</TableCell>
                        <TableCell>{getDuration(trip.arrive, trip.depart)}</TableCell>
                        <TableCell>{getStatusBadge(trip.status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {filteredTrip.length === 0 && (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Aucun trajet trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showModal && <TripeForm onClose={() => setShowModal(false)} />}
      {showModalUpdate && currentTrip && <TripModal currentTrip={currentTrip} onClose={() => setShowModalUpdate(false)}></TripModal>}
    </div>
  );
}
