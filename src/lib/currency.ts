
import { Language } from '@/translations/types';

/**
 * Returns the appropriate currency symbol based on the user's language
 * @param language The current application language
 * @returns The currency symbol for the given language
 */
export function getCurrencySymbol(language: Language | string | undefined): string {
  if (!language) return '$';
  
  // Ensure we're working with a lowercase string for case-insensitive comparison
  const normalizedLang = language.toLowerCase();
  
  // Log for debugging
  console.log(`Getting currency symbol for language: ${normalizedLang}`);
  
  switch (normalizedLang) {
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
export function formatCurrency(amount: number | string | null | undefined, language: Language | string): string {
  const symbol = getCurrencySymbol(language);
  
  // Handle null, undefined, empty strings
  if (amount === null || amount === undefined || amount === '') {
    return `${symbol}0.00`;
  }
  
  // Convert to number
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN values
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
