/**
 * Shared date utilities for the frontend.
 * All dates are represented as 'YYYY-MM-DD' strings in LOCAL timezone.
 * This avoids the UTC/local mismatch bug where toISOString() could shift dates.
 */

/**
 * Get today's date as a YYYY-MM-DD string in local timezone.
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Shift a YYYY-MM-DD date string by N days and return a new YYYY-MM-DD string.
 * Uses local date math — no timezone drift.
 */
export function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

/**
 * Parse a YYYY-MM-DD string into a local Date object (midnight local).
 */
export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
