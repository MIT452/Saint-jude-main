import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../redux";
import {
  getReservations,
  updateReservationStatus,
  type ReservationRecord,
} from "../services/reservationService";
import {
  createAssistantReservation,
  verifyAssistantReservation,
} from "../services/assistantReservationService";
import AssistantReservationsPage from "./AssistantReservationsPage";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erreur inconnue";

/**
 * Page « Assistant IA » (menu latéral) :
 * charge les vraies réservations, puis affiche la page complète
 * (statuts du haut, chat, bateaux disponibles, trajets populaires, dernières réservations).
 */
export default function AssistantIAPage() {
  const { trip } = useSelector((state: RootState) => state.stJude);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [selected, setSelected] = useState<ReservationRecord | null>(null);
  const [error, setError] = useState("");

  // Ports connus (noms des trajets) : l'assistant les reconnaît plus sûrement
  const knownPlaces = useMemo(
    () => Array.from(new Set(trip.flatMap((item) => [item.from, item.to]).filter(Boolean))),
    [trip],
  );

  useEffect(() => {
    let active = true;
    getReservations()
      .then((list) => {
        if (active) setReservations(list);
      })
      .catch((e) => {
        if (active) setError(`Impossible de charger les réservations : ${getErrorMessage(e)}`);
      });
    return () => {
      active = false;
    };
  }, []);

  // Réservation créée par l'assistant : déjà enregistrée côté backend, on met l'affichage à jour
  const handleCreated = (saved: ReservationRecord) => {
    setReservations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setSelected(saved);
  };

  // Réservation annulée : on remplace la ligne par la version renvoyée par le backend
  const handleUpdated = (updated: ReservationRecord) => {
    setReservations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  };

  // Annulation : statut « Annulée », les paiements ne sont pas touchés
  const cancelReservation = (reservationId: string) =>
    updateReservationStatus(reservationId, "Annulée");

  return (
    <>
      {error && (
        <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <AssistantReservationsPage
        reservations={reservations}
        reservation={selected ?? undefined}
        knownPlaces={knownPlaces}
        verifyReservation={verifyAssistantReservation}
        createReservation={createAssistantReservation}
        cancelReservation={cancelReservation}
        onReservationCreated={handleCreated}
        onReservationUpdated={handleUpdated}
      />
    </>
  );
}