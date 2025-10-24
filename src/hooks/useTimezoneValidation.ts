
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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
      
      const { data, error } = await supabase.functions.invoke('validate-datetime', {
        body: {
          dateTime,
          timezone,
          type,
          deadlineDateTime,
          context
        }
      });
      
      if (error) {
        console.error('Validation error:', error);
        return {
          valid: false,
          message: 'Failed to validate date/time. Please try again.',
          userLocalTime: '',
          currentTime: new Date().toLocaleString()
        };
      }
      
      return data as ValidationResult;
      
    } catch (error) {
      console.error('Timezone validation error:', error);
      return {
        valid: false,
        message: 'Network error during validation. Please check your connection.',
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
