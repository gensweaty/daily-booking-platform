
// Helper for consistent currency display across the application
export const getCurrencySymbol = (language?: string): string => {
  console.log(`getCurrencySymbol called with language: ${language || 'undefined'}`);
  
  // Normalize language to lowercase and handle undefined
  const normalizedLang = language?.toLowerCase();
  
  switch (normalizedLang) {
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

// Helper for translating payment status
export const getPaymentStatusLabel = (status: string | undefined, language?: string): string => {
  if (!status) return '';
  
  // Normalize language to lowercase and handle undefined
  const normalizedLang = language?.toLowerCase();
  
  switch (status) {
    case 'not_paid':
      if (normalizedLang === 'ka') return 'გადაუხდელი';
      if (normalizedLang === 'es') return 'No Pagado';
      return 'Not Paid';
      
    case 'partly_paid':
    case 'partly':
      if (normalizedLang === 'ka') return 'ნაწილობრივ გადახდილი';
      if (normalizedLang === 'es') return 'Pagado Parcialmente';
      return 'Partly Paid';
      
    case 'fully_paid':
    case 'fully':
      if (normalizedLang === 'ka') return 'სრულად გადახდილი';
      if (normalizedLang === 'es') return 'Pagado Totalmente';
      return 'Fully Paid';
      
    default:
      // For any other status, just capitalize and format
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
};

// Format payment amount with appropriate currency symbol
export const formatPaymentAmount = (
  amount: number | null | undefined, 
  language?: string, 
  includeSymbol: boolean = true
): string => {
  if (amount === null || amount === undefined) return '';
  
  if (includeSymbol) {
    const symbol = getCurrencySymbol(language);
    return `${symbol}${amount}`;
  }
  
  return `${amount}`;
};
