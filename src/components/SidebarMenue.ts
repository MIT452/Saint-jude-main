import {
  BarChart3,
  Bot,
  ClipboardList,
  CreditCard,
  Fuel,
  MapPin,
  Package,
  ScanSearch,
  Ship,
  User,
  Users,
} from "lucide-react";
import type { ElementType } from "react";
import { Permission } from "../data/type";

export const menuItems = [
  {
    id: "dashboard",
    label: "Tableau de Bord",
    icon: BarChart3,
    description: "Vue d'ensemble",
    permission: "dashboard:read" as Permission,
  },
  {
    id: "merchandise",
    label: "Reservation",
    icon: Package,
    description: "Gestion Marchandises",
    permission: "merchandise:manage" as Permission,
  },
  {
    id: "casing",
    label: "Gestion Caisse",
    icon: CreditCard,
    description: "Finances",
    permission: "caisse:manage" as Permission,
  },
  {
    id: "boat",
    label: "Gestion de Bateau",
    icon: Ship,
    description: "Bateau",
    permission: "boat:manage" as Permission,
  },
  {
    id: "trajets",
    label: "Trajets",
    icon: MapPin,
    description: "Navigation",
    permission: "trajets:manage" as Permission,
  },
  {
    id: "employe",
    label: "Équipe",
    icon: Users,
    description: "Personnel",
    permission: "users:manage" as Permission,
  },
  {
    id: "profile",
    label: "Profil",
    icon: User,
    description: "Mon compte",
    permission: "profile:read" as Permission,
  },
  {
    id: "fueldManage",
    label: "Carburant",
    icon: Fuel,
    description: "Gestion Carburant",
    permission: "fueldManage:manage" as Permission,
  },
  {
    id: "intelligence",
    label: "Dashboard Intelligent",
    icon: ScanSearch,
    description: "Chatbot, GPS, monitoring et optimisation",
    permission: "intelligence:read" as Permission,
  },
  {
    id: "reservations",
    label: "Réservations multimodales",
    icon: Package,
    description: "Réservation, IA, voix et notifications",
    permission: "merchandise:manage" as Permission,
  },
  {
    id: "notificationSettings",
    label: "Configuration",
    description: "Notifications",
    permission: "users:manage" as Permission,
  },
  {
    id: "analytics",
    label: "Analyse des données",
    icon: BarChart3,
    description: "Caisse, carburant, réservations",
    permission: "intelligence:read" as Permission,
  },
];

/* ---------- Menu du Client / Voyageur : exactement 4 entrées ---------- */
export interface ClientMenuItem {
  id: string;
  label: string;
  icon: ElementType;
  description: string;
}

export const clientMenuItems: ClientMenuItem[] = [
  {
    id: "clientBoats",
    label: "Bateaux disponibles",
    icon: Ship,
    description: "Bateaux et trajets",
  },
  {
    id: "clientReservations",
    label: "Mes réservations",
    icon: ClipboardList,
    description: "Suivi et statuts",
  },
  {
    id: "clientAssistant",
    label: "Assistant IA",
    icon: Bot,
    description: "Réservation multimodale",
  },
  {
    id: "profile",
    label: "Mon profil",
    icon: User,
    description: "Informations personnelles",
  },
];

export const isClientRole = (role: unknown) => /client|voyageur/i.test(String(role ?? ""));