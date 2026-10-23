export type ReservationStatus = "En attente de confirmation" | "Confirmée" | "Annulée";
export type NotificationChannel = "whatsapp" | "email" | "both" | "none";

export interface ReservationRecord {
  id: string;
  userId?: string; // propriétaire de la réservation (renvoyé par le serveur)
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

/* =========================================================
   Accès au serveur (les réservations ne sont plus dans le localStorage)
   NB : on suppose une connexion par cookie de session. Si votre connexion utilise
   plutôt un jeton, ajoutez ici les mêmes en-têtes que dans assistantReservationService.ts.
========================================================= */
const RAW_API = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
const API = `${RAW_API.replace(/\/$/, "").replace(/\/api$/, "")}/api`;

const call = (path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

const readError = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
};

// Statuts de la base (EN_ATTENTE, CONFIRMEE...) <-> libellés de l'interface
const statusFromDb = (value: string): ReservationStatus => {
  const v = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (v.includes("ANNUL") || v.includes("REFUS") || v.includes("NO_SHOW")) return "Annulée";
  if (v.includes("CONFIRM") || v.includes("TERMIN")) return "Confirmée";
  return "En attente de confirmation";
};

const statusToDb = (status: ReservationStatus) =>
  status === "Confirmée" ? "CONFIRMEE" : status === "Annulée" ? "ANNULEE" : "EN_ATTENTE";

/** Admin : toutes les réservations (ou celles de `userId`). Client : uniquement les siennes. */
export const getReservations = async (userId?: string): Promise<ReservationRecord[]> => {
  const res = await call(`/my-reservations${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
  if (!res.ok) throw new Error(await readError(res, `Chargement impossible (${res.status})`));
  const rows = (await res.json()) as Array<Omit<ReservationRecord, "status"> & { status: string }>;
  return rows.map((row) => ({ ...row, status: statusFromDb(row.status) }));
};

/** Crée la réservation côté serveur (même contrôle de disponibilité et de prix que l'assistant). */
export const createReservation = async (reservation: ReservationRecord): Promise<ReservationRecord> => {
  if (!(Number(reservation.totalWeightKg) > 0)) {
    throw new Error("Le poids total doit être supérieur à 0 pour enregistrer la réservation.");
  }
  const res = await call("/ai/reserve", {
    method: "POST",
    body: JSON.stringify({
      depart: reservation.departure,
      arrivee: reservation.destination,
      date: String(reservation.date).slice(0, 10),
      quantite: Math.max(1, Number(reservation.passengers) || 1),
      poidsTotalKg: Number(reservation.totalWeightKg),
      marchandise: reservation.cargoType || reservation.cargo || undefined,
      clientName: reservation.clientName || undefined,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, `Enregistrement impossible (${res.status})`));

  const { reservation: s } = (await res.json()) as {
    reservation: {
      id: string; clientName: string; clientPhone: string; clientEmail: string; departure: string;
      destination: string; date: string; boatId: string; boatName: string; quantity: number;
      cargoName: string; unitWeightKg: number; totalWeightKg: number; unitPrice: number; totalPrice: number;
    };
  };

  return {
    ...reservation,
    id: s.id,
    clientName: s.clientName || reservation.clientName,
    clientPhone: s.clientPhone || reservation.clientPhone,
    clientEmail: s.clientEmail || reservation.clientEmail,
    departure: s.departure,
    destination: s.destination,
    date: s.date,
    boatId: s.boatId,
    boatName: s.boatName,
    passengers: s.quantity,
    cargo: s.cargoName,
    cargoType: s.cargoName,
    unitWeightKg: s.unitWeightKg,
    totalWeightKg: s.totalWeightKg,
    unitPrice: s.unitPrice,
    totalPrice: s.totalPrice,
    status: "En attente de confirmation",
    createdAt: new Date().toISOString(),
  };
};

/** Admin : confirmer / annuler. Client : annuler uniquement sa propre réservation. */
export const updateReservationStatus = async (
  reservationId: string,
  status: ReservationStatus,
): Promise<ReservationRecord> => {
  const res = await call(`/reservations/${encodeURIComponent(reservationId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: statusToDb(status) }),
  });
  if (!res.ok) throw new Error(await readError(res, `Changement de statut impossible (${res.status})`));

  const fresh = (await getReservations()).find((item) => item.id === reservationId);
  if (!fresh) throw new Error("Réservation introuvable après la mise à jour.");
  return fresh;
};

/** Réservé à l'administrateur (route générique /api/reservations/:id). */
export const deleteReservation = async (reservationId: string): Promise<void> => {
  const res = await call(`/reservations/${encodeURIComponent(reservationId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res, `Suppression impossible (${res.status})`));
};