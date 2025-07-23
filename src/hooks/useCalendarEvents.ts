import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CalendarEventType } from '@/lib/types/calendar';
import { isVirtualInstance, expandRecurringEvents } from '@/lib/recurringEvents';

export const useCalendarEvents = (initialEvents: CalendarEventType[] = []) => {
  const [events, setEvents] = useState<CalendarEventType[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCalendarEvent = async (event: Partial<CalendarEventType>) => {
    setLoading(true);
    const { data, error: insertError } = await supabase.from('events').insert([event]).select();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      throw new Error(insertError.message);
    }
    
    if (data) {
      const newEvent = data[0] as CalendarEventType;
      setEvents((prevEvents) => [...prevEvents, newEvent]);
      setLoading(false);
      return newEvent;
    }

    setLoading(false);
    return null;
  };

  const updateCalendarEvent = async (event: Partial<CalendarEventType>) => {
    setLoading(true);
    const { data, error: updateError } = await supabase.from('events').update(event).match({ id: event.id }).select();

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      throw new Error(updateError.message);
    }

    if (data) {
      const updatedEvent = data[0] as CalendarEventType;
      setEvents((prevEvents) => prevEvents.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
      setLoading(false);
      return updatedEvent;
    }

    setLoading(false);
    return null;
  };
  
  // <<< THIS IS THE CORRECTED FUNCTION >>>
  const deleteCalendarEvent = async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
    setLoading(true);
    const eventToDelete = events.find(e => e.id === id);

    if (!eventToDelete) {
      const message = "Event not found";
      setError(message);
      setLoading(false);
      throw new Error(message);
    }

    // --- START OF THE FIX ---
    // If the event's ID is the same as its series_id, it's a standalone "approved booking" event.
    // Delete it directly and bypass the recurring event logic.
    if (eventToDelete.series_id && eventToDelete.id === eventToDelete.series_id) {
        const { error: deleteError } = await supabase.from('events').delete().match({ id: eventToDelete.id });

        if (deleteError) {
            setError(deleteError.message);
            setLoading(false);
            throw new Error(deleteError.message);
        }
        
        setEvents(prevEvents => prevEvents.filter(e => e.id !== id));
        setLoading(false);
        return { success: true };
    }
    // --- END OF THE FIX ---

    // Original logic for handling real recurring events (now safe)
    if (isVirtualInstance(eventToDelete) && deleteChoice === 'this') {
      const series = events.find(e => e.id === eventToDelete.series_id);
      if (series) {
        const updatedSeries = {
          ...series,
          excluded_dates: [...(series.excluded_dates || []), new Date(eventToDelete.start_time).toISOString()],
        };
        await updateCalendarEvent(updatedSeries);
        setEvents(prevEvents => prevEvents.filter(e => e.id !== id));
      }
    } else if (eventToDelete?.series_id && deleteChoice === 'this') {
      const updatedEvent = { ...eventToDelete, series_id: null };
      await updateCalendarEvent(updatedEvent);
    } else {
      const { error: deleteError } = await supabase.from('events').delete().match({ id });

      if (deleteError) {
        setError(deleteError.message);
        setLoading(false);
        throw new Error(deleteError.message);
      }
      setEvents(prevEvents => prevEvents.filter(e => e.id !== id && e.series_id !== id));
    }

    setLoading(false);
    return { success: true };
  };

  const expandedEvents = expandRecurringEvents(events);

  return {
    events: expandedEvents,
    setEvents,
    loading,
    error,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
  };
};
