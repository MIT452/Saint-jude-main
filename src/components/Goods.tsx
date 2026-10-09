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

/* =========================
   Statut de la réservation (valeurs de la base, en français)
   EN_ATTENTE, CONFIRMEE, REFUSEE, ANNULEE, NO_SHOW, TERMINEE
========================= */
type StatutReservation = 'EN_ATTENTE' | 'CONFIRMEE' | 'REFUSEE' | 'ANNULEE' | 'NO_SHOW' | 'TERMINEE';

const normaliserStatut = (brut?: string): StatutReservation => {
  const valeur = (brut ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (valeur.includes('NO_SHOW')) return 'NO_SHOW';
  if (valeur.includes('REFUS')) return 'REFUSEE';
  if (valeur.includes('ANNUL')) return 'ANNULEE';
  if (valeur.includes('TERMIN')) return 'TERMINEE';
  if (valeur.includes('CONFIRM')) return 'CONFIRMEE';
  return 'EN_ATTENTE';
};

const configStatut: Record<StatutReservation, { libelle: string; classe: string }> = {
  EN_ATTENTE: { libelle: 'En attente', classe: 'bg-orange-100 text-orange-800' },
  CONFIRMEE: { libelle: 'Confirmée', classe: 'bg-green-100 text-green-800' },
  REFUSEE: { libelle: 'Refusée', classe: 'bg-red-100 text-red-800' },
  ANNULEE: { libelle: 'Annulée', classe: 'bg-red-100 text-red-800' },
  NO_SHOW: { libelle: 'Absent', classe: 'bg-gray-200 text-gray-800' },
  TERMINEE: { libelle: 'Terminée', classe: 'bg-blue-100 text-blue-800' },
};

/* =========================
   Statut du paiement : Crédit / Partiellement payé / Payé
   Règles (calculées à partir des montants) :
   1. Réservation annulée par le client → statut « Annulée » (pas de statut de paiement)
   2. Sinon, montant payé = 0 Ar                 → « Crédit »
   3. Sinon, montant payé < montant total        → « Partiellement payé »
   4. Sinon, montant payé >= montant total       → « Payé »
========================= */
type EtatPaiement = 'CREDIT' | 'PARTIEL' | 'PAYE';

const getEtatPaiement = (reservation: Reservation): EtatPaiement | null => {
  // Règle 1 : réservation annulée → pas de statut de paiement
  if (normaliserStatut(reservation.status as string | undefined) === 'ANNULEE') return null;

  const total = Number(reservation.totalPrice) || 0;
  const paye = Number(reservation.amountPaid) || 0;

  if (paye === 0) return 'CREDIT';    // Règle 2
  if (paye < total) return 'PARTIEL'; // Règle 3
  return 'PAYE';                      // Règle 4 (paye >= total)
};

const configPaiement: Record<EtatPaiement, { libelle: string; classe: string }> = {
  CREDIT: { libelle: 'Crédit', classe: 'bg-red-100 text-red-800' },
  PARTIEL: { libelle: 'Partiellement payé', classe: 'bg-orange-100 text-orange-800' },
  PAYE: { libelle: 'Payé', classe: 'bg-green-100 text-green-800' },
};

/* =========================
   Statut affiché : payée en totalité + en attente → Confirmée
   (affichage uniquement, la base n'est pas modifiée)
========================= */
const getStatutAffiche = (reservation: Reservation): StatutReservation => {
  const statutBrut = normaliserStatut(reservation.status as string | undefined);
  if (statutBrut === 'EN_ATTENTE' && getEtatPaiement(reservation) === 'PAYE') return 'CONFIRMEE';
  return statutBrut;
};

const MarchandiseManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddGoodsModal, setShowAddGoodsModal] = useState(false);
  const [idReservation, setIdReservation] = useState<string>('');
  const [showDetailGoodsModal, setShowDetailGoodsModal] = useState(false);
  const [currentGoods, setCurrentGoods] = useState<Goods[]>([]);
  const [currentReservation, setCurrentReservation] = useState<Reservation>(reservationVoid);

  const { allUser, currentUser } = useSelector((state: RootState) => state.users);
  const { reservation: allReservation, boat: allBoat } = useSelector((state: RootState) => state.stJude);
  const allGoods = useSelector((state: RootState) => state.stJude.goods);
  const alltrip = useSelector((state: RootState) => state.stJude.trip);

  // Nom du caissier : liste des utilisateurs, sinon l'utilisateur connecté, sinon "Inconnu"
  const getNomCaissier = (userId: string) => {
    const user =
      allUser.find((candidat) => candidat.id === userId) ??
      (currentUser && currentUser.id === userId ? currentUser : undefined);
    return user ? `${user.name} ${user.lastName}` : 'Inconnu';
  };

  const filteredReservations = allReservation.filter((reservation) => {
    // 0. Si c'est un Capitaine : uniquement les réservations de ses bateaux
    if (currentUser && currentUser.role === 'Capitaine') {
      const trip = findTrip(reservation.tripId, alltrip);
      const boat = trip ? findBoat(trip.boatId, allBoat) : undefined;
      if (!boat || !boat.crew.includes(currentUser.id)) return false;
    }

    // 1. Filtre par statut (annulée) ou par statut de paiement
    const statut = normaliserStatut(reservation.status as string | undefined);
    const etatPaiement = getEtatPaiement(reservation);

    if (statusFilter === 'cancelled' && statut !== 'ANNULEE') return false;
    if (statusFilter === 'paid' && etatPaiement !== 'PAYE') return false;
    if (statusFilter === 'partial' && etatPaiement !== 'PARTIEL') return false;
    if (statusFilter === 'credit' && etatPaiement !== 'CREDIT') return false;

    // 2. Recherche (client, destinataire, ID, utilisateur, trajet)
    const search = searchTerm.toLowerCase();
    const user = findUser(reservation.userId, allUser);
    const trip = findTrip(reservation.tripId, alltrip);

    return (
      (reservation.clientName ?? '').toLowerCase().includes(search) ||
      (reservation.destName ?? '').toLowerCase().includes(search) ||
      (reservation.id ?? '').toLowerCase().includes(search) ||
      (user?.name ?? '').toLowerCase().includes(search) ||
      (user?.lastName ?? '').toLowerCase().includes(search) ||
      (trip?.from ?? '').toLowerCase().includes(search) ||
      (trip?.to ?? '').toLowerCase().includes(search)
    );
  });

  const onShowDetailGoodsModal = (reservation: Reservation) => {
    setCurrentReservation(reservation);
    setCurrentGoods(allGoods.filter(({ reservationId }) => reservationId === reservation.id));
    setShowDetailGoodsModal(true);
  };

  useEffect(() => {
    setIdReservation(uuid());
  }, [showAddGoodsModal]);

  return (
    <div className="min-h-screen relative text-gray-900">
      <div className="max-w-full">
        {/* Header */}
        <div className="w-full border-b-2 py-4 px-2 sticky top-2 flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Gestion des Marchandises</h2>
            <p className="text-muted-foreground">Suivi et gestion des marchandises transportées</p>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowAddGoodsModal(!showAddGoodsModal)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter réservation
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
                    placeholder="Rechercher par expéditeur, destinataire ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-56">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="partial">Partiellement payé</SelectItem>
                    <SelectItem value="credit">Crédit</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
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
              Liste des réservations ( {filteredReservations.length} )
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Voyage</TableHead>
                    <TableHead>Expéditeur</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Caissier</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Poids total (kg)</TableHead>
                    <TableHead className="text-right">Prix total</TableHead>
                    <TableHead className="text-right">Montant payé</TableHead>
                    <TableHead className="text-right">Montant restant</TableHead>
                    <TableHead className="text-center">Paiement</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((reservation) => {
                    const trip = findTrip(reservation.tripId, alltrip); // retrouver le trip lié
                    const etatPaiement = getEtatPaiement(reservation);
                    const paiement = etatPaiement ? configPaiement[etatPaiement] : null;
                    const statut = configStatut[getStatutAffiche(reservation)];
                    return (
                      <TableRow
                        key={reservation.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => onShowDetailGoodsModal(reservation)}
                      >
                        <TableCell>
                          {trip
                            ? `${formatCityName(trip.from)} → ${formatCityName(trip.to)} (${new Date(trip.depart).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })})`
                            : 'Voyage inconnu'}
                        </TableCell>
                        <TableCell>{reservation.clientName}</TableCell>
                        <TableCell>{reservation.destName}</TableCell>
                        <TableCell>{getNomCaissier(reservation.userId)}</TableCell>
                        <TableCell className="text-right">{Number(reservation.quantity)}</TableCell>
                        <TableCell className="text-right">{reservation.weight}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(reservation.totalPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(reservation.amountPaid)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(reservation.amountToPay)}</TableCell>
                        <TableCell className="text-center">
                          {paiement ? (
                            <Badge variant="secondary" className={paiement.classe}>
                              {paiement.libelle}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className={statut.classe}>
                            {statut.libelle}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredReservations.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Aucune réservation trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showDetailGoodsModal && (
        <ModalUpdateGood
          currentGoods={currentGoods}
          currentReservation={currentReservation}
          onClose={() => setShowDetailGoodsModal(false)}
        />
      )}
      {showAddGoodsModal && (
        <ReservationForm onClose={() => setShowAddGoodsModal(false)} idReservation={idReservation} />
      )}
    </div>
  );
};

export default MarchandiseManagementPage;