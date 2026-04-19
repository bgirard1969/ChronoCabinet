/**
 * Parseur GS1 pour scanner Datalogic GBT4500 (mode clavier HID).
 *
 * Structure attendue (apres retrait du prefixe "\u00e7C1") :
 *   AI 01 = GTIN-14       \u2192 14 chiffres fixes
 *   AI 17 = Expiration    \u2192 6 chiffres AAMMJJ
 *   AI 10 = Numero de lot \u2192 longueur variable (termine par AI 17/21/20 ou fin)
 *   AI 21 = Numero serie  \u2192 longueur variable (termine par AI 17/21/20 ou fin)
 *   AI 20 = Variante      \u2192 2 chiffres (ignore)
 *
 * Exemples :
 *   \u00e7C10108714729806110172512051031371418
 *   \u00e7C101007630007273901727011421RNH014482G2001
 */

export interface Gs1ParseResult {
  raw: string;
  gtin: string | null;
  expiration_date: string | null; // ISO format YYYY-MM-DD
  lot_number: string | null;
  serial_number: string | null;
}

const VARIABLE_AI_TERMINATORS = ['17', '21', '20', '10'];

function stripPrefix(input: string): string {
  let s = input.trim();
  // Scanner HID may send different chars depending on keyboard layout.
  // Strip any known GS1 AIM prefix variants and also any leading non-digit chars
  // until we reach the "01" AI marker (start of GTIN block).
  s = s.replace(/^\u00e7C1/i, '');
  s = s.replace(/^\]C1/i, '');
  s = s.replace(/^\(01\)/, '01');
  // Strip any remaining leading non-digits (e.g. HID encoding differences)
  s = s.replace(/^[^0-9]+/, '');
  return s;
}

function parseExpiration(yyMMdd: string): string | null {
  if (!/^\d{6}$/.test(yyMMdd)) return null;
  const yy = parseInt(yyMMdd.slice(0, 2), 10);
  const mm = yyMMdd.slice(2, 4);
  const dd = yyMMdd.slice(4, 6);
  // GS1 convention: year 00-49 = 2000-2049, 50-99 = 1950-1999
  const year = yy <= 49 ? 2000 + yy : 1900 + yy;
  // If day is '00', GS1 says "last day of month". Simplify: use day 01.
  const day = dd === '00' ? '01' : dd;
  return `${year}-${mm}-${day}`;
}

/**
 * Read a variable-length field starting at `pos` until a known AI is found
 * or end of string is reached.
 */
function readVariable(body: string, pos: number): { value: string; newPos: number } {
  let end = body.length;
  for (let i = pos + 1; i < body.length - 1; i++) {
    const ai = body.slice(i, i + 2);
    if (VARIABLE_AI_TERMINATORS.includes(ai)) {
      end = i;
      break;
    }
  }
  return { value: body.slice(pos, end), newPos: end };
}

export function parseGs1(raw: string): Gs1ParseResult {
  const result: Gs1ParseResult = {
    raw,
    gtin: null,
    expiration_date: null,
    lot_number: null,
    serial_number: null,
  };

  if (!raw) return result;

  const body = stripPrefix(raw);

  // Fallback: if body is exactly 14 digits, treat as bare GTIN
  if (/^\d{14}$/.test(body)) {
    result.gtin = body;
    return result;
  }

  let pos = 0;
  while (pos < body.length - 1) {
    const ai = body.slice(pos, pos + 2);

    if (ai === '01') {
      const gtin = body.slice(pos + 2, pos + 16);
      if (/^\d{14}$/.test(gtin)) {
        result.gtin = gtin;
        pos += 16;
        continue;
      }
      break;
    }

    if (ai === '17') {
      const yymmdd = body.slice(pos + 2, pos + 8);
      result.expiration_date = parseExpiration(yymmdd);
      pos += 8;
      continue;
    }

    if (ai === '10') {
      const { value, newPos } = readVariable(body, pos + 2);
      result.lot_number = value || null;
      pos = newPos;
      continue;
    }

    if (ai === '21') {
      const { value, newPos } = readVariable(body, pos + 2);
      result.serial_number = value || null;
      pos = newPos;
      continue;
    }

    if (ai === '20') {
      // Variante - 2 chiffres, ignored
      pos += 4;
      continue;
    }

    // Unknown AI \u2014 stop parsing
    break;
  }

  return result;
}
