
// Import individual hooks from their respective files
import { useCalendarEvents } from "./calendar/useCalendarEvents";
import { useEventFetching } from "./calendar/useEventFetching";
import { useEventMutations } from "./calendar/useEventMutations";
import { useEventCreation } from "./calendar/useEventCreation";
import { useEventAvailability } from "./calendar/useEventAvailability";
import { useCombinedEvents } from "./calendar/useCombinedEvents";

// Re-export all hooks
export { 
  useCalendarEvents, 
  useEventFetching,
  useEventMutations,
  useEventCreation,
  useEventAvailability,
  useCombinedEvents
};
