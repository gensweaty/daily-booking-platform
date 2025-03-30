
import { supabase } from "@/lib/supabase";

export const useEventAvailability = () => {
  const checkTimeSlotAvailability = async (
    startDate: Date,
    endDate: Date,
    businessId: string
  ): Promise<{ available: boolean; conflictingEvent?: any }> => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    try {
      const { data: existingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('business_id', businessId)
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0] + 'T23:59:59');
        
      if (eventsError) {
        console.error("[useEventAvailability] Error checking for existing events:", eventsError);
        throw eventsError;
      }
      
      const { data: approvedRequests, error: requestsError } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0] + 'T23:59:59');
        
      if (requestsError) {
        console.error("[useEventAvailability] Error checking for approved requests:", requestsError);
        throw requestsError;
      }
      
      const allEvents = [...(existingEvents || []), ...(approvedRequests || [])];
      
      const conflict = allEvents.find(e => {
        const eStart = new Date(e.start_date).getTime();
        const eEnd = new Date(e.end_date).getTime();
        return (startTime < eEnd && endTime > eStart);
      });
      
      return {
        available: !conflict,
        conflictingEvent: conflict
      };
    } catch (error) {
      console.error("[useEventAvailability] Error in checkTimeSlotAvailability:", error);
      return { available: false };
    }
  };

  return {
    checkTimeSlotAvailability
  };
};
