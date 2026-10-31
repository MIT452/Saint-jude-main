// Statut logistique : ce que fait la marchandise
export const LOGISTIC_STATUS = {
  EN_ATTENTE: { label: 'En attente',  color: 'bg-red-100 text-red-800' },
  CONFIRMEE:  { label: 'Confirmée',   color: 'bg-green-100 text-green-800' },
  EN_TRANSIT: { label: 'En transit',  color: 'bg-blue-100 text-blue-800' },
  LIVREE:     { label: 'Livrée',      color: 'bg-purple-100 text-purple-800' },
  REFUSEE:    { label: 'Refusée',     color: 'bg-gray-200 text-gray-800' },
  ANNULEE:    { label: 'Annulée',     color: 'bg-gray-200 text-gray-800' },
} as const;

// Statut de paiement : calculé par le back, affiché en lecture seule
export const PAYMENT_STATUS = {
  IMPAYE:  { label: 'Impayé',   color: 'bg-red-100 text-red-800' },
  PARTIEL: { label: 'Partiel',  color: 'bg-orange-100 text-orange-800' },
  SOLDE:   { label: 'Soldé',    color: 'bg-green-100 text-green-800' },
} as const;