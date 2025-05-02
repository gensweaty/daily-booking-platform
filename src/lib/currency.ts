
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
