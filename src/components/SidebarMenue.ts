import {
  BarChart3,
  CreditCard,
  Fuel,
  MapPin,
  Package,
  Ship,
  User,
  Users,
} from "lucide-react";
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
];
