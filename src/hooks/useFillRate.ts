// src/hooks/useFillRate.ts
import { useEffect, useState } from "react";
import axios from "axios";

export type FillRateRow = {
  trip_id: string;
  from: string;
  to: string;
  day: string;
  boat: string | null;
  capacity: number;
  kg_booked: number;
  revenue: number;
  nb_reservations: number;
  fill_rate: number; // entre 0 et 1
};

export function useFillRate() {
  const [rows, setRows] = useState<FillRateRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<FillRateRow[]>("http://localhost:3000/api/analytics/fill-rate", {
        withCredentials: true,
      })
      .then((r) => setRows(r.data))
      .catch((e) => {
        setRows([]);
        setError(e?.response?.status === 401 ? "Veuillez vous reconnecter." : "Données indisponibles.");
      });
  }, []);

  return { rows, error };
}