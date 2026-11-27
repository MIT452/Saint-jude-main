import axios from "axios";

const RAW = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");
const BASE = RAW.endsWith("/api") ? RAW.slice(0, -4) : RAW;
const ROLE_CODES_PATH = "/api/auth/role-codes";

const getToken = () =>
  ["token", "accessToken", "authToken", "jwt"]
    .map((k) => { try { return localStorage.getItem(k); } catch { return null; } })
    .find(Boolean);

const http = axios.create({ baseURL: BASE, withCredentials: true });
http.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export type CodeRole = "agent" | "gestionnaire" | "capitaine" | "proprietaire";

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
  (await http.get(ROLE_CODES_PATH)).data;

export const generateRoleCode = async (role: CodeRole, days: number): Promise<GeneratedCode> =>
  (await http.post(ROLE_CODES_PATH, { role, days })).data;

export const disableRoleCode = async (role: CodeRole): Promise<void> => {
  await http.delete(`${ROLE_CODES_PATH}/${role}`);
};