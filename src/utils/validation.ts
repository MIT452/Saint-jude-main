// src/utils/validation.ts
// Règles de saisie du formulaire de réservation (GoodsForm).

const normaliser = (texte: string) =>
  texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/* =========================
   Marchandise : un bien immobilier n'est pas transportable
   « maison », « villa », « terrain »... sont refusés tels quels.
   Ils sont acceptés si le nom précise ce qui est réellement transporté
   (« maison démontable », « meubles de maison », « matériaux de maison »...).
========================= */
const BIENS_IMMOBILIERS = /\b(maisons?|villas?|immeubles?|terrains?|appartements?|batiments?)\b/;
const PRECISIONS = /(demontable|prefabrique|kit|miniature|maquette|jouet|meuble|affaire|materiau|materiel|electromenager|decoration|deco)/;

/** Retourne un message d'erreur, ou "" si le nom est valide. */
export const validerMarchandise = (nom: string): string => {
  const valeur = normaliser(nom);
  if (!valeur) return "";
  if (BIENS_IMMOBILIERS.test(valeur) && !PRECISIONS.test(valeur)) {
    return `« ${nom.trim()} » est un bien immobilier, pas une marchandise transportable. Précisez par exemple « maison démontable » ou « meubles de maison ».`;
  }
  return "";
};

/* =========================
   Téléphone : exactement 10 chiffres, aucune lettre
========================= */
/** Retire les séparateurs usuels (espaces, points, tirets) saisis par habitude. */
export const nettoyerTelephone = (valeur: unknown): string => String(valeur ?? "").replace(/[\s.\-]/g, "");

/** Retourne un message d'erreur, ou "" si le numéro est valide. */
export const validerTelephone = (valeur: unknown): string => {
  const texte = nettoyerTelephone(valeur);
  if (!texte) return "Le numéro de téléphone est requis.";
  if (/\D/.test(texte)) return "Chiffres uniquement : les lettres et symboles ne sont pas valides.";
  if (texte.length < 10) return `Le numéro doit contenir 10 chiffres (${texte.length} saisi${texte.length > 1 ? "s" : ""}).`;
  if (texte.length > 10) return "Le numéro ne doit pas dépasser 10 chiffres.";
  return "";
};