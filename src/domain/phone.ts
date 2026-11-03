/**
 * Phone normalization to E.164 — the customer de-duplication key (§5.1).
 * Bulgarian numbers are the default (+359); other countries must be entered
 * with a "+" or "00" prefix.
 */

const BG_NSN = /^[1-9]\d{7,8}$/; // national significant number: 8 (e.g. Sofia 2xxxxxxx) or 9 digits (mobile)
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Allow common separators only.
  if (!/^[+\d\s().\-/]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/[\s().\-/]/g, "");

  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+")) {
    if (digits.startsWith("+359")) {
      let nsn = digits.slice(4);
      if (nsn.startsWith("0")) nsn = nsn.slice(1); // "+359 0887…" typo
      return BG_NSN.test(nsn) ? `+359${nsn}` : null;
    }
    return E164.test(digits) ? digits : null;
  }

  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("359") && BG_NSN.test(digits.slice(3))) return `+${digits}`;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return BG_NSN.test(digits) ? `+359${digits}` : null;
}

/** Bulgarian mobile ranges: 87, 88, 89, 98, 99 + 7 digits. */
export function isBgMobile(e164: string): boolean {
  return /^\+359(8[789]|9[89])\d{7}$/.test(e164);
}

/** "+359887374755" → "+359 887 374 755" (display only). */
export function formatPhone(e164: string): string {
  const m = /^\+359(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (m) return `+359 ${m[1]} ${m[2]} ${m[3]}`;
  const s = /^\+3592(\d{3})(\d{4})$/.exec(e164);
  if (s) return `+359 2 ${s[1]} ${s[2]}`;
  return e164;
}

/**
 * Digits to look for inside stored E.164 numbers when searching:
 * "0888 123", "+359 888 123" and "359888123" all become "888123".
 * null when too short to be useful.
 */
export function phoneSearchDigits(term: string): string | null {
  const core = term.replace(/\D/g, "").replace(/^(00359|359|0)/, "");
  return core.length >= 3 ? core : null;
}
