
export const formatTimeForEmail = (dateTime: string, timezone: string, language: string): string => {
  try {
    const date = new Date(dateTime);
    
    // Format based on language preferences
    const locale = language === 'ka' ? 'ka-GE' : 
                   language === 'es' ? 'es-ES' : 'en-US';
    
    return date.toLocaleString(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: language === 'en' // Use 12-hour format for English, 24-hour for others
    });
  } catch (error) {
    console.error('Error formatting time for email:', error);
    return dateTime;
  }
};

export const getCurrentTimeForEmail = (timezone: string, language: string): string => {
  try {
    const now = new Date();
    const locale = language === 'ka' ? 'ka-GE' : 
                   language === 'es' ? 'es-ES' : 'en-US';
    
    return now.toLocaleString(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: language === 'en'
    });
  } catch (error) {
    console.error('Error getting current time for email:', error);
    return new Date().toLocaleString();
  }
};
