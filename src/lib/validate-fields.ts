/**
 * Contrôles et sanitization des données utilisateur selon le type des champs.
 * Limites de longueur et formats cohérents avec le schéma et l'UX.
 */

// Limites (alignées schéma Prisma / formulaires)
export const LIMITS = {
  phone: 30,
  email: 255,
  address: 500,
  city: 120,
  name: 200,
  firstName: 100,
  lastName: 100,
  orderNotes: 2000,
} as const;

// Latitude / longitude valides (WGS84)
const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

function trim(s: string): string {
  return typeof s === 'string' ? s.trim() : '';
}

/** Téléphone : chiffres, espaces, +, - ; longueur max. */
export function sanitizePhone(value: unknown): string {
  const s = trim(String(value ?? ''));
  const cleaned = s.replace(/[^\d+\s\-]/g, '').slice(0, LIMITS.phone);
  return cleaned;
}

export function validatePhone(value: unknown): { ok: boolean; message?: string } {
  const s = sanitizePhone(value);
  if (!s) return { ok: false, message: 'Téléphone requis' };
  if (s.length < 8) return { ok: false, message: 'Téléphone trop court' };
  return { ok: true };
}

/** Email : format basique + longueur max. */
export function sanitizeEmail(value: unknown): string {
  const s = trim(String(value ?? '')).slice(0, LIMITS.email);
  return s;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(value: unknown): { ok: boolean; message?: string } {
  const s = sanitizeEmail(value);
  if (!s) return { ok: false, message: 'Email requis' };
  if (!EMAIL_REGEX.test(s)) return { ok: false, message: 'Format email invalide' };
  return { ok: true };
}

/** Adresse (rue, lieu) : texte, longueur max. */
export function sanitizeAddress(value: unknown): string {
  return trim(String(value ?? '')).slice(0, LIMITS.address);
}

export function validateAddress(value: unknown): { ok: boolean; message?: string } {
  const s = sanitizeAddress(value);
  if (!s) return { ok: false, message: 'Adresse requise' };
  return { ok: true };
}

/** Ville : texte, longueur max. */
export function sanitizeCity(value: unknown): string {
  return trim(String(value ?? '')).slice(0, LIMITS.city);
}

export function validateCity(value: unknown): { ok: boolean; message?: string } {
  const s = sanitizeCity(value);
  if (!s) return { ok: false, message: 'Ville requise' };
  return { ok: true };
}

/** Nom / prénom / libellé : texte, longueur max. */
export function sanitizeName(value: unknown, maxLength: number = LIMITS.name): string {
  return trim(String(value ?? '')).slice(0, maxLength);
}

/** Coordonnées GPS : nombre dans plage WGS84, précision raisonnable. */
export function sanitizeLat(value: unknown): number | null {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const rounded = Math.round(n * 1e7) / 1e7;
  if (rounded < LAT_MIN || rounded > LAT_MAX) return null;
  return rounded;
}

export function sanitizeLng(value: unknown): number | null {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const rounded = Math.round(n * 1e7) / 1e7;
  if (rounded < LNG_MIN || rounded > LNG_MAX) return null;
  return rounded;
}

/** Objet adresse livraison (client) : champs contrôlés. */
export type ShippingAddressInput = {
  address?: unknown;
  city?: unknown;
  phone?: unknown;
  lat?: unknown;
  lng?: unknown;
};

export function sanitizeShippingAddress(input: ShippingAddressInput): {
  address: string;
  city: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
} {
  return {
    address: sanitizeAddress(input.address),
    city: sanitizeCity(input.city),
    phone: input.phone != null && String(input.phone).trim() ? sanitizePhone(input.phone) : null,
    lat: sanitizeLat(input.lat),
    lng: sanitizeLng(input.lng),
  };
}

/** Validation adresse livraison (adresse + ville obligatoires pour commande). */
export function validateShippingAddress(input: ShippingAddressInput): { ok: boolean; message?: string } {
  const a = sanitizeAddress(input.address);
  const c = sanitizeCity(input.city);
  if (!a) return { ok: false, message: 'Adresse requise' };
  if (!c) return { ok: false, message: 'Ville requise' };
  return { ok: true };
}
