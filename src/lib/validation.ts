// =====================================================================
// Validações compartilhadas (usadas no servidor; espelhadas no cliente
// para UX). Regras deliberadamente simples para um MVP.
// =====================================================================

export const INVALID_URL_MESSAGE = 'URL inválida. Use http:// ou https://.';

// Aceita apenas strings http:// ou https:// não-vazias e parseáveis.
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

// Normaliza um slug para kebab-case minúsculo seguro para URL.
export function normalizeSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-') // separadores -> hifen
    .replace(/^-+|-+$/g, '') // apara hifens das pontas
    .slice(0, 60);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 1;
}
