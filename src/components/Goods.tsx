import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  Filter,
  Layers,
  Package,
  Plus,
  Search,
  Ship,
  Truck,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { RootState } from '../redux';
import { findBoat, findTrip, formatCityName, formatCurrency } from '../Tools/Tools';
import { askAssistant } from '../data/intelligenceService';
import ReservationForm from './GoodsForm';
import { v4 as uuid } from 'uuid';
import ModalUpdateGood from './GoodsModalUpdate';
import { CashMovement, Goods, Reservation } from '../data/type';
import { setCashMouvement, setReservation } from '../redux/feature/stJude';
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

/* =========================
   Statut du paiement : Crédit / Partiellement payé / Payé
   Règles (calculées à partir des montants) :
   1. Réservation annulée par le client → pas de statut de paiement
   2. Montant payé = 0 Ar                → « Crédit »
   3. Montant payé < montant total       → « Partiellement payé »
   4. Montant payé >= montant total      → « Payé »
========================= */
type EtatPaiement = 'CREDIT' | 'PARTIEL' | 'PAYE';

const getEtatPaiement = (reservation: Reservation): EtatPaiement | null => {
  if (normaliserStatut(reservation.status as string | undefined) === 'ANNULEE') return null;

  const total = Number(reservation.totalPrice) || 0;
  const paye = Number(reservation.amountPaid) || 0;

  if (paye === 0) return 'CREDIT';
  if (paye < total) return 'PARTIEL';
  return 'PAYE';
};

/* =========================
   Statut affiché dans le tableau (affichage uniquement, la base n'est pas modifiée) :
   - Annulée / Refusée / Absent / Terminée → gardent leur statut
   - Crédit (0 Ar payé)   → « En attente »
   - Partiellement payé   → « Partiellement payé » (+ bouton « Ajouter paiement »)
   - Payé                 → « Confirmée »
========================= */
type StatutLigne = { cle: StatutReservation; libelle: string; classe: string; Icon: LucideIcon };

const statutsFixes: Record<Exclude<StatutReservation, 'EN_ATTENTE' | 'CONFIRMEE'>, StatutLigne> = {
  REFUSEE: { cle: 'REFUSEE', libelle: 'Refusée', classe: 'bg-red-100 text-red-700', Icon: XCircle },
  ANNULEE: { cle: 'ANNULEE', libelle: 'Annulée', classe: 'bg-red-100 text-red-700', Icon: XCircle },
  NO_SHOW: { cle: 'NO_SHOW', libelle: 'Absent', classe: 'bg-gray-200 text-gray-800', Icon: XCircle },
  TERMINEE: { cle: 'TERMINEE', libelle: 'Livrée', classe: 'bg-blue-100 text-blue-700', Icon: CheckCircle2 },
};

const getStatutLigne = (reservation: Reservation): StatutLigne => {
  const brut = normaliserStatut(reservation.status as string | undefined);
  if (brut !== 'EN_ATTENTE' && brut !== 'CONFIRMEE') return statutsFixes[brut];

  const etat = getEtatPaiement(reservation);
  if (etat === 'PAYE')
    return { cle: 'CONFIRMEE', libelle: 'Confirmée', classe: 'bg-green-100 text-green-700', Icon: CheckCircle2 };
  if (etat === 'PARTIEL')
    return {
      cle: 'EN_ATTENTE',
      libelle: 'Partiellement payé',
      classe: 'bg-orange-100 text-orange-700',
      Icon: CreditCard,
    };
  return { cle: 'EN_ATTENTE', libelle: 'En attente', classe: 'bg-red-50 text-red-600', Icon: Clock };
};

/* =========================
   Filtres (statut / paiement)
========================= */
type Filtre = 'all' | 'credit' | 'partial' | 'paid' | 'delivered' | 'cancelled';

const correspondAuFiltre = (reservation: Reservation, filtre: Filtre): boolean => {
  if (filtre === 'all') return true;
  const statut = normaliserStatut(reservation.status as string | undefined);
  const etat = getEtatPaiement(reservation);
  switch (filtre) {
    case 'cancelled':
      return statut === 'ANNULEE';
    case 'delivered':
      return statut === 'TERMINEE';
    case 'paid':
      return etat === 'PAYE';
    case 'partial':
      return etat === 'PARTIEL';
    case 'credit':
      return etat === 'CREDIT';
    default:
      return true;
  }
};

const filtresRapides: { cle: Exclude<Filtre, 'all'>; libelle: string; Icon: LucideIcon; couleur: string }[] = [
  { cle: 'credit', libelle: 'En attente', Icon: Clock, couleur: 'text-red-500' },
  { cle: 'paid', libelle: 'Confirmée', Icon: CheckCircle2, couleur: 'text-green-600' },
  { cle: 'partial', libelle: 'Partiellement payé', Icon: CreditCard, couleur: 'text-orange-500' },
  { cle: 'delivered', libelle: 'Livrée', Icon: Truck, couleur: 'text-purple-600' },
];

/* =========================
   Utilitaires
========================= */
const normaliserTexte = (valeur?: string) =>
  (valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Cherche un texte dans un objet : d'abord les clés connues, puis toute clé qui correspond au motif
const trouverTexte = (source: unknown, cles: string[], motif: RegExp, exclure?: RegExp): string => {
  const record = source as Record<string, unknown> | undefined;
  if (!record) return '';
  for (const cle of cles) {
    const valeur = record[cle];
    if (typeof valeur === 'string' && valeur.trim()) return valeur.trim();
  }
  for (const [cle, valeur] of Object.entries(record)) {
    if (typeof valeur === 'string' && valeur.trim() && motif.test(cle) && !(exclure && exclure.test(cle))) {
      return valeur.trim();
    }
  }
  return '';
};

const nomMarchandise = (item: Goods) =>
  trouverTexte(
    item,
    ['name', 'goodsName', 'nom', 'designation', 'label', 'libelle', 'title', 'description', 'productName', 'item', 'type', 'goodsType'],
    /name|nom|desig|label|libelle|title|descr|product|item|marchand|goods|type/i,
    /id$|^id|reservation|user|client|trip|boat|created|updated|date|status/i
  );

// Photo du bateau (ajoutée depuis « Gestion de bateau »)
const photoBateau = (bateau: unknown) =>
  trouverTexte(bateau, ['image', 'photo', 'imageUrl', 'picture', 'img'], /image|photo|picture|img/i);

/* =========================
   Icône de marchandise (même principe que dans le récapitulatif du formulaire)
   1. emoji reconnu par mot-clé d'après le NOM ACTUEL de la marchandise
   2. emoji proposé par l'IA pour ce nom (gardé en cache dans le navigateur)
   3. icône enregistrée sur la marchandise (champ icon / emoji)
   4. sinon 📦
========================= */
const EMOJIS: [RegExp, string][] = [
  [/moto|scooter|motard/, '🏍️'],
  [/voiture|\bauto\b|taxi|\bcar\b/, '🚗'],
  [/camion|truck/, '🚚'],
  [/velo|bicyclette|\bbike\b/, '🚲'],
  [/bateau|pirogue|barque/, '🚤'],
  [/pomme de terre|patate/, '🥔'],
  [/fruit|pomme/, '🍎'],
  [/banane/, '🍌'],
  [/mangue/, '🥭'],
  [/ananas/, '🍍'],
  [/litchi|letchi/, '🍒'],
  [/legume|carotte/, '🥕'],
  [/tomate/, '🍅'],
  [/oignon/, '🧅'],
  [/manioc/, '🍠'],
  [/\briz\b/, '🍚'],
  [/\bble\b|\bmais\b|cereale/, '🌾'],
  [/vanille/, '🌿'],
  [/girofle|epice|poivre/, '🌶️'],
  [/cafe/, '☕'],
  [/cacao|chocolat/, '🍫'],
  [/\bthe\b/, '🍵'],
  [/sucre/, '🍬'],
  [/\bsel\b/, '🧂'],
  [/gasoil|diesel|carbur|essence|petrole|fuel/, '⛽'],
  [/\bgaz\b/, '🔥'],
  [/huile/, '🛢️'],
  [/bois|planche|bambou/, '🪵'],
  [/ciment|brique|construct|\bfer\b|tole|acier/, '🧱'],
  [/vetement|habit|tissu|chaussure/, '👕'],
  [/poisson|crevette|crabe|langouste/, '🐟'],
  [/viande|zebu|boeuf|poulet|porc|volaille/, '🥩'],
  [/meuble|table|chaise|\blit\b|armoire/, '🪑'],
  [/medicament|pharma/, '💊'],
  [/ordinateur|telephone|electro|\btele\b|frigo|radio/, '💻'],
  [/eau|boisson|jus|biere|soda/, '🥤'],
  [/livre|papier|carton|colis/, '📦'],
];

const emojiLocal = (nom: string): string => {
  const valeur = normaliserTexte(nom);
  for (const [motif, emoji] of EMOJIS) if (motif.test(valeur)) return emoji;
  return '';
};

const iconeStockee = (item: Goods): string => {
  const valeur = trouverTexte(item, ['icon', 'emoji', 'icone', 'goodsIcon'], /icon|emoji/i);
  return valeur && valeur.length <= 8 ? valeur : '';
};

const CLE_CACHE_ICONES = 'saintjude.goodsIcons';

const lireCacheIcones = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(CLE_CACHE_ICONES) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};

const extraireEmoji = (texte: string): string =>
  texte.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u)?.[0] ?? '';

// Demande un emoji à l'IA pour les marchandises qu'aucun mot-clé ne reconnaît
function useIconesIA(noms: string[]) {
  const [icones, setIcones] = useState<Record<string, string>>(lireCacheIcones);
  const enCours = useRef(new Set<string>());
  const signature = noms.join('|');

  useEffect(() => {
    noms.forEach(async (nom) => {
      const cle = normaliserTexte(nom);
      if (!cle || icones[cle] || emojiLocal(nom) || enCours.current.has(cle)) return;
      enCours.current.add(cle);
      try {
        const reponse: unknown = await askAssistant({
          question: `Réponds uniquement par un seul emoji qui représente cette marchandise : "${nom}".`,
          context: '',
        });
        const emoji = extraireEmoji(typeof reponse === 'string' ? reponse : JSON.stringify(reponse ?? ''));
        if (!emoji) return;
        setIcones((courant) => {
          const suite = { ...courant, [cle]: emoji };
          try {
            localStorage.setItem(CLE_CACHE_ICONES, JSON.stringify(suite));
          } catch {
            // stockage indisponible : l'icône reste affichée pour cette session
          }
          return suite;
        });
      } catch {
        // L'IA est facultative : on garde l'icône par défaut
      } finally {
        enCours.current.delete(cle); // permet de réessayer au prochain changement de nom
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return icones;
}

function PastilleMarchandise({ emoji, petite = false }: { emoji: string; petite?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-amber-100 ${
        petite ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-lg'
      }`}
    >
      {emoji}
    </span>
  );
}

const exporterCsv = (lignes: string[][]) => {
  const echapper = (valeur: string) => `"${valeur.replace(/"/g, '""')}"`;
  const contenu = '\ufeff' + lignes.map((ligne) => ligne.map(echapper).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8;' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = 'marchandises.csv';
  lien.click();
  URL.revokeObjectURL(url);
};

const PAGE_SIZE = 8;

/* =========================
   Fenêtre « Ajouter paiement »
========================= */
type PaiementModalProps = {
  reservation: Reservation;
  onClose: () => void;
};

const PaiementModal = ({ reservation, onClose }: PaiementModalProps) => {
  const [montant, setMontant] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const dispatch = useDispatch();
  const cashMouvement = useSelector((state: RootState) => state.stJude.cashMouvement);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);

  const total = Number(reservation.totalPrice) || 0;
  const paye = Number(reservation.amountPaid) || 0;
  const reste = Math.max(total - paye, 0);

  // Enregistre le paiement dans le store (même logique que « Confirmer la modification » de la fenêtre de détail) :
  // - la réservation garde son userId (caissier d'origine)
  // - le mouvement de caisse est mis à jour, ou créé s'il n'existe pas encore
  const enregistrerPaiement = (montantAjoute: number) => {
    const nouveauPaye = paye + montantAjoute;
    const nouveauReste = Math.max(total - nouveauPaye, 0);
    const reservationMaj: Reservation = {
      ...reservation,
      amountPaid: nouveauPaye,
      amountToPay: nouveauReste,
      paymentStatus: nouveauPaye >= total,
    };
    const existant = cashMouvement.find(({ id }) => id === reservation.idCashMovement);

    if (existant) {
      const mouvement: CashMovement = {
        ...existant,
        credit: nouveauPaye,
        userId: currentUser ? currentUser.id : '',
        date: new Date().toISOString(),
      };
      dispatch(setCashMouvement(mouvement));
      dispatch(setReservation(reservationMaj));
    } else {
      const mouvement: CashMovement = {
        id: uuid(),
        credit: nouveauPaye,
        userId: currentUser ? currentUser.id : '',
        date: new Date().toISOString(),
        tripId: reservation.tripId,
        designation: `Paiement du client ${reservation.clientName}`,
        type: 'credit',
        debit: 0,
      };
      dispatch(setReservation({ ...reservationMaj, idCashMovement: mouvement.id }));
      dispatch(setCashMouvement(mouvement));
    }
  };

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
      enregistrerPaiement(valeur);
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
          <CardTitle className="text-[#001F3F]">Ajouter paiement</CardTitle>
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

/* =========================
   Carte de statistique (bandeau du haut)
========================= */
const TONS = {
  blue: { boite: 'bg-blue-50 border-blue-100', cercle: 'bg-blue-700', titre: 'text-blue-800', barre: 'bg-blue-600' },
  green: { boite: 'bg-green-50 border-green-100', cercle: 'bg-green-600', titre: 'text-green-700', barre: 'bg-green-600' },
  orange: { boite: 'bg-orange-50 border-orange-100', cercle: 'bg-orange-400', titre: 'text-orange-600', barre: 'bg-orange-400' },
  red: { boite: 'bg-red-50 border-red-100', cercle: 'bg-red-500', titre: 'text-red-600', barre: 'bg-red-500' },
  purple: { boite: 'bg-purple-50 border-purple-100', cercle: 'bg-purple-600', titre: 'text-purple-700', barre: 'bg-purple-500' },
} as const;

const formatPourcent = (valeur: number) => `${valeur.toFixed(1).replace('.', ',')}%`;

function CarteStat({
  ton,
  icone,
  titre,
  valeur,
  pourcent,
  pied,
}: {
  ton: keyof typeof TONS;
  icone: ReactNode;
  titre: string;
  valeur: number;
  pourcent?: number;
  pied?: ReactNode;
}) {
  const couleurs = TONS[ton];
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${couleurs.boite}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${couleurs.cercle}`}>
          {icone}
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-medium leading-tight ${couleurs.titre}`}>{titre}</p>
          <p className="text-3xl font-bold leading-tight text-blue-950">{valeur}</p>
        </div>
      </div>
      {pourcent !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
            <div className={`h-full rounded-full ${couleurs.barre}`} style={{ width: `${Math.min(pourcent, 100)}%` }} />
          </div>
          <span className={`text-xs ${couleurs.titre}`}>{formatPourcent(pourcent)}</span>
        </div>
      )}
      {pied && <div className="mt-2">{pied}</div>}
    </div>
  );
}

/* =========================
   Page
========================= */
type MarchandisePageProps = {
  // Optionnel : ouvre l'assistant IA (ex. navigation vers « Réservations multimodales »)
  onOpenAssistant?: () => void;
};

const MarchandiseManagementPage = ({ onOpenAssistant }: MarchandisePageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filtre>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<string[]>([]);
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
  // - userId vide                      → "Non attribué"
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

  // Réservations visibles selon le rôle (un Capitaine ne voit que celles de ses bateaux)
  const reservationsVisibles = useMemo(() => {
    // Réservations dont toutes les marchandises ont été supprimées (0 Ar, rien payé) : on ne les affiche plus
    const idsAvecMarchandises = new Set(allGoods.map(({ reservationId }) => reservationId));
    return allReservation.filter((reservation) => {
        const vide =
          !idsAvecMarchandises.has(reservation.id) &&
          !(Number(reservation.totalPrice) > 0) &&
          !(Number(reservation.amountPaid) > 0);
        if (vide) return false;
        if (currentUser && currentUser.role === 'Capitaine') {
          const trip = findTrip(reservation.tripId, alltrip);
          const boat = trip ? findBoat(trip.boatId, allBoat) : undefined;
          if (!boat || !boat.crew.includes(currentUser.id)) return false;
        }
        return true;
      });
  }, [allReservation, allGoods, allBoat, alltrip, currentUser]);

  const marchandisesVisibles = useMemo(() => {
    const ids = new Set(reservationsVisibles.map((reservation) => reservation.id));
    return allGoods.filter(({ reservationId }) => ids.has(reservationId));
  }, [allGoods, reservationsVisibles]);

  const marchandisesParReservation = useMemo(() => {
    const carte = new Map<string, Goods[]>();
    marchandisesVisibles.forEach((item) => {
      carte.set(item.reservationId, [...(carte.get(item.reservationId) ?? []), item]);
    });
    return carte;
  }, [marchandisesVisibles]);

  const nomsMarchandises = useMemo(
    () => Array.from(new Set(marchandisesVisibles.map(nomMarchandise).filter(Boolean))),
    [marchandisesVisibles]
  );
  const iconesIA = useIconesIA(nomsMarchandises);

  const emojiNom = (nom: string) => emojiLocal(nom) || iconesIA[normaliserTexte(nom)] || '📦';
  // Le NOM ACTUEL de la marchandise l'emporte : renommer une marchandise met à jour son icône
  const emojiMarchandise = (item: Goods) => {
    const nom = nomMarchandise(item);
    return emojiLocal(nom) || iconesIA[normaliserTexte(nom)] || iconeStockee(item) || '📦';
  };

  // Photo du premier bateau qui en possède une (bannière de droite)
  const photoBanniere = useMemo(() => {
    for (const bateau of allBoat) {
      const photo = photoBateau(bateau);
      if (photo) return photo;
    }
    return '';
  }, [allBoat]);

  const filteredReservations = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return reservationsVisibles.filter((reservation) => {
      if (!correspondAuFiltre(reservation, statusFilter)) return false;

      const trip = findTrip(reservation.tripId, alltrip);
      const noms = (marchandisesParReservation.get(reservation.id) ?? []).map(nomMarchandise).join(' ');

      return (
        (reservation.clientName ?? '').toLowerCase().includes(search) ||
        (reservation.destName ?? '').toLowerCase().includes(search) ||
        (reservation.id ?? '').toLowerCase().includes(search) ||
        noms.toLowerCase().includes(search) ||
        getNomCaissier(reservation.userId).toLowerCase().includes(search) ||
        (trip?.from ?? '').toLowerCase().includes(search) ||
        (trip?.to ?? '').toLowerCase().includes(search)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationsVisibles, statusFilter, searchTerm, alltrip, marchandisesParReservation, allUser, currentUser]);

  /* ----- Statistiques (calculées sur les marchandises visibles) ----- */
  const stats = useMemo(() => {
    const statutDe = new Map(reservationsVisibles.map((r) => [r.id, getStatutLigne(r).cle]));
    const total = marchandisesVisibles.length;
    const compter = (cle: StatutReservation) =>
      marchandisesVisibles.filter((item) => statutDe.get(item.reservationId) === cle).length;
    const transit = compter('CONFIRMEE');
    const attente = compter('EN_ATTENTE');
    const livrees = compter('TERMINEE');
    const pct = (valeur: number) => (total ? (valeur * 100) / total : 0);

    const parType = new Map<string, number>();
    marchandisesVisibles.forEach((item) => {
      const nom = nomMarchandise(item);
      if (nom) parType.set(nom, (parType.get(nom) ?? 0) + 1);
    });
    const types = Array.from(parType.entries()).sort((a, b) => b[1] - a[1]);

    const valeurTotale = reservationsVisibles
      .filter((r) => normaliserStatut(r.status as string | undefined) !== 'ANNULEE')
      .reduce((somme, r) => somme + (Number(r.totalPrice) || 0), 0);

    return {
      total,
      transit,
      attente,
      livrees,
      transitPct: pct(transit),
      attentePct: pct(attente),
      livreesPct: pct(livrees),
      types,
      valeurTotale,
    };
  }, [marchandisesVisibles, reservationsVisibles]);

  const compteurFiltre = (filtre: Filtre) =>
    reservationsVisibles.filter((reservation) => correspondAuFiltre(reservation, filtre)).length;

  /* ----- Pagination ----- */
  const pageCount = Math.max(1, Math.ceil(filteredReservations.length / PAGE_SIZE));
  const pageCourante = Math.min(page, pageCount);
  const lignes = filteredReservations.slice((pageCourante - 1) * PAGE_SIZE, pageCourante * PAGE_SIZE);
  const debut = filteredReservations.length === 0 ? 0 : (pageCourante - 1) * PAGE_SIZE + 1;
  const fin = Math.min(pageCourante * PAGE_SIZE, filteredReservations.length);

  const toutesSelectionnees = lignes.length > 0 && lignes.every((reservation) => selection.includes(reservation.id));

  const basculerSelection = (id: string) =>
    setSelection((courant) => (courant.includes(id) ? courant.filter((item) => item !== id) : [...courant, id]));

  const basculerPage = () =>
    setSelection((courant) =>
      toutesSelectionnees
        ? courant.filter((id) => !lignes.some((reservation) => reservation.id === id))
        : Array.from(new Set([...courant, ...lignes.map((reservation) => reservation.id)]))
    );

  const basculerFiltre = (filtre: Exclude<Filtre, 'all'>) => {
    setStatusFilter((courant) => (courant === filtre ? 'all' : filtre));
    setPage(1);
  };

  const onExport = () => {
    const source = selection.length
      ? filteredReservations.filter((reservation) => selection.includes(reservation.id))
      : filteredReservations;
    const entete = [
      'Voyage',
      'Marchandise',
      'Destination',
      'Quantité',
      'Poids total (kg)',
      'Prix total (Ar)',
      'Montant payé (Ar)',
      'Montant restant (Ar)',
      'Statut',
      'Caissier',
    ];
    const donnees = source.map((reservation) => {
      const trip = findTrip(reservation.tripId, alltrip);
      const noms = (marchandisesParReservation.get(reservation.id) ?? []).map(nomMarchandise).join(', ');
      return [
        trip ? `${formatCityName(trip.from)} → ${formatCityName(trip.to)}` : 'Voyage inconnu',
        noms,
        trip ? formatCityName(trip.to) : '',
        String(Number(reservation.quantity)),
        String(reservation.weight ?? ''),
        String(reservation.totalPrice ?? ''),
        String(reservation.amountPaid ?? ''),
        String(reservation.amountToPay ?? ''),
        getStatutLigne(reservation).libelle,
        getNomCaissier(reservation.userId),
      ];
    });
    exporterCsv([entete, ...donnees]);
  };

  const onShowDetailGoodsModal = (reservation: Reservation) => {
    setCurrentReservation(reservation);
    setCurrentGoods(allGoods.filter(({ reservationId }) => reservationId === reservation.id));
    setShowDetailGoodsModal(true);
  };

  useEffect(() => {
    setIdReservation(uuid());
  }, [showAddGoodsModal]);

  return (
    <div className="min-h-screen relative text-gray-900 space-y-5">
      {/* ===== En-tête ===== */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white shadow-md">
          <Ship className="h-7 w-7" />
        </span>
        <div>
          <h2 className="text-2xl font-bold text-blue-900">Gestion des Marchandises</h2>
          <p className="text-sm text-muted-foreground">Suivi et gestion des marchandises transportées</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* ===== Cartes de statistiques ===== */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CarteStat
              ton="blue"
              icone={<Ship className="h-6 w-6" />}
              titre="Total marchandises"
              valeur={stats.total}
              pied={<span className="text-xs text-muted-foreground">{reservationsVisibles.length} réservation(s)</span>}
            />
            <CarteStat
              ton="green"
              icone={<Package className="h-6 w-6" />}
              titre="En transit"
              valeur={stats.transit}
              pourcent={stats.transitPct}
            />
            <CarteStat
              ton="orange"
              icone={<Clock className="h-6 w-6" />}
              titre="En attente"
              valeur={stats.attente}
              pourcent={stats.attentePct}
            />
            <CarteStat
              ton="red"
              icone={<CheckCircle2 className="h-6 w-6" />}
              titre="Livrées"
              valeur={stats.livrees}
              pourcent={stats.livreesPct}
            />
            <CarteStat
              ton="purple"
              icone={<Layers className="h-6 w-6" />}
              titre="Types différents"
              valeur={stats.types.length}
              pied={
                <span className="block truncate text-xs text-muted-foreground">
                  {stats.types
                    .slice(0, 3)
                    .map(([nom]) => nom)
                    .join(', ')}
                  {stats.types.length > 3 ? '…' : ''}
                </span>
              }
            />
          </div>

          {/* ===== Liste des marchandises ===== */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white">
                    <Package className="h-6 w-6" />
                  </span>
                  <h3 className="text-lg font-semibold text-blue-900">
                    Liste des marchandises ({filteredReservations.length})
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full min-w-[220px] sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                    <Input
                      placeholder="Rechercher une marchandise, client ou destination..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={() => setShowFilters((courant) => !courant)}>
                    <Filter className="mr-2 h-4 w-4" /> Filtres
                  </Button>
                  <Button variant="outline" onClick={onExport} disabled={filteredReservations.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Exporter
                  </Button>
                  <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => setShowAddGoodsModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Ajouter une marchandise
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="flex items-center gap-3 border-t bg-blue-50/50 px-4 py-3">
                  <span className="text-sm">Statut</span>
                  <Select
                    value={statusFilter}
                    onValueChange={(valeur) => {
                      setStatusFilter(valeur as Filtre);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-56 bg-white">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="paid">Payé</SelectItem>
                      <SelectItem value="partial">Partiellement payé</SelectItem>
                      <SelectItem value="credit">Crédit (en attente)</SelectItem>
                      <SelectItem value="delivered">Livrée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="overflow-x-auto px-4">
                <Table className="[&_td]:px-2 [&_th]:px-2">
                  <TableHeader>
                    <TableRow className="bg-blue-800 hover:bg-blue-800 [&>th]:text-white">
                      <TableHead className="w-10 rounded-l-lg">
                        <input
                          type="checkbox"
                          aria-label="Tout sélectionner"
                          checked={toutesSelectionnees}
                          onChange={basculerPage}
                        />
                      </TableHead>
                      <TableHead>Voyage</TableHead>
                      <TableHead>Marchandise</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Poids total (kg)</TableHead>
                      <TableHead className="text-right">Prix total</TableHead>
                      <TableHead className="text-right">Montant payé</TableHead>
                      <TableHead className="text-right">Montant restant</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                      <TableHead className="rounded-r-lg text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map((reservation) => {
                      const trip = findTrip(reservation.tripId, alltrip);
                      const statut = getStatutLigne(reservation);
                      const etatPaiement = getEtatPaiement(reservation);
                      const marchandises = marchandisesParReservation.get(reservation.id) ?? [];
                      const premierItem = marchandises[0];
                      const premier = premierItem ? nomMarchandise(premierItem) : '';
                      const emoji = premierItem ? emojiMarchandise(premierItem) : '📦';
                      const bateau = trip ? findBoat(trip.boatId, allBoat) : undefined;
                      const photo = photoBateau(bateau);
                      const nomBateau = trouverTexte(bateau, ['name'], /^name$/i);
                      const supplement = marchandises.length > 1 ? ` +${marchandises.length - 1}` : '';
                      return (
                        <TableRow
                          key={reservation.id}
                          title={`Caissier : ${getNomCaissier(reservation.userId)}`}
                          className="cursor-pointer hover:bg-blue-50/60"
                          onClick={() => onShowDetailGoodsModal(reservation)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label="Sélectionner la ligne"
                              checked={selection.includes(reservation.id)}
                              onChange={() => basculerSelection(reservation.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {photo ? (
                                <img
                                  src={photo}
                                  alt={nomBateau || 'Bateau'}
                                  className="h-10 w-14 shrink-0 rounded-md object-cover"
                                />
                              ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                  <Ship className="h-5 w-5" />
                                </span>
                              )}
                              {trip ? (
                                <div>
                                  <p className="whitespace-nowrap font-medium">
                                    {formatCityName(trip.from)} → {formatCityName(trip.to)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(trip.depart).toLocaleDateString('fr-FR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                    {nomBateau ? ` · ${nomBateau}` : ''}
                                  </p>
                                </div>
                              ) : (
                                <span>Voyage inconnu</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PastilleMarchandise emoji={emoji} />
                              <div>
                                <p className="font-semibold text-blue-900">
                                  {premier ? `${premier}${supplement}` : 'Marchandise'}
                                </p>
                                <p className="text-xs text-gray-500">{reservation.clientName}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p>{trip ? formatCityName(trip.to) : '—'}</p>
                            <p className="text-xs text-gray-500">{reservation.destName}</p>
                          </TableCell>
                          <TableCell className="text-right">{Number(reservation.quantity)}</TableCell>
                          <TableCell className="text-right">{reservation.weight}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium">
                            {formatCurrency(reservation.totalPrice)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {formatCurrency(reservation.amountPaid)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium">
                            {formatCurrency(reservation.amountToPay)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className={`gap-1 whitespace-nowrap rounded-full ${statut.classe}`}>
                              <statut.Icon className="h-3.5 w-3.5" />
                              {statut.libelle}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                title="Voir"
                                aria-label="Voir"
                                className="h-8 w-8 bg-blue-600 text-white hover:bg-blue-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onShowDetailGoodsModal(reservation);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {etatPaiement === 'PARTIEL' && (
                                <Button
                                  size="icon"
                                  aria-label="Ajouter paiement"
                                  className="h-8 w-8 bg-orange-500 text-white hover:bg-orange-600"
                                  title="Ajouter paiement"
                                  onClick={(e) => {
                                    e.stopPropagation(); // n'ouvre pas le détail de la ligne
                                    setReservationPaiement(reservation);
                                  }}
                                >
                                  <CreditCard className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {filteredReservations.length === 0 && (
                <div className="py-8 text-center">
                  <Package className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                  <p className="text-gray-500">Aucune réservation trouvée</p>
                </div>
              )}

              <div className="flex flex-col items-center justify-between gap-3 p-4 text-sm text-muted-foreground sm:flex-row">
                <span>
                  {filteredReservations.length === 0
                    ? 'Aucune marchandise'
                    : `Affichage de ${debut} à ${fin} sur ${filteredReservations.length} marchandises`}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={pageCourante === 1}
                    onClick={() => setPage(pageCourante - 1)}
                    aria-label="Page précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((numero) => (
                    <Button
                      key={numero}
                      size="icon"
                      variant={numero === pageCourante ? 'default' : 'outline'}
                      className={`h-8 w-8 ${numero === pageCourante ? 'bg-blue-700 hover:bg-blue-800' : ''}`}
                      onClick={() => setPage(numero)}
                    >
                      {numero}
                    </Button>
                  ))}
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={pageCourante === pageCount}
                    onClick={() => setPage(pageCourante + 1)}
                    aria-label="Page suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== Colonne de droite ===== */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 to-blue-800 p-4 text-white shadow-md">
            {photoBanniere ? (
              <>
                <img src={photoBanniere} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/70 to-transparent" />
              </>
            ) : (
              <Ship className="absolute -right-2 -top-2 h-24 w-24 text-white/15" />
            )}
            <p className="relative text-lg font-semibold leading-snug">
              Les marchandises
              <br />
              au cœur de votre voyage
            </p>
            <p className="relative mt-1 text-sm text-blue-100">Un transport sûr, rapide et fiable.</p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-blue-900">
                <Filter className="h-5 w-5" /> Filtres rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-blue-900">Statut</p>
                <div className="space-y-2">
                  {filtresRapides.map(({ cle, libelle, Icon, couleur }) => (
                    <label key={cle} className="flex cursor-pointer items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={statusFilter === cle}
                          onChange={() => basculerFiltre(cle)}
                        />
                        <Icon className={`h-4 w-4 ${couleur}`} /> {libelle}
                      </span>
                      <span className="font-medium text-blue-900">{compteurFiltre(cle)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-blue-900">Type de marchandise</p>
                <div className="space-y-2">
                  {stats.types.slice(0, 5).map(([nom, nombre]) => (
                    <div key={nom} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <PastilleMarchandise emoji={emojiNom(nom)} petite /> {nom}
                      </span>
                      <span className="font-medium text-blue-900">{nombre}</span>
                    </div>
                  ))}
                  {stats.types.length > 5 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-600" /> Autres
                      </span>
                      <span className="font-medium text-blue-900">
                        {stats.types.slice(5).reduce((somme, [, nombre]) => somme + nombre, 0)}
                      </span>
                    </div>
                  )}
                  {stats.types.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun type de marchandise.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/60">
            <CardContent className="space-y-1 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <BarChart3 className="h-4 w-4" /> Statistiques
              </p>
              <p className="text-xs text-muted-foreground">Valeur totale des marchandises</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.valeurTotale)}</p>
            </CardContent>
          </Card>

          <div className="rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 p-4 text-white shadow-md">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Bot className="h-7 w-7" />
              </span>
              <div>
                <p className="text-lg font-semibold">Besoin d’aide ?</p>
                <p className="text-sm text-blue-100">L’assistant IA est disponible pour vos marchandises.</p>
              </div>
            </div>
            <Button
              className="mt-4 w-full bg-white text-blue-800 hover:bg-blue-50"
              onClick={onOpenAssistant}
              disabled={!onOpenAssistant}
            >
              <ChevronRight className="mr-2 h-4 w-4" /> Ouvrir l’assistant
            </Button>
          </div>
        </div>
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