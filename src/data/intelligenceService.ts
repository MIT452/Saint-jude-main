import axios from "axios";
import type { ReservationRecord } from "../services/reservationService";
import type { ReservationDraft, ReservationQuote } from "../components/AssistantChat";

// Configuration de la base URL avec fallback production
const API = import.meta.env.VITE_API_URL || "https://saint-jude-back.onrender.com/api";

// Config globale Axios pour inclure les cookies de session
const axiosClient = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Erreurs lisibles : le chat affiche le message renvoyé par le backend
// (ex. « Capacité insuffisante ») au lieu de « Request failed with status code 400 ».
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    const message =
      (typeof data === "string" && data) ||
      data?.message ||
      data?.error ||
      (error?.code === "ERR_NETWORK" ? "serveur injoignable" : error?.message) ||
      "erreur inconnue";
    return Promise.reject(new Error(String(message)));
  },
);

/* ==========================================================================
   TYPES & INTERFACES
   ========================================================================== */

export interface PositionPayload {
  boatId: string;
  latitude: number;
  longitude: number;
  speed?: number;
}

export interface OptimizationPayload {
  depart: string;
  escales: string[];
}

export interface ChatPayload {
  question: string;
  context?: string;
}

// Devise : adaptez ce libellé à celui utilisé par formatCurrency (Tools/Tools)
const CURRENCY_LABEL = "Ariary";

export const createReservationAnnouncement = (reservation: ReservationRecord): string =>
  `Réservation confirmée pour le client ${reservation.clientName}. Voyage de ${reservation.departure} vers ${reservation.destination}, le ${reservation.date}. Bateau ${reservation.boatName}. Passagers : ${reservation.passengers}. Marchandise : ${reservation.cargoType}, ${reservation.cargo}. Poids total : ${reservation.totalWeightKg} kilogrammes. Prix total : ${reservation.totalPrice} ${CURRENCY_LABEL}.`;

export interface MLPredictionPayload {
  boatId: string;
  destination?: string;
}

export interface WeatherPayload {
  lat: number;
  lng: number;
}

/* ==========================================================================
   0. SERVICE RÉSERVATION (vérification, création, annulation)
   Le backend reste l'autorité : il vérifie, calcule le prix et enregistre.
   ⚠ Endpoints proposés : adaptez-les aux routes réelles de saint-jude-back.
   ========================================================================== */

/** Vérifie trajet + disponibilité et renvoie le prix réel (rien n'est enregistré). */
export const verifyReservationRequest = async (draft: ReservationDraft): Promise<ReservationQuote> => {
  const { data } = await axiosClient.post(`/reservations/verify`, draft);
  return data;
};

/** Crée la réservation après confirmation explicite du client. */
export const createReservationRequest = async (draft: ReservationDraft): Promise<ReservationRecord> => {
  const { data } = await axiosClient.post(`/reservations`, draft);
  return data;
};

/** Passe la réservation à « Annulée » (les paiements sont conservés). */
export const cancelReservationRequest = async (reservationId: string): Promise<ReservationRecord> => {
  const { data } = await axiosClient.post(`/reservations/${encodeURIComponent(reservationId)}/cancel`);
  return data;
};

/* ==========================================================================
   1. SERVICE GPS & POSITIONS TEMPS RÉEL
   ========================================================================== */

export const getLatestPosition = async (boatId: string) => {
  const { data } = await axiosClient.get(`/positions/${boatId}/latest`);
  return data;
};

export const postPosition = async (position: PositionPayload) => {
  const { data } = await axiosClient.post(`/positions`, position);
  return data;
};

/* ==========================================================================
   2. SERVICE OPTIMISATION DE ROUTE
   ========================================================================== */

export const optimizeRoute = async (payload: OptimizationPayload) => {
  const { data } = await axiosClient.post(`/optimization/order`, payload);
  return data;
};

export const optimizePath = async (depart: string, arrivee: string) => {
  const { data } = await axiosClient.get(`/optimization/path`, {
    params: { depart, arrivee },
  });
  return data;
};

export const getOptimizationPath = async (depart: string, arrivee: string) =>
  optimizePath(depart, arrivee);

/* ==========================================================================
   3. SERVICE IA & AGENTS MULTI-TÂCHES
   ========================================================================== */

export const askAssistant = async (payload: ChatPayload) => {
  const { data } = await axiosClient.post(`/ai/chat`, payload);
  return data;
};

export const tapRag = async (query: string) => {
  const { data } = await axiosClient.post(`/ai/rag`, { query });
  return data;
};

export const selectTools = async (question: string) => {
  const { data } = await axiosClient.post(`/ai/jit`, { question });
  return data;
};

export const runMultiAgent = async (question: string) => {
  const { data } = await axiosClient.post(`/ai/multi-agent`, { question });
  return data;
};

export const evaluateAnswer = async (answer: string, expected?: string) => {
  const { data } = await axiosClient.post(`/ai/evaluate`, { answer, expected });
  return data;
};

/* ==========================================================================
   4. SERVICE CAPACITÉS & MONITORING IA
   ========================================================================== */

export const classifyIntent = async (message: string) => {
  const { data } = await axiosClient.post(`/ai-capabilities/classify`, { message });
  return data;
};

export const getCapabilitiesStatus = async () => {
  const { data } = await axiosClient.get(`/ai-capabilities/status`);
  return data;
};

export const getAiStatus = async () => {
  const { data } = await axiosClient.get(`/ai/status`);
  return data;
};

/* ==========================================================================
   5. SERVICE MÉTÉO & PRÉDICTIONS ML (AJOUTS D'INTÉGRATION)
   ========================================================================== */

export const getWeatherForecast = async (coords: WeatherPayload) => {
  const { data } = await axiosClient.get(`/weather/forecast`, { params: coords });
  return data;
};

export const getMLPredictions = async (payload: MLPredictionPayload) => {
  const { data } = await axiosClient.post(`/ml/predict`, payload);
  return data;
};

/* ==========================================================================
   6. CONFIGURATION WEBSOCKET ORIGIN
   ========================================================================== */

export const getRealtimeOrigin = (): string => {
  return import.meta.env.VITE_SOCKET_URL || "https://saint-jude-back.onrender.com";
};