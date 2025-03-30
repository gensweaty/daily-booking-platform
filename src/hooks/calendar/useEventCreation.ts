
import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { useEventAvailability } from "./useEventAvailability";
import { useQueryClient } from "@tanstack/react-query";

export const useEventCreation = () => {
  const { checkTimeSlotAvailability } = useEventAvailability();
  const queryClient = useQueryClient();

  const createEventRequest = async (event: Partial<CalendarEventType>): Promise<any> => {
    try {
      if (!event.business_id) {
        console.error("[useEventCreation] Missing business_id when creating event request");
        throw new Error("Business ID is required for event requests");
      }

      console.log("[useEventCreation] Creating event request:", event);
      
      const startDate = new Date(event.start_date as string);
      const endDate = new Date(event.end_date as string);
      
      const { available } = await checkTimeSlotAvailability(
        startDate,
        endDate,
        event.business_id
      );
      
      if (!available) {
        throw new Error("This time slot conflicts with an existing booking");
      }
      
      const { data, error } = await supabase
        .from('event_requests')
        .insert([{ 
          ...event,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error("[useEventCreation] Error creating event request:", error);
        throw error;
      }
      
      console.log("[useEventCreation] Event request created successfully:", data);
      
      // Make sure to invalidate all relevant queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
      
      if (event.business_id) {
        queryClient.invalidateQueries({ queryKey: ['public-events', event.business_id] });
        queryClient.invalidateQueries({ queryKey: ['all-business-events', event.business_id] });
      }
      
      return data;
    } catch (error) {
      console.error("[useEventCreation] Error in createEventRequest:", error);
      throw error;
    }
  };

  return {
    createEventRequest
  };
};
