/**
 * Returns a masked representation of a 12-digit Aadhaar number.
 * The first 8 digits are replaced with "X"; only the last 4 are shown.
 * Returns null for falsy input so callers can use it directly in conditionals.
 *
 * @example maskAadhaar("123456789012") // "XXXX XXXX 9012"
 */
export function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 12) return null;
  return `XXXX XXXX ${digits.slice(8)}`;
}
