import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent, deleteEvent } from "@/lib/api";
import { CalendarEventType } from "@/lib/types/calendar";

export const useCalendarEvents = () => {
  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }) =>
      updateEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  return {
    events,
    isLoading,
    error,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};