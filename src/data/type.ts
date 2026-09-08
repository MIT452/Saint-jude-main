// ENUMS
export type Role = "Propriétaire" | "Capitaine" | "Gestionnaire" | "Agent"| string;
export type Permission =
  | "dashboard:read"
  | "merchandise:manage"
  | "caisse:manage"
  | "boat:manage"
  | "trajets:manage"
  | "users:manage"
  | "profile:read"
  | "fueldManage:manage";
  
export const permissionLabels: Record<Permission, string> = {
  "dashboard:read": "Tableau de Bord",
  "merchandise:manage": "Reservation",
  "caisse:manage": "Gestion Caisse",
  "boat:manage": "Gestion de Bateau",
  "trajets:manage": "Trajets",
  "users:manage": "Équipe",
  "profile:read": "Profil",
  "fueldManage:manage": "Carburant",
};
export type statusTrip = "Encours" | "Arriver" | "Prévu";
export type EtatBoat = "En construction" | "En service" | "En maintenance" | "En panne" | "Désarmé" | "Hors service"

export enum TABLE_DATA_BASE {
  USER = "user",
  GOODS = "goods",
  RESERVATION = "reservations",
  TRIP = 'trips',
  BOAT = "boats",
  CASHMOVEMENT = "cashmovements",
  FUELCONSUMPTION = "fuelconsumptions"
}
// ENTITY: User
export interface User {
  id: string;
  name: string;
  lastName: string;
  password: string;
  email: string;
  tel: string;
  role: Role;
  permissions?: Permission[];
  // Pour le surveillance qui fait l'actions
  userId?: string;
}

// ENTITY: Goods
export interface Goods {
  id: string;
  itemName: string; // nomMarchandise
  types: string; // typeMarchandise 'fragile','General','agricole'
  embarkDate: string; // embarquement
  quantity: number; // Qte
  unitWeight: number; // Pds U
  totalWeight: number; // Pds T
  unitPrice: number; // Prix U
  totalPrice: number; // Prix Total
  amountToPay: number; // Montant à Payer
  // payer: boolean;
  status: boolean;
  state: statusTrip; // etat
  reservationId: string; // idReservation
  numberLot: string;
  userId: string; // idUser
  tripId: string;
}

// ENTITY: Reservation
export interface Reservation {
  id: string;
  clientName: string;
  clientTel: string;
  clientAdresse: string;
  destName: string;
  destTel: string;
  destAdresse: string;
  status: string;
  date: string;
  quantity: number; // Qte
  weight: number; // poids
  totalPrice: number; // Prix Total
  amountPaid: number; // Montant Payé
  amountToPay: number; // Montant à Payer
  paymentStatus: boolean; // statutPaiement
  tripId: string;
  userId: string;
  idCashMovement: string
}

// ENTITY: Trip
export interface Trip {
  id: string;
  boatId: string;
  depart: string;
  arrive: string;
  from: string;
  to: string;
  status: statusTrip;
  // pour le survellance
  userId: string;
}

// ENTITY: Boat
export interface Boat {
  id: string;
  name: string;
  capacity: number;
  state: EtatBoat;
  crew: string[]; // équipage
  // pour le survellance
  userId: string;
}

// ENTITY: CashMovement
export interface CashMovement {
  id: string;
  designation: string;
  credit: number;
  debit: number;
  tripId?: string;
  type: "debit" | "credit";
  goodsId?: string; // marchandiseId
  userId: string;
  date: string;
}

// ENTITY: FuelConsumption
export interface FuelConsumption {
  id: string;
  tripId: string;
  quantity: number;          // quantité consommée
  fuelType: string;
  fuelPrice: number;        // prix unitaire
  cost: number;             // coût total
  userId: string

  remainingFuel?: number;    // stock restant
  createdAt?: string;
}
export interface AuditLog {
  _id: string;
  collectionName: "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";   // ex: "Boat"
  documentId: string;       // id du document modifié
  action: "create" | "update" | "delete";
  userId: string;          // qui a fait l’action
  before?: User | Goods | Reservation | Trip | Boat | CashMovement | FuelConsumption;             // ancienne valeur (pour update/delete)
  after: User | Goods | Reservation | Trip | Boat | CashMovement | FuelConsumption;              // nouvelle valeur (pour create/update)
  createdAt: Date;
}

export interface ReservationFormData {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  cargoType: string;
  boxes: string;
  weight: number;
  volume: number;
  description: string;
  dateOfGoodsEntry: string;
  boardingDate: string;
  box: string;
  goods: string;
  quantity: number;
  unitWeight: number;
  totalWeight: number;
  unitPrice: number;
  totalPrice: number;
  amountPaidByClient: number;
  amountToBePaidByClient: number;
  paymentStatus: boolean;
  rest: number;
  tripId: string;
}
export interface RevenueDataSets {
  hebdomadaire: {
    periode: string;
    revenus: number;
    date: string;
  }[];
  mensuelle: {
    periode: string;
    revenus: number;
    date: string;
  }[];
  trimestrielle: {
    periode: string;
    revenus: number;
    date: string;
  }[];
  semestrielle: {
    periode: string;
    revenus: number;
    date: string;
  }[];
  annuelle: {
    periode: string;
    revenus: number;
    date: string;
  }[];
}
