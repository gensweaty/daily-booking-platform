
export const getUserTimezone = (): string => {
  try {
    // Primary method: Get timezone from browser
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      return timezone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from Intl API:', error);
  }
  
  // Fallback to UTC if detection fails
  return 'UTC';
};

export const getCurrentTimeInTimezone = (timezone: string): Date => {
  try {
    // Get current time in the specified timezone
    const now = new Date();
    
    // Use proper timezone conversion
    const timeInTimezone = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    
    console.log('Timezone conversion debug:', {
      timezone,
      utcTime: now.toISOString(),
      localTimeString: now.toLocaleString("en-US", { timeZone: timezone }),
      convertedTime: timeInTimezone.toISOString()
    });
    
    return timeInTimezone;
  } catch (error) {
    console.warn('Failed to get time in timezone:', timezone, error);
    return new Date();
  }
};

export const isDateTimeInFuture = (dateTime: string, timezone: string): boolean => {
  try {
    const selectedTime = new Date(dateTime);
    const currentTime = getCurrentTimeInTimezone(timezone);
    
    // Add 1 minute buffer to account for processing time
    const bufferTime = new Date(currentTime.getTime() + 60000);
    
    console.log('Future validation debug:', {
      selectedTime: selectedTime.toISOString(),
      currentTime: currentTime.toISOString(),
      bufferTime: bufferTime.toISOString(),
      isFuture: selectedTime > bufferTime
    });
    
    return selectedTime > bufferTime;
  } catch (error) {
    console.warn('Failed to validate datetime:', error);
    return false;
  }
};

export const formatTimeWithTimezone = (dateTime: string, timezone: string): string => {
  try {
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Failed to format time with timezone:', error);
    return dateTime;
  }
};
