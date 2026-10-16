// Service d'analyse : appelle les routes /api/analytics/* du backend Saint-Jude

const API_URL: string = import.meta.env.VITE_API_URL ?? "https://saint-jude-back.onrender.com/api";

export interface CashStats {
  credits: number;
  debits: number;
  net: number;
  daily: { day: string; credits: number; debits: number }[];
}

export interface FuelByBoat {
  boat: string;
  liters: number;
  cost: number;
}

export interface FuelByTrip {
  trip: string;
  liters: number;
  cost: number;
}

export interface ReservationStats {
  byStatus: { status: string; total: number }[];
  clients: number;
  cancelled: number;
  places: { id: string; trip: string; boat: string; capacity: number; places_left: number }[];
}

export interface GoodsStat {
  good: string;
  quantity: number;
  revenue: number;
  weight: number;
  movements: number;
}

async function get<T>(path: string, from: string, to: string): Promise<T> {
  const response = await fetch(
    `${API_URL}/analytics/${path}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { credentials: "include" } // cookie de session sj_session
  );
  if (!response.ok) {
    throw new Error(`Erreur ${response.status} sur /analytics/${path}`);
  }
  return (await response.json()) as T;
}

export const getCash = (from: string, to: string) => get<CashStats>("cash", from, to);
export const getFuelByBoat = (from: string, to: string) => get<FuelByBoat[]>("fuel/by-boat", from, to);
export const getFuelByTrip = (from: string, to: string) => get<FuelByTrip[]>("fuel/by-trip", from, to);
export const getReservationStats = (from: string, to: string) =>
  get<ReservationStats>("reservations", from, to);
export const getGoodsStats = (from: string, to: string) => get<GoodsStat[]>("goods", from, to);