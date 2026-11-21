// Phone number helpers. We always STORE numbers in E.164 format
// (+14165550123) and SHOW them in the friendly 416-555-0123 style.

/**
 * Turns "416-555-0123", "(416) 555 0123", "1 416 555 0123" or
 * "+14165550123" into "+14165550123". Returns null if it isn't a valid number.
 * Numbers without a + are treated as Canada/US (+1).
 */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    if (digits.startsWith("1")) return isValidNanp(digits.slice(1)) ? `+${digits}` : null;
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10 && isValidNanp(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && isValidNanp(digits.slice(1))) return `+${digits}`;
  return null;
}

// Canada/US numbers: 10 digits, area code and exchange don't start with 0 or 1.
function isValidNanp(tenDigits: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(tenDigits);
}

/** "+14165550123" → "416-555-0123". Other countries are shown as-is. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : e164;
}
