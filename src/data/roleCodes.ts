import axios from "axios";

/* ⚠️ À aligner sur ton client API existant (src/data/service.ts) :
   même URL de base et même façon d'envoyer l'authentification. */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const http = axios.create({ baseURL: API_URL, withCredentials: true });
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export type CodeRole = "gestionnaire" | "capitaine";

export interface RoleCodeInfo {
  role: CodeRole;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface GeneratedCode {
  role: CodeRole;
  code: string;
  expiresAt: string | null;
}

export const fetchRoleCodes = async (): Promise<RoleCodeInfo[]> =>
  (await http.get("/auth/role-codes")).data;

export const generateRoleCode = async (role: CodeRole, days: number): Promise<GeneratedCode> =>
  (await http.post("/auth/role-codes", { role, days })).data;

export const disableRoleCode = async (role: CodeRole): Promise<void> => {
  await http.delete(`/auth/role-codes/${role}`);
};