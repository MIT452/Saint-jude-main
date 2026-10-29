import axios from "axios";
import { Boat, User, Goods, Reservation, Trip, CashMovement, FuelConsumption } from "./type";

const API = "https://saint-jude-back.onrender.com/api";

axios.defaults.withCredentials = true;

/* -------------------------------------------------------------------------- */
/*                                   RÔLES                                    */
/* -------------------------------------------------------------------------- */

export type Role = "admin" | "manager" | "staff" | "client";
export type Action = "create" | "read" | "update" | "delete";

export const ROLES: Role[] = ["admin", "manager", "staff", "client"];

// Ressources autorisées par rôle et par action ("*" = toutes les ressources).
// Une ressource absente de la liste est refusée côté interface.
// ⚠️ À adapter à tes endpoints (nom en minuscules, comme dans les URLs).
const PERMISSIONS: Record<Role, Partial<Record<Action, string[] | "*">>> = {
  admin: {
    create: "*",
    read: "*",
    update: "*",
    delete: "*",
  },
  manager: {
    create: "*",
    read: "*",
    update: "*",
    delete: ["reservation", "trip", "goods"],
  },
  staff: {
    create: ["reservation", "trip", "cashmovement", "fuelconsumption"],
    read: "*",
    update: ["reservation", "trip"],
  },
  client: {
    create: ["reservation"],
    read: ["reservation", "trip", "boat"],
    update: ["reservation"],
  },
};

const STORAGE_KEY = "currentUser";
let currentUser: User | null = null;

const normalizeRole = (role?: string | null): Role | null => {
  const r = (role ?? "").toLowerCase().trim();
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

export const isAdmin = (): boolean => hasRole("admin");

export const can = (action: Action, resource: string): boolean => {
  const role = getCurrentRole();
  if (!role) return false;
  const allowed = PERMISSIONS[role][action];
  if (!allowed) return false;
  return allowed === "*" || allowed.includes(resource.toLowerCase());
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