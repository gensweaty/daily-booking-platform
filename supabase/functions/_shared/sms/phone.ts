// Phone-number helpers shared by the SMS service.
// Numbers are always normalised to E.164 before reaching a provider.

export const DEFAULT_COUNTRY_BY_LANGUAGE: Record<string, string> = {
  ka: "+995",
  en: "+1",
  es: "+34",
  ru: "+7",
};

export function defaultCountryCodeForLanguage(language?: string | null): string {
  const key = (language || "en").toLowerCase().slice(0, 2);
  return DEFAULT_COUNTRY_BY_LANGUAGE[key] || "+1";
}

/**
 * Normalise a user-entered phone number to E.164.
 * - keeps an existing +country prefix
 * - converts a 00-prefix to +
 * - otherwise prepends the supplied default country code
 * Returns null when the result cannot be a valid number.
 */
export function normalizePhoneNumber(
  raw: string | null | undefined,
  defaultCountryCode = "+995",
): string | null {
  if (!raw) return null;
  let value = String(raw).trim().replace(/[\s\-().]/g, "");
  if (!value) return null;

  if (value.startsWith("00")) value = `+${value.slice(2)}`;

  if (!value.startsWith("+")) {
    const cc = (defaultCountryCode || "+995").replace(/[^\d+]/g, "");
    // Numbers written with a national trunk "0" prefix lose it when a country code is added.
    const local = value.replace(/^0+/, "");
    value = `${cc.startsWith("+") ? cc : `+${cc}`}${local}`;
  }

  if (!/^\+\d{7,15}$/.test(value)) return null;
  return value;
}
