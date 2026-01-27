
import { useState } from 'react';
import { getUserTimezone } from '@/utils/timezoneUtils';

interface ValidationResult {
  valid: boolean;
  message?: string;
  userLocalTime: string;
  currentTime: string;
}

interface UseTimezoneValidationReturn {
  validateDateTime: (
    dateTime: string, 
    type: 'deadline' | 'reminder',
    deadlineDateTime?: string,
    context?: 'task' | 'event'
  ) => Promise<ValidationResult>;
  isValidating: boolean;
}

export const useTimezoneValidation = (): UseTimezoneValidationReturn => {
  const [isValidating, setIsValidating] = useState(false);
  
  const validateDateTime = async (
    dateTime: string,
    type: 'deadline' | 'reminder',
    deadlineDateTime?: string,
    context: 'task' | 'event' = 'task'
  ): Promise<ValidationResult> => {
    setIsValidating(true);
    
    try {
      const timezone = getUserTimezone();
      
      // Perform validation locally instead of calling edge function
      const nowUtc = new Date();
      const selectedTimeUtc = new Date(dateTime);
      
      // Format for display
      const currentTimeDisplay = nowUtc.toLocaleString("en-US", { 
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const selectedTimeDisplay = selectedTimeUtc.toLocaleString("en-US", { 
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      // Add 1 minute buffer to account for processing time
      const bufferTime = new Date(nowUtc.getTime() + 60000);
      
      // Compare UTC times directly
      if (selectedTimeUtc <= bufferTime) {
        return {
          valid: false,
          message: `${type === 'deadline' ? 'Deadline' : 'Reminder'} must be set for a future time. Selected time must be at least 1 minute from now.`,
          userLocalTime: selectedTimeDisplay,
          currentTime: currentTimeDisplay
        };
      }
      
      // Additional validation for task reminders - must be before deadline
      if (type === 'reminder' && context === 'task' && deadlineDateTime) {
        const deadlineTime = new Date(deadlineDateTime);
        if (selectedTimeUtc >= deadlineTime) {
          return {
            valid: false,
            message: 'Reminder must be set before the deadline.',
            userLocalTime: selectedTimeDisplay,
            currentTime: currentTimeDisplay
          };
        }
      }
      
      return {
        valid: true,
        userLocalTime: selectedTimeDisplay,
        currentTime: currentTimeDisplay
      };
      
    } catch (error) {
      console.error('Timezone validation error:', error);
      return {
        valid: false,
        message: 'Invalid date/time format. Please select a valid date and time.',
        userLocalTime: '',
        currentTime: new Date().toLocaleString()
      };
    } finally {
      setIsValidating(false);
    }
  };
  
  return {
    validateDateTime,
    isValidating
  };
};
