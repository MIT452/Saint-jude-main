import { getRealtimeOrigin } from "./intelligenceService";

export const EVENT_TYPES = [
  "reservation.confirmed",
  "reservation.pending",
  "reservation.rejected",
  "reservation.cancelled",
  "payment.received",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<EventType, string> = {
  "reservation.confirmed": "Réservation confirmée",
  "reservation.pending": "Demande en attente (crédit ou validation)",
  "reservation.rejected": "Réservation refusée",
  "reservation.cancelled": "Réservation annulée",
  "payment.received": "Paiement reçu",
};

export const PLACEHOLDERS = ["client", "trajet", "date", "passagers", "total", "reference", "motif"] as const;

export type Template = { subject: string; body: string };

export interface NotificationSettings {
  adminEmail: string;
  adminWhatsapp: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  events: Record<EventType, boolean>;
  templates: Partial<Record<EventType, Template>>;
  aiTone: string;
  updatedAt?: string | null;
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  adminEmail: "",
  adminWhatsapp: "",
  emailEnabled: true,
  whatsappEnabled: false,
  events: {
    "reservation.confirmed": true,
    "reservation.pending": true,
    "reservation.rejected": true,
    "reservation.cancelled": true,
    "payment.received": true,
  },
  templates: {},
  aiTone: "professionnel et chaleureux",
  updatedAt: null,
};

export const hasUnknownVars = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].some((m) => !(PLACEHOLDERS as readonly string[]).includes(m[1]));

const endpoint = () => `${getRealtimeOrigin().replace(/\/$/, "")}/api/notification-settings`;

async function call(method: "GET" | "PUT", body?: unknown): Promise<NotificationSettings> {
  const res = await fetch(endpoint(), {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* réponse non JSON */ }
    throw new Error(msg);
  }
  const data = await res.json();
  return { ...DEFAULT_SETTINGS, ...data, events: { ...DEFAULT_SETTINGS.events, ...(data.events ?? {}) } };
}

export const fetchNotificationSettings = () => call("GET");
export const saveNotificationSettings = (s: NotificationSettings) => call("PUT", s);