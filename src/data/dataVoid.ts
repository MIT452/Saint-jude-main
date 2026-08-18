import {
  Boat,
  CashMovement,
  FuelConsumption,
  Goods,
  Reservation,
  RevenueDataSets,
  Trip,
  User,
} from "./type";
export const userVoid: User = {
  id: "",
  name: "Inconnu",
  lastName: "",
  password: "",
  email: "",
  tel: "",
  role: "Capitaine",
};
export const tripVoid: Trip = {
  arrive: "",
  boatId: "",
  depart: "",
  from: "",
  id: "",
  status: "Arriver",
  to: "",
};
export const boatVoid: Boat = {
  capacity: 0,
  crew: [],
  id: "",
  name: "",
  state: "En service",
};
export const goodVoid: Goods = {
  amountToPay: 0,
  embarkDate: "",
  id: "",
  itemName: "",
  numberLot: "",
  quantity: 0,
  reservationId: "",
  state: "Arriver",
  status: false,
  totalPrice: 0,
  totalWeight: 0,
  tripId: "",
  types: "",
  unitPrice: 0,
  unitWeight: 0,
  userId: "",
};
export const formeReservationVoid = {
  senderName: "",
  senderPhone: "",
  senderAddress: "",
  recipientName: "",
  recipientPhone: "",
  recipientAddress: "",
  cargoType: "",
  boxes: "",
  weight: 0,
  volume: 0,
  description: "",
  dateOfGoodsEntry: "",
  boardingDate: "",
  box: "",
  goods: "",
  quantity: 0,
  unitWeight: 0,
  totalWeight: 0,
  unitPrice: 0,
  totalPrice: 0,
  amountToBePaidByClient: 0,
  amountPaidByClient: 0,
  tripId: "",
  paymentStatus: false,
  rest: 0,
};
export const reservationVoid: Reservation = {
  id: "",
  clientName: "",
  clientTel: "",
  clientAdresse: "",
  destName: "",
  destTel: "",
  destAdresse: "",
  status: "",
  date: "",
  quantity: 0, // Qte
  weight: 0, // poids
  tripId: "",
  totalPrice: 0, // Prix Total
  amountPaid: 0, // Montant Payé
  amountToPay: 0, // Montant à Payer
  paymentStatus: false, // statutPaiement
  // numberLot : '',
  userId: "",
  idCashMovement: "",
};
export const cashMouvementVoid: CashMovement = {
  credit: 0,
  date: "",
  debit: 0,
  designation: "",
  goodsId: "",
  id: "",
  userId: "",
  tripId: "",
  type: "debit",
};
export const fuelVoid: FuelConsumption = {
  cost: 0,
  fuelPrice: 0,
  fuelType: "",
  userId: "",
  id: "",
  quantity: 0,
  tripId: "",
};
export const revenueDataSetsVoid: RevenueDataSets = {
  hebdomadaire: [],
  mensuelle: [],
  trimestrielle: [],
  semestrielle: [],
  annuelle: [],
};
