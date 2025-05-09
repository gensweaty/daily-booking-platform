
// Helper for consistent currency display across the application
export const getCurrencySymbol = (language?: string): string => {
  switch (language) {
    case 'ka':
      return '₾';
    case 'es':
      return '€';
    default:
      return '$';
  }
};

// Helper for consistent payment amount parsing
export const parsePaymentAmount = (amount: any): number => {
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
};
