import { useCallback, useEffect, useState } from "react";

// Même convention que analyticsService.ts / agentService.ts : on retire l'éventuel « / » final
const API_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "https://saint-jude-back.onrender.com/api"
).replace(/\/$/, "");

// Render met du temps à se réveiller après une période d'inactivité
const DELAI_MAX_MS = 60_000;

export interface MoisKpi {
  mois: string | null;
  encaisse: number;
  depenses: number;
  resultat: number;
  facture: number;
  reservations: number;
}

export interface DashboardSummary {
  generatedAt: string;
  moisEnCours: MoisKpi;
  dernierMoisComplet: MoisKpi;
  moisPrecedentComplet: MoisKpi;
  variationsPct: {
    base: string;
    encaisse: number | null;
    depenses: number | null;
    facture: number | null;
    reservations: number | null;
  };
  totaux: {
    encaisseCaisse: number;
    depensesCaisse: number;
    facture: number;
    payeSelonReservations: number;
    payeSelonCaisseLiee: number;
    tauxPaiementPct: number | null;
  };
  reservationsParStatut: { statut: string; n: number }[];
  fraicheur: { source: string; lignes: number; derniereDate: string | null }[];
  qualiteDonnees: {
    caisseSansUtilisateur: number;
    reservationsTrajetInconnu: number;
    marchandisesPrixAberrant: number;
    reservationsPaiementNonSynchronise: number;
  };
}

export interface DashboardForecast {
  status: "OK" | "DONNEES_INSUFFISANTES";
  message?: string;
  semaines?: number;
  semainesNonVides?: number;
  historique: { week: string; value: number }[];
  forecast?: { week: string; value: number; low: number; high: number }[];
  mae?: number;
  mape?: number | null;
  method?: string;
}

export type ErreurDashboard = "SESSION_EXPIREE" | "INDISPONIBLE" | null;

class ErreurHttp extends Error {
  constructor(public statut: number) {
    super(`HTTP ${statut}`);
  }
}

async function lire<T>(chemin: string, signal: AbortSignal): Promise<T> {
  const reponse = await fetch(`${API_URL}${chemin}`, { credentials: "include", signal });
  if (!reponse.ok) throw new ErreurHttp(reponse.status);
  return (await reponse.json()) as T;
}

const typerErreur = (e: unknown): ErreurDashboard =>
  e instanceof ErreurHttp && (e.statut === 401 || e.statut === 403) ? "SESSION_EXPIREE" : "INDISPONIBLE";

/** Variation à afficher : null = ne rien afficher (pas de base de comparaison fiable). */
export const formaterVariation = (pct: number | null | undefined): string | null =>
  pct === null || pct === undefined || !Number.isFinite(pct)
    ? null
    : `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`;

/** Conseil maritime déduit des mesures réelles (plus de texte fixe). */
export const conseilMeteo = (m: { label: string; windKmh: number; wave: number | null }): string => {
  const pluie = /pluie|orage|averse|bruine/i.test(m.label);
  const mer = m.wave != null && m.wave > 2;
  const vent = m.windKmh > 40;
  if (mer || vent) return "Conditions défavorables à la navigation : houle ou vent fort, prudence.";
  if (pluie) return "Pluie : visibilité réduite, vérifier les consignes avant l'appareillage.";
  return "Aucune contrainte météo détectée pour la navigation.";
};

/**
 * Charge les KPI et la prévision. Les deux appels sont indépendants :
 * l'échec de la prévision ne vide pas les KPI, et inversement.
 */
export function useDashboardData() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [forecast, setForecast] = useState<DashboardForecast | null>(null);
  const [erreur, setErreur] = useState<ErreurDashboard>(null); // KPI indisponibles
  const [erreurPrevision, setErreurPrevision] = useState<ErreurDashboard>(null);
  const [chargement, setChargement] = useState(true);
  const [version, setVersion] = useState(0);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let demonte = false;
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), DELAI_MAX_MS);
    setChargement(true);

    Promise.allSettled([
      lire<DashboardSummary>("/dashboard/summary", controle.signal),
      lire<DashboardForecast>("/dashboard/forecast", controle.signal),
    ]).then(([resumeur, previsionneur]) => {
      clearTimeout(minuteur);
      if (demonte) return; // composant quitté ou rechargement lancé : on ignore ce résultat
      if (resumeur.status === "fulfilled") {
        setSummary(resumeur.value);
        setErreur(null);
      } else {
        setErreur(typerErreur(resumeur.reason));
      }
      if (previsionneur.status === "fulfilled") {
        setForecast(previsionneur.value);
        setErreurPrevision(null);
      } else {
        setErreurPrevision(typerErreur(previsionneur.reason));
      }
      setChargement(false);
    });

    return () => {
      demonte = true;
      clearTimeout(minuteur);
      controle.abort();
    };
  }, [version]);

  return { summary, forecast, erreur, erreurPrevision, chargement, recharger };
}
