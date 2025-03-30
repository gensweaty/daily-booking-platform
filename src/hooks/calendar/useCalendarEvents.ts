
import { useEventFetching } from "./useEventFetching";
import { useEventMutations } from "./useEventMutations";
import { useEventCreation } from "./useEventCreation";
import { useEventAvailability } from "./useEventAvailability";

export const useCalendarEvents = () => {
  const { events, isLoading, error, refetch, getPublicEvents, getAllBusinessEvents } = useEventFetching();
  const { createEvent, updateEvent, deleteEvent, invalidateAllEventQueries } = useEventMutations();
  const { createEventRequest } = useEventCreation();
  const { checkTimeSlotAvailability } = useEventAvailability();

  return {
    // Event data and state
    events,
    isLoading,
    error,
    
    // Event fetching
    refetch,
    getPublicEvents,
    getAllBusinessEvents,
    
    // Event mutations
    createEvent,
    updateEvent,
    deleteEvent,
    
    // Event requests
    createEventRequest,
    
    // Utilities
    checkTimeSlotAvailability,
    invalidateAllEventQueries,
  };
};
