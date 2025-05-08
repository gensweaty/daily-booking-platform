
import { Language } from '@/translations/types';

/**
 * Returns the appropriate currency symbol based on the user's language
 * @param language The current application language
 * @returns The currency symbol for the given language
 */
export function getCurrencySymbol(language: Language): string {
  switch (language) {
    case 'es':
      return '€';
    case 'ka':
      return '₾';
    case 'en':
    default:
      return '$';
  }
}

/**
 * Formats a monetary value with the appropriate currency symbol based on language
 * @param amount The monetary amount to format
 * @param language The current application language
 * @returns Formatted currency string with symbol
 */
export function formatCurrency(amount: number | string, language: Language): string {
  const symbol = getCurrencySymbol(language);
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN or undefined values
  if (isNaN(numericAmount)) {
    return `${symbol}0.00`;
  }
  
  return `${symbol}${numericAmount.toFixed(2)}`;
}

/**
 * Safely parses any payment amount to a number
 * @param amount The payment amount to parse (can be string, number, null, etc.)
 * @returns A valid number or 0 if invalid
 */
export function parsePaymentAmount(amount: any): number {
  // If null or undefined, return 0
  if (amount === null || amount === undefined) return 0;
  
  // Special handling for specific error cases
  if (amount === 'NaN' || amount === '') return 0;
  
  // For string values (might include currency symbols)
  if (typeof amount === 'string') {
    try {
      // Remove any non-numeric characters except dots and minus signs
      const cleanedStr = amount.replace(/[^0-9.-]+/g, '');
      const parsed = parseFloat(cleanedStr);
      return isNaN(parsed) ? 0 : parsed;
    } catch (e) {
      console.error(`Failed to parse string payment amount: ${amount}`, e);
      return 0;
    }
  }
  
  // For numeric values, ensure they're valid
  if (typeof amount === 'number') {
    return isNaN(amount) ? 0 : amount;
  }
  
  // Try to convert other types to number
  try {
    const converted = Number(amount);
    return isNaN(converted) ? 0 : converted;
  } catch (e) {
    console.error(`Failed to convert payment amount: ${amount}`, e);
    return 0;
  }
}

/**
 * Gets the currency symbol for a booking based on the stored language,
 * falling back to the current user language if not available
 * @param booking The booking request or event object
 * @param currentLanguage The current application language as fallback
 * @returns The appropriate currency symbol
 */
export function getBookingCurrencySymbol(booking: { language?: string } | undefined | null, currentLanguage: Language): string {
  // Use booking's stored language if available, otherwise fall back to current language
  const languageToUse = booking?.language || currentLanguage;
  return getCurrencySymbol(languageToUse as Language);
}

/**
 * Formats a booking amount with the correct currency symbol based on stored language
 * @param amount The amount to format
 * @param booking The booking object that may contain language info
 * @param currentLanguage Current application language as fallback
 * @returns Formatted amount with appropriate currency symbol
 */
export function formatBookingAmount(amount: number | string | null | undefined, 
                                   booking: { language?: string } | undefined | null,
                                   currentLanguage: Language): string {
  if (amount === null || amount === undefined) {
    return `${getBookingCurrencySymbol(booking, currentLanguage)}0.00`;
  }
  
  const numericAmount = parsePaymentAmount(amount);
  return `${getBookingCurrencySymbol(booking, currentLanguage)}${numericAmount.toFixed(2)}`;
}
