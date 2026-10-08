export type ReservationStatus = "En attente de confirmation" | "Confirmée" | "Annulée";
export type NotificationChannel = "whatsapp" | "email" | "both" | "none";

export interface ReservationRecord {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  departure: string;
  destination: string;
  date: string;
  boatId: string;
  boatName: string;
  passengers: number;
  cargo: string;
  cargoType: string;
  unitWeightKg: number;
  totalWeightKg: number;
  unitPrice: number;
  totalPrice: number;
  communication: NotificationChannel;
  status: ReservationStatus;
  createdAt: string;
  source: string;
}

const STORAGE_KEY = "saint-jude-reservations";

const readReservations = (): ReservationRecord[] => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as ReservationRecord[] : [];
  } catch {
    return [];
  }
};

export const createReservation = async (reservation: ReservationRecord): Promise<ReservationRecord> => {
  const current = readReservations();
  const next = [reservation, ...current.filter((item) => item.id !== reservation.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return reservation;
};

export const getReservations = async (): Promise<ReservationRecord[]> => readReservations();

export const updateReservationStatus = async (
  reservationId: string,
  status: ReservationStatus
): Promise<ReservationRecord> => {
  const current = readReservations();
  const updated = current.map((item) => item.id === reservationId ? { ...item, status } : item);
  // Correctif : sans cette ligne, le nouveau statut n'était jamais enregistré.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated.find((item) => item.id === reservationId) as ReservationRecord;
};

export const deleteReservation = async (reservationId: string): Promise<void> => {
  const current = readReservations().filter((item) => item.id !== reservationId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
};