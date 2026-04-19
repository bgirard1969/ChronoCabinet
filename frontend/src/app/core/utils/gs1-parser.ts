/**
 * Frontend GS1 parser - mirror of backend src/products/gs1-parser.util.ts.
 * Used for instant feedback when scanning into input fields.
 */

export interface Gs1Parsed {
  raw: string;
  gtin: string | null;
  expiration_date: string | null; // ISO YYYY-MM-DD
  lot_number: string | null;
  serial_number: string | null;
}

const VARIABLE_TERMINATORS = ['17', '21', '20', '10'];

function stripPrefix(input: string): string {
  let s = input.trim();
  s = s.replace(/^\u00e7C1/i, '');
  s = s.replace(/^\]C1/i, '');
  s = s.replace(/^\(01\)/, '01');
  s = s.replace(/^[^0-9]+/, '');
  return s;
}

function parseExpiration(yyMMdd: string): string | null {
  if (!/^\d{6}$/.test(yyMMdd)) return null;
  const yy = parseInt(yyMMdd.slice(0, 2), 10);
  const mm = yyMMdd.slice(2, 4);
  const dd = yyMMdd.slice(4, 6);
  const year = yy <= 49 ? 2000 + yy : 1900 + yy;
  const day = dd === '00' ? '01' : dd;
  return `${year}-${mm}-${day}`;
}

function readVariable(body: string, pos: number): { value: string; newPos: number } {
  let end = body.length;
  for (let i = pos + 1; i < body.length - 1; i++) {
    const ai = body.slice(i, i + 2);
    if (VARIABLE_TERMINATORS.includes(ai)) {
      end = i;
      break;
    }
  }
  return { value: body.slice(pos, end), newPos: end };
}

export function parseGs1(raw: string): Gs1Parsed {
  const result: Gs1Parsed = { raw, gtin: null, expiration_date: null, lot_number: null, serial_number: null };
  if (!raw) return result;

  const body = stripPrefix(raw);
  if (/^\d{14}$/.test(body)) {
    result.gtin = body;
    return result;
  }

  let pos = 0;
  while (pos < body.length - 1) {
    const ai = body.slice(pos, pos + 2);
    if (ai === '01') {
      const gtin = body.slice(pos + 2, pos + 16);
      if (/^\d{14}$/.test(gtin)) { result.gtin = gtin; pos += 16; continue; }
      break;
    }
    if (ai === '17') { result.expiration_date = parseExpiration(body.slice(pos + 2, pos + 8)); pos += 8; continue; }
    if (ai === '10') { const r = readVariable(body, pos + 2); result.lot_number = r.value || null; pos = r.newPos; continue; }
    if (ai === '21') { const r = readVariable(body, pos + 2); result.serial_number = r.value || null; pos = r.newPos; continue; }
    if (ai === '20') { pos += 4; continue; }
    break;
  }
  return result;
}
