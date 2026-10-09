import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Filter, Package, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { findBoat, findTrip, formatCityName, formatCurrency } from '../Tools/Tools';
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
   Statut affiché (déduit du paiement) :
   - Annulée / Refusée / Absent / Terminée → gardent leur statut
   - Payé en totalité                      → Confirmée
   - Partiellement payé ou Crédit          → En attente
   (affichage uniquement, la base n'est pas modifiée)
========================= */
const getStatutAffiche = (reservation: Reservation): StatutReservation => {
  const statutBrut = normaliserStatut(reservation.status as string | undefined);

  if (statutBrut !== 'EN_ATTENTE' && statutBrut !== 'CONFIRMEE') return statutBrut;

  return getEtatPaiement(reservation) === 'PAYE' ? 'CONFIRMEE' : 'EN_ATTENTE';
};

/* =========================
   Enregistrement d'un paiement supplémentaire
   >>> À BRANCHER sur votre API / action Redux existante <<<
   Il faut mettre à jour la réservation avec :
     amountPaid  = ancien montant payé + montant
     amountToPay = total - nouveau montant payé
   et NE PAS modifier userId (le caissier d'origine).
========================= */
const enregistrerPaiement = async (reservation: Reservation, montant: number): Promise<void> => {
  const nouveauPaye = (Number(reservation.amountPaid) || 0) + montant;
  const nouveauReste = Math.max((Number(reservation.totalPrice) || 0) - nouveauPaye, 0);

  // TODO : remplacer cette ligne par l'appel réel (fetch / dispatch) avec
  // { id: reservation.id, amountPaid: nouveauPaye, amountToPay: nouveauReste }
  throw new Error(`Enregistrement non branché (nouveau payé : ${nouveauPaye}, reste : ${nouveauReste})`);
};

/* =========================
   Fenêtre « Ajouter un paiement »
========================= */
type PaiementModalProps = {
  reservation: Reservation;
  onClose: () => void;
};

const PaiementModal = ({ reservation, onClose }: PaiementModalProps) => {
  const [montant, setMontant] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const total = Number(reservation.totalPrice) || 0;
  const paye = Number(reservation.amountPaid) || 0;
  const reste = Math.max(total - paye, 0);

  const valider = async () => {
    const valeur = Number(montant);
    if (!valeur || valeur <= 0) {
      setErreur('Entrez un montant supérieur à 0.');
      return;
    }
    if (valeur > reste) {
      setErreur(`Le montant dépasse le reste à payer (${formatCurrency(reste)}).`);
      return;
    }
    try {
      setEnCours(true);
      setErreur('');
      await enregistrerPaiement(reservation, valeur);
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'enregistrement du paiement.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[#001F3F]">Ajouter un paiement</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-500">Expéditeur :</span> {reservation.clientName}
            </p>
            <p>
              <span className="text-gray-500">Prix total :</span> {formatCurrency(total)}
            </p>
            <p>
              <span className="text-gray-500">Déjà payé :</span> {formatCurrency(paye)}
            </p>
            <p className="font-medium">
              <span className="text-gray-500 font-normal">Reste à payer :</span> {formatCurrency(reste)}
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Montant du paiement (Ar)</label>
            <Input
              type="number"
              min={1}
              max={reste}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder={`Maximum ${reste}`}
            />
          </div>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={enCours}>
              Annuler
            </Button>
            <Button onClick={valider} disabled={enCours}>
              {enCours ? 'Enregistrement...' : 'Valider le paiement'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MarchandiseManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddGoodsModal, setShowAddGoodsModal] = useState(false);
  const [idReservation, setIdReservation] = useState<string>('');
  const [showDetailGoodsModal, setShowDetailGoodsModal] = useState(false);
  const [currentGoods, setCurrentGoods] = useState<Goods[]>([]);
  const [currentReservation, setCurrentReservation] = useState<Reservation>(reservationVoid);
  const [reservationPaiement, setReservationPaiement] = useState<Reservation | null>(null);

  const { allUser, currentUser } = useSelector((state: RootState) => state.users);
  const { reservation: allReservation, boat: allBoat } = useSelector((state: RootState) => state.stJude);
  const allGoods = useSelector((state: RootState) => state.stJude.goods);
  const alltrip = useSelector((state: RootState) => state.stJude.trip);

  // Nom du caissier :
  // - userId vide                      → "Non attribué" (réservation sans caissier)
  // - userId introuvable dans la liste → "Inconnu"
  const getNomCaissier = (userId?: string) => {
    const id = String(userId ?? '').trim();
    if (!id) return 'Non attribué';

    const user =
      allUser.find((candidat) => String(candidat.id).trim() === id) ??
      (currentUser && String(currentUser.id).trim() === id ? currentUser : undefined);

    const nom = user ? `${user.name ?? ''} ${user.lastName ?? ''}`.trim() : '';
    return nom || 'Inconnu';
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

    // 2. Recherche (expéditeur, destinataire, ID, caissier, trajet)
    const search = searchTerm.toLowerCase();
    const trip = findTrip(reservation.tripId, alltrip);

    return (
      (reservation.clientName ?? '').toLowerCase().includes(search) ||
      (reservation.destName ?? '').toLowerCase().includes(search) ||
      (reservation.id ?? '').toLowerCase().includes(search) ||
      getNomCaissier(reservation.userId).toLowerCase().includes(search) ||
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
                    placeholder="Rechercher par expéditeur, destinataire, caissier ou ID..."
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
                    <TableHead className="text-center">Action</TableHead>
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
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="secondary" className={paiement.classe}>
                                {paiement.libelle}
                              </Badge>
                              {etatPaiement === 'PARTIEL' && (
                                <span className="text-xs text-gray-500">
                                  Reste : {formatCurrency(reservation.amountToPay)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className={statut.classe}>
                            {statut.libelle}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {etatPaiement === 'PARTIEL' || etatPaiement === 'CREDIT' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation(); // n'ouvre pas le détail de la ligne
                                setReservationPaiement(reservation);
                              }}
                            >
                              Ajouter un paiement
                            </Button>
                          ) : etatPaiement === 'PAYE' ? (
                            <span className="text-sm text-green-700">Soldé</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
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
      {reservationPaiement && (
        <PaiementModal reservation={reservationPaiement} onClose={() => setReservationPaiement(null)} />
      )}
    </div>
  );
};

export default MarchandiseManagementPage;