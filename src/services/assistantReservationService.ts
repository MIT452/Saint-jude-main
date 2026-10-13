// src/services/assistantReservationService.ts
// Branche l'assistant IA sur le backend : vérification (trajet, capacité, tarif)
// puis enregistrement réel de la réservation.
import axios from "axios";
import { pluralUnit, type ReservationDraft, type ReservationQuote } from "../components/reservationParser";
import { createReservation as saveInList, type ReservationRecord } from "./reservationService";

/* =========================================================
   Adresse du backend : la même que data/intelligenceService.ts
   VITE_API_URL contient déjà « /api » (ex. http://localhost:3000/api) :
   les chemins ci-dessous commencent donc par /ai/..., sans répéter /api.
========================================================= */
const API_URL: string =
  ((import.meta as any).env?.VITE_API_URL as string | undefined) ||
  "https://saint-jude-back.onrender.com/api";

// 60 s : l'hébergement gratuit peut mettre ~50 s à se réveiller après une période d'inactivité
const api = axios.create({
  baseURL: API_URL.replace(/\/+$/, ""),
  withCredentials: true,
  timeout: 60_000,
});

const messageOf = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (error.response?.status === 401) return "session expirée, reconnectez-vous";
    if (error.response?.status === 429) return "trop de requêtes, réessayez dans une minute";
    if (error.code === "ECONNABORTED") return "le serveur met trop de temps à répondre";
    return error.message;
  }
  return error instanceof Error ? error.message : "erreur inconnue";
};

const PASSENGER_MESSAGE =
  "Le tarif d’un billet passager n’est pas encore défini dans le système : utilisez l’onglet « Réservation » pour un billet passager.";

/* =========================================================
   verifyReservation : appelé avant le récapitulatif
========================================================= */
export async function verifyAssistantReservation(draft: ReservationDraft): Promise<ReservationQuote> {
  if (!draft.depart || !draft.arrivee || !draft.date) {
    throw new Error("trajet ou date manquant");
  }
  // Seules les marchandises ont un tarif (au kg) : un billet passager n'est pas encore pris en charge
  if (!draft.poidsTotalKg || !draft.quantite) {
    return { available: false, message: PASSENGER_MESSAGE };
  }

  try {
    const { data } = await api.post<ReservationQuote>("/ai/verify", {
      depart: draft.depart,
      arrivee: draft.arrivee,
      date: draft.date,
      poidsTotalKg: draft.poidsTotalKg,
      quantite: draft.quantite,
    });
    return data;
  } catch (error) {
    throw new Error(messageOf(error));
  }
}

/* =========================================================
   createReservation : appelé après « Oui, confirmer »
   1) le backend recontrôle, enregistre la réservation (statut EN_ATTENTE) et la ligne de marchandise
   2) la réservation est ajoutée à la liste affichée dans « Tableau des réservations »
========================================================= */
interface ApiReservation {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  boatId: string;
  boatName: string;
  departure: string;
  destination: string;
  date: string;
  quantity: number;
  unit: string;
  cargoName: string;
  unitWeightKg: number;
  totalWeightKg: number;
  unitPrice: number;
  totalPrice: number;
}

export async function createAssistantReservation(draft: ReservationDraft): Promise<ReservationRecord> {
  if (!draft.depart || !draft.arrivee || !draft.date) {
    throw new Error("trajet ou date manquant");
  }
  if (!draft.poidsTotalKg || !draft.quantite) {
    throw new Error(PASSENGER_MESSAGE);
  }

  let saved: ApiReservation;
  try {
    const { data } = await api.post<{ ok: boolean; reservation: ApiReservation }>("/ai/reserve", {
      depart: draft.depart,
      arrivee: draft.arrivee,
      date: draft.date,
      poidsTotalKg: draft.poidsTotalKg,
      quantite: draft.quantite,
      marchandise: draft.marchandise,
      unite: draft.unite,
    });
    saved = data.reservation;
  } catch (error) {
    throw new Error(messageOf(error));
  }

  // Colonne « Qté » du tableau = quantité de colis ; colonne « Marchandise » = nom puis détail
  const record: ReservationRecord = {
    id: saved.id,
    clientName: saved.clientName,
    clientPhone: saved.clientPhone,
    clientEmail: saved.clientEmail,
    departure: saved.departure,
    destination: saved.destination,
    date: saved.date,
    boatId: saved.boatId,
    boatName: saved.boatName,
    passengers: saved.quantity,
    cargo: saved.unit ? `${saved.quantity} ${pluralUnit(saved.unit, saved.quantity)}` : String(saved.quantity),
    cargoType: saved.cargoName,
    unitWeightKg: saved.unitWeightKg,
    totalWeightKg: saved.totalWeightKg,
    unitPrice: saved.unitPrice,
    totalPrice: saved.totalPrice,
    communication: "none",
    status: "En attente de confirmation",
    createdAt: new Date().toISOString(),
    source: "assistant-ia",
  };

  // La réservation existe déjà côté serveur : un souci de stockage local ne doit pas la faire croire non enregistrée
  try {
    await saveInList(record);
  } catch {
    /* affichage uniquement */
  }
  return record;
}