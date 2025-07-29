
import { useState, useEffect } from 'react';
import { CalendarEventType } from '@/lib/types/calendar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TimeConflict {
  event_id: string;
  event_title: string;
  event_start: string;
  event_end: string;
  event_type: string;
}

interface UseTimeConflictValidationProps {
  events: CalendarEventType[];
  excludeEventId?: string;
}

export const useTimeConflictValidation = ({
  events,
  excludeEventId
}: UseTimeConflictValidationProps) => {
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [conflicts, setConflicts] = useState<TimeConflict[]>([]);

  const validateTimeSlot = async (
    startDate: string,
    endDate: string
  ): Promise<TimeConflict[]> => {
    if (!user || !startDate || !endDate) return [];

    setIsValidating(true);
    try {
      // Get business_id for the user
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { data: conflictData, error } = await supabase.rpc('check_time_overlap', {
        p_user_id: user.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_exclude_event_id: excludeEventId || null,
        p_business_id: businessData?.id || null
      });

      if (error) {
        console.error('Error checking time conflicts:', error);
        return [];
      }

      const conflicts = conflictData || [];
      setConflicts(conflicts);
      return conflicts;
    } catch (error) {
      console.error('Error validating time slot:', error);
      return [];
    } finally {
      setIsValidating(false);
    }
  };

  const validateTimeSlotClient = (
    startDate: string,
    endDate: string
  ): TimeConflict[] => {
    if (!events || events.length === 0) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const clientConflicts: TimeConflict[] = [];

    events.forEach(event => {
      if (excludeEventId && event.id === excludeEventId) return;
      
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      
      // Check for time overlap
      if (eventStart < end && eventEnd > start) {
        clientConflicts.push({
          event_id: event.id,
          event_title: event.title,
          event_start: event.start_date,
          event_end: event.end_date,
          event_type: event.type || 'event'
        });
      }
    });

    setConflicts(clientConflicts);
    return clientConflicts;
  };

  const clearConflicts = () => {
    setConflicts([]);
  };

  return {
    conflicts,
    isValidating,
    validateTimeSlot,
    validateTimeSlotClient,
    clearConflicts
  };
};
