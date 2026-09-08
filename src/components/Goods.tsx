import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Filter, Package } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { findBoat, findTrip, findUser, formatCityName, formatCurrency } from '../Tools/Tools';
import ReservationForm from './GoodsForm';
import { v4 as uuid } from 'uuid';
import ModalUpdateGood from './GoodsModalUpdate';
import { Badge } from './ui/badge';
import { Goods, Reservation } from '../data/type';
import { reservationVoid } from '../data/dataVoid';

const MarchandiseManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddGoodsModal, setShowAddGoodsModal] = useState(false);
  const [idReservation, setIdReservation] = useState<string>('');
  const [showDetailGoodsModal, setShowDetailGoodsModal] = useState(false);
  const [currentGoods, setCurrentGoods] = useState<Goods[]>([]);
  const [currentReservation, setCurrentReservation] = useState<Reservation>(reservationVoid);

  const {allUser , currentUser} = useSelector((state: RootState) => state.users);
  const { reservation: allReservation , boat :allBoat} = useSelector((state: RootState) => state.stJude);
  const allGoods = useSelector((state: RootState) => state.stJude.goods);
  const alltrip = useSelector((state: RootState) => state.stJude.trip);

const filteredReservations = allReservation.filter((reservation) => {
  // 0. Vérifier si c'est un Capitaine
  if(currentUser)
  if (currentUser.role === "Capitaine") {
    const trip = findTrip(reservation.tripId, alltrip);
    const boat = findBoat(trip.boatId, allBoat);

    // si le bateau du trajet n'appartient pas à ce capitaine → on exclut
    if (!boat.crew.includes(currentUser.id)) return false;
  }

  // 1. Filtrage par statut paiement
  if (statusFilter === "paid" && !reservation.paymentStatus) return false;
  if (statusFilter === "unpaid" && reservation.paymentStatus) return false;

  // 2. Recherche (client, destinataire, ID, utilisateur, trajet)
  const search = searchTerm.toLowerCase();
  const user = findUser(reservation.userId, allUser);
  const trip = findTrip(reservation.tripId, alltrip);

  return (
    reservation.clientName.toLowerCase().includes(search) ||
    reservation.destName.toLowerCase().includes(search) ||
    reservation.id.toLowerCase().includes(search) ||
    user.name.toLowerCase().includes(search) ||
    user.lastName.toLowerCase().includes(search) ||
    trip.from.toLowerCase().includes(search) ||
    trip.to.toLowerCase().includes(search)
  );
});


  const onShowDetailGoodsModal = (reservation: Reservation) => {
    setCurrentReservation(reservation)
    setCurrentGoods(allGoods.filter(({ reservationId }) => reservationId === reservation.id));
    setShowDetailGoodsModal(true);
  }
  useEffect(() => { setIdReservation(uuid()) }, [showAddGoodsModal])
  return (
    <div className="min-h-screen relative text-gray-900">
      <div className="max-w-full ">
        {/* Header */}
        <div className="w-full border-b-2 py-4 px-2 sticky top-2 flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold  mb-2">Gestion des Marchandises</h2>
            <p className="text-muted-foreground">Suivi et gestion des marchandises transportées</p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAddGoodsModal(!showAddGoodsModal)}>
            <Plus className="h-4 w-4 mr-2" />Ajouter reservation
          </Button>
        </div>
        {/* Filters */}
        <Card className="border-border hover:shadow-md transition-shadow mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par client, marchandise ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10" />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Statut paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="unpaid">Non payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Data Table */}
        <Card className="border-border hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-[#001F3F]">
              <Package className="h-5 w-5 mr-2" />
              Liste des Reservation ( {filteredReservations.length} )
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Voyage </TableHead>
                    <TableHead>Expediteur</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Caissier</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Poids Total (kg)</TableHead>
                    <TableHead className="text-right">Prix Total</TableHead>
                    <TableHead className="text-right">Montant Payer</TableHead>
                    <TableHead className="text-right">Montant Restant</TableHead>
                    <TableHead className="text-center">Paiement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((reservation , key) => {
                    const trip = findTrip(reservation.tripId, alltrip); // retrouver le trip lié
                    return (
                      <TableRow
                        key={key}
                        className="hover:bg-gray-50"
                        onClick={() => onShowDetailGoodsModal(reservation)}
                      >
                        <TableCell>
                          {trip
                            ? `${formatCityName(trip.from)} → ${formatCityName(trip.to)} (${new Date(trip.depart).toLocaleString('fr-FR', {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })})`
                            : "Voyage inconnu"}
                        </TableCell>
                        <TableCell>{reservation.clientName}</TableCell>
                        <TableCell>{reservation.destName}</TableCell>
                        <TableCell>
                          {`${findUser(reservation.userId, allUser).name} ${findUser(reservation.userId, allUser).lastName}`}
                        </TableCell>
                        <TableCell className="text-right">{Number(reservation.quantity)}</TableCell>
                        <TableCell className="text-right">{reservation.weight}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(reservation.totalPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(reservation.amountPaid)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(reservation.amountToPay)}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={reservation.paymentStatus ? "default" : "destructive"}
                            className={reservation.paymentStatus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                          >
                            {reservation.paymentStatus ? 'Oui' : 'Non'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>

              </Table>
            </div>

            {allReservation.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Aucune reservation trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {showDetailGoodsModal && (<ModalUpdateGood currentGoods={currentGoods} currentReservation={currentReservation} onClose={() => setShowDetailGoodsModal(false)} />)}
      {showAddGoodsModal && (<ReservationForm onClose={() => setShowAddGoodsModal(false)} idReservation={idReservation} />)}
    </div>
  );
}

export default MarchandiseManagementPage;