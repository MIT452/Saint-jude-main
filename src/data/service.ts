import axios from "axios";
import { Boat, User, Goods, Reservation, Trip, CashMovement, FuelConsumption } from "./type";

const API = "https://saint-jude-back.onrender.com/api";

axios.defaults.withCredentials = true;

/* -------------------------------------------------------------------------- */
/*                                   RÔLES                                    */
/* -------------------------------------------------------------------------- */

export type Role =
  | "admin"
  | "administrateur"
  | "proprietaire"
  | "directeur"
  | "manager"
  | "gestionnaire"
  | "comptable"
  | "caissier"
  | "capitaine";

export type Action = "create" | "read" | "update" | "delete";

export const ROLES: Role[] = [
  "admin",
  "administrateur",
  "proprietaire",
  "directeur",
  "manager",
  "gestionnaire",
  "comptable",
  "caissier",
  "capitaine",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  administrateur: "Administrateur (système)",
  proprietaire: "Propriétaire",
  directeur: "Directeur",
  manager: "Manager",
  gestionnaire: "Gestionnaire",
  comptable: "Comptable",
  caissier: "Caissier",
  capitaine: "Capitaine",
};

// Rôles proposés dans le formulaire d'inscription public.
// Chacun exige un code d'accès vérifié par le serveur ; les rôles à privilèges élevés
// (admin, propriétaire, directeur) ne sont jamais proposés.
export const PUBLIC_ROLES: Role[] = ["manager", "gestionnaire", "comptable", "caissier", "capitaine"];

// Ressources autorisées par rôle et par action ("*" = toutes les ressources).
// Une ressource absente de la liste est refusée côté interface.
// ⚠️ Les noms doivent correspondre à tes endpoints (en minuscules, comme dans les URLs).
const ALL_BUT_USERS = [
  "boat",
  "goods",
  "reservation",
  "trip",
  "cashmovement",
  "fuelconsumption",
];

const FULL_ACCESS: Partial<Record<Action, string[] | "*">> = {
  create: "*",
  read: "*",
  update: "*",
  delete: "*",
};

const PERMISSIONS: Record<Role, Partial<Record<Action, string[] | "*">>> = {
  admin: FULL_ACCESS,
  administrateur: FULL_ACCESS,
  proprietaire: FULL_ACCESS,
  directeur: FULL_ACCESS,
  manager: {
    create: ALL_BUT_USERS,
    read: "*",
    update: ALL_BUT_USERS,
    delete: ["reservation", "trip", "goods"],
  },
  gestionnaire: {
    create: ALL_BUT_USERS,
    read: "*",
    update: ALL_BUT_USERS,
    delete: ["reservation", "trip"],
  },
  comptable: {
    create: ["cashmovement", "fuelconsumption"],
    read: "*",
    update: ["cashmovement", "fuelconsumption"],
  },
  // Capitaine : lit tout, enregistre les pleins de carburant et leur mouvement de caisse
  capitaine: {
    create: ["fuelconsumption", "cashmovement"],
    read: "*",
    update: ["fuelconsumption"],
  },
  caissier: {
    create: ["cashmovement", "reservation"],
    read: ["reservation", "trip", "boat", "goods", "cashmovement"],
    update: ["cashmovement"],
  },
};

const STORAGE_KEY = "currentUser";
let currentUser: User | null = null;

const normalizeRole = (role?: string | null): Role | null => {
  // Minuscules et sans accents : « Propriétaire » doit être reconnu comme « proprietaire »
  const r = (role ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return (ROLES as string[]).includes(r) ? (r as Role) : null;
};

const saveCurrentUser = (user: User | null) => {
  currentUser = user;
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage indisponible : on garde seulement la version en mémoire */
  }
};

export const getCurrentUser = (): User | null => {
  if (currentUser) return currentUser;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) currentUser = JSON.parse(raw) as User;
  } catch {
    currentUser = null;
  }
  return currentUser;
};

export const getCurrentRole = (): Role | null =>
  normalizeRole((getCurrentUser() as { role?: string } | null)?.role);

export const hasRole = (...roles: Role[]): boolean => {
  const role = getCurrentRole();
  return role !== null && roles.includes(role);
};

export const isAdmin = (): boolean => hasRole("admin", "administrateur");

export const can = (action: Action, resource: string): boolean => {
  const role = getCurrentRole();
  if (!role) return false;
  const allowed = PERMISSIONS[role][action];
  if (!allowed) return false;
  // Les appels envoient le nom de table au pluriel (« boats », « trips »...), les listes l'écrivent au singulier
  const key = (s: string) => s.toLowerCase().replace(/s$/, "");
  return allowed === "*" || allowed.map(key).includes(key(resource));
};

/* -------------------------------------------------------------------------- */
/*                         INTERCEPTEUR (401 / 403)                           */
/* -------------------------------------------------------------------------- */

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      // Session expirée ou invalide : on oublie l'utilisateur local
      saveCurrentUser(null);
    } else if (status === 403) {
      console.warn("Accès refusé : droits insuffisants pour cette action.");
    }
    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/*                               AUTHENTIFICATION                             */
/* -------------------------------------------------------------------------- */

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegistrationInput extends AuthCredentials {
  name: string;
  lastName: string;
  tel: string;
  role: string;
  roleCode: string; // code d'accès du rôle, vérifié par le serveur
}

export const loginUser = async (credentials: AuthCredentials): Promise<User> => {
  const response = await axios.post<{ user: User }>(
    `${API}/auth/login`,
    credentials,
    { withCredentials: true }
  );
  saveCurrentUser(response.data.user);
  return response.data.user;
};

export const registerUser = async (registration: RegistrationInput): Promise<User> => {
  const response = await axios.post<{ user: User }>(
    `${API}/auth/register`,
    registration,
    { withCredentials: true }
  );
  saveCurrentUser(response.data.user);
  return response.data.user;
};

export const logoutUser = async (): Promise<void> => {
  try {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
  } catch (error) {
    console.error("Erreur lors de la déconnexion", error);
  } finally {
    saveCurrentUser(null);
  }
};

// Recharge l'utilisateur (et son rôle) depuis le serveur, ex. au démarrage de l'app
export const fetchCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await axios.get<{ user: User }>(`${API}/auth/me`, {
      withCredentials: true,
    });
    saveCurrentUser(response.data.user);
    return response.data.user;
  } catch {
    saveCurrentUser(null);
    return null;
  }
};

/* -------------------------------------------------------------------------- */
/*                                  SERVICES                                  */
/* -------------------------------------------------------------------------- */

export const onAddService = async (
  nameAdd: string,
  params: Boat | User | Goods | Reservation | Trip | CashMovement | FuelConsumption
): Promise<"success" | "error"> => {
  if (!can("create", nameAdd)) {
    console.warn(`Rôle non autorisé à créer : ${nameAdd}`);
    return "error";
  }
  try {
    const response = await axios.post(`${API}/${nameAdd.toLowerCase()}`, params);
    return response.status >= 200 && response.status < 300 ? "success" : "error";
  } catch (error) {
    console.error(error);
    return "error";
  }
};

export const onUpdateService = async (
  nameUpdate: string,
  params: Boat | User | Goods | Reservation | Trip | CashMovement | FuelConsumption
): Promise<"success" | "error"> => {
  if (!can("update", nameUpdate)) {
    console.warn(`Rôle non autorisé à modifier : ${nameUpdate}`);
    return "error";
  }
  try {
    const response = await axios.put(`${API}/${nameUpdate.toLowerCase()}/${params.id}`, params);
    return response.status >= 200 && response.status < 300 ? "success" : "error";
  } catch (error) {
    console.log(error);
    return "error";
  }
};

export const onGetService = async <T>(endPoint: string): Promise<T[]> => {
  if (!can("read", endPoint)) {
    console.warn(`Rôle non autorisé à consulter : ${endPoint}`);
    return [];
  }
  try {
    const response = await axios.get<T[]>(`${API}/${endPoint.toLowerCase()}`);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la requête GET", error);
    return [];
  }
};

export const onGetByIdService = async <T>(endPoint: string, id: string): Promise<T | null> => {
  if (!can("read", endPoint)) {
    console.warn(`Rôle non autorisé à consulter : ${endPoint}`);
    return null;
  }
  try {
    const response = await axios.get<T>(`${API}/${endPoint.toLowerCase()}/${id}`);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la requête GET by ID", error);
    return null;
  }
};

/* -------------------------------------------------------------------------- */
/*          PLEIN DE CARBURANT : plein + mouvement de caisse (transaction)    */
/* -------------------------------------------------------------------------- */

export interface RefuelInput {
  tripId: string;
  quantity: number;
  fuelPrice: number;
  fuelType?: string;
  confirm?: boolean; // true = l'utilisateur a confirmé les avertissements
}

export interface RefuelResult {
  status: "success" | "needs-confirmation" | "error";
  fuel?: FuelConsumption;
  cashMovement?: CashMovement;
  warnings?: string[];
  message?: string;
}

export const onRefuelService = async (input: RefuelInput): Promise<RefuelResult> => {
  if (!can("create", "fuelconsumptions") || !can("create", "cashmovements")) {
    console.warn("Rôle non autorisé à enregistrer un plein de carburant");
    return { status: "error", message: "Votre rôle n'est pas autorisé à enregistrer un plein." };
  }
  try {
    const response = await axios.post<{
      fuel: FuelConsumption;
      cashMovement: CashMovement;
      warnings?: string[];
    }>(`${API}/fuelconsumptions/refuel`, input);
    return {
      status: "success",
      fuel: response.data.fuel,
      cashMovement: response.data.cashMovement,
      warnings: response.data.warnings ?? [],
    };
  } catch (error) {
    const err = error as {
      response?: { status?: number; data?: { needsConfirmation?: boolean; warnings?: string[]; error?: string } };
    };
    if (err.response?.status === 409 && err.response.data?.needsConfirmation) {
      return { status: "needs-confirmation", warnings: err.response.data.warnings ?? [] };
    }
    return {
      status: "error",
      message: err.response?.data?.error ?? "Erreur lors de l'enregistrement du plein.",
    };
  }
};

export const onDeleteService = async (nameDelete: string, id: string): Promise<"success" | "error"> => {
  if (!can("delete", nameDelete)) {
    console.warn(`Rôle non autorisé à supprimer : ${nameDelete}`);
    return "error";
  }
  try {
    const response = await axios.delete(`${API}/${nameDelete.toLowerCase()}/${id}`);
    return response.status >= 200 && response.status < 300 ? "success" : "error";
  } catch (error) {
    console.error(error);
    return "error";
  }
};