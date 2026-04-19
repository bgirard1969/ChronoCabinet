/**
 * Normalise une date d'expiration en un timestamp midi UTC, afin que la date calendaire
 * reste strictement identique peu importe le fuseau horaire du client qui l'affiche.
 *
 * Entrées tolérées :
 *   - 'YYYY-MM-DD'
 *   - 'YYYY-MM-DDTHH:MM:SS'
 *   - ISO complet avec offset
 *   - Date object
 *   - null / undefined / ''
 */
export function normalizeExpirationDate(input: any): Date | null {
  if (!input) return null;
  let s: string;
  if (input instanceof Date) {
    // Already a Date: take its UTC Y-M-D (pas local) pour éviter un shift lors du toISOString.
    s = input.toISOString().slice(0, 10);
  } else {
    s = String(input).trim();
  }
  // Extract the YYYY-MM-DD prefix regardless of what follows.
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  // Midi UTC = coussin de ±12h qui protège contre toute timezone cliente.
  return new Date(`${y}-${m}-${d}T12:00:00.000Z`);
}
