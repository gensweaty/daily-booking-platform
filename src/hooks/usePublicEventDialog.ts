import { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { isVirtualInstance, getParentEventId } from "@/lib/recurringEvents";

interface UsePublicEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => Promise<{ success: boolean; }>;
}

export const usePublicEventDialog = ({
  createEvent,
  updateEvent,
  deleteEvent,
}: UsePublicEventDialogProps) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [originalInstanceWindow, setOriginalInstanceWindow] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();

  // When setting selectedEvent, capture the ORIGINAL window
  const setSelectedEventWithWindow = (event: CalendarEventType | null) => {
    if (event) {
      setOriginalInstanceWindow({
        start: event.start_date!,
        end: event.end_date!
      });
    } else {
      setOriginalInstanceWindow(null);
    }
    setSelectedEvent(event);
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      const eventData = {
        ...data,
        type: 'event' as const,
        title: data.user_surname || data.title,
        user_surname: data.user_surname || data.title,
        payment_status: normalizePaymentStatus(data.payment_status) || 'not_paid',
        checkAvailability: false,
        language: data.language || language || 'en'
      };
      
      console.log("[PublicEventDialog] Creating event with data:", eventData);
      
      if (!createEvent) throw new Error("Create event function not provided");
      
      const createdEvent = await createEvent(eventData);
      
      setIsNewEventDialogOpen(false);
      console.log("[PublicEventDialog] Event created successfully:", createdEvent);
      
      return createdEvent;
    } catch (error: any) {
      console.error("[PublicEventDialog] Failed to create event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (
    data: Partial<CalendarEventType>,
    editChoice?: "this" | "series",
    publicBoardUserId?: string,
    externalUserName?: string
  ) => {
    try {
      if (!selectedEvent) {
        throw new Error("No event selected");
      }

      const eventId = selectedEvent.id;
      const isVirtual = isVirtualInstance(eventId);
      const targetId = isVirtual ? getParentEventId(eventId) : eventId;

      // If it's a series update, use the legacy updateEvent for backward compatibility
      if (editChoice === "series" && updateEvent) {
        const eventData = {
          ...data,
          id: targetId,
          type: selectedEvent.type || 'event',
          title: data.user_surname || data.title || selectedEvent.title,
          user_surname: data.user_surname || data.title || selectedEvent.user_surname,
          payment_status: normalizePaymentStatus(data.payment_status) || normalizePaymentStatus(selectedEvent.payment_status) || 'not_paid',
          language: data.language || selectedEvent.language || language || 'en'
        };
        
        console.log("[usePublicEventDialog] Updating entire series with legacy method:", eventData);
        
        const updatedEvent = await updateEvent(eventData as Partial<CalendarEventType> & { id: string });
        
        setSelectedEvent(null);
        return updatedEvent;
      }

      // For "this event" updates, use the v2 RPC to properly split instances
      if (editChoice === "this" && publicBoardUserId && externalUserName) {
        console.log("[usePublicEventDialog] Splitting single instance using v2 RPC");

        // Use ORIGINAL instance window captured when event was selected
        const originalStartISO = originalInstanceWindow?.start || selectedEvent.start_date || new Date().toISOString();
        const originalEndISO = originalInstanceWindow?.end || selectedEvent.end_date || new Date().toISOString();

        const { data: editResult, error: editError } = await supabase.rpc('edit_single_event_instance_v2', {
          p_event_id: targetId,
          p_user_id: publicBoardUserId,
          p_event_data: {
            title: data.user_surname || data.title || selectedEvent.title || 'Untitled Event',
            user_surname: data.user_surname || data.title || selectedEvent.user_surname,
            user_number: data.user_number || selectedEvent.user_number,
            social_network_link: data.social_network_link || selectedEvent.social_network_link,
            event_notes: data.event_notes || selectedEvent.event_notes,
            event_name: data.event_name || selectedEvent.event_name,
            start_date: data.start_date || selectedEvent.start_date,
            end_date: data.end_date || selectedEvent.end_date,
            payment_status: normalizePaymentStatus(data.payment_status) || normalizePaymentStatus(selectedEvent.payment_status) || 'not_paid',
            payment_amount: data.payment_amount || selectedEvent.payment_amount,
            reminder_at: data.reminder_at || selectedEvent.reminder_at,
            email_reminder_enabled: data.email_reminder_enabled ?? selectedEvent.email_reminder_enabled ?? false,
            language: data.language || selectedEvent.language || language || 'en'
          },
          p_additional_persons: (data as any).additional_persons || [],
          p_instance_start: originalStartISO,
          p_instance_end: originalEndISO,
          p_edited_by_type: 'sub_user',
          p_edited_by_name: externalUserName,
          p_edited_by_ai: false
        });

        if (editError) {
          console.error("[usePublicEventDialog] RPC error:", editError);
          throw editError;
        }

        console.log("[usePublicEventDialog] Single instance split successfully:", editResult);
        setSelectedEvent(null);
        return editResult;
      }

      // Fallback: use legacy update if no choice specified
      if (updateEvent) {
        const eventData = {
          ...data,
          id: targetId,
          type: selectedEvent.type || 'event',
          title: data.user_surname || data.title || selectedEvent.title,
          user_surname: data.user_surname || data.title || selectedEvent.user_surname,
          payment_status: normalizePaymentStatus(data.payment_status) || normalizePaymentStatus(selectedEvent.payment_status) || 'not_paid',
          language: data.language || selectedEvent.language || language || 'en'
        };
        
        const updatedEvent = await updateEvent(eventData as Partial<CalendarEventType> & { id: string });
        setSelectedEvent(null);
        return updatedEvent;
      }

      throw new Error("No update method available");
    } catch (error: any) {
      console.error("[usePublicEventDialog] Failed to update event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteEvent = async (deleteChoice?: "this" | "series") => {
    try {
      if (!deleteEvent || !selectedEvent) throw new Error("Delete event function not provided or no event selected");
      
      console.log("[PublicEventDialog] Deleting event:", selectedEvent.id, deleteChoice);
      
      const result = await deleteEvent({ id: selectedEvent.id, deleteChoice });
      
      setSelectedEvent(null);
      console.log("[PublicEventDialog] Event deleted successfully:", selectedEvent.id);
      
      return result;
    } catch (error: any) {
      console.error("[PublicEventDialog] Failed to delete event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Helper function to normalize payment status values
  const normalizePaymentStatus = (status: string | undefined): string | undefined => {
    if (!status) return undefined;
    
    console.log("[PublicEventDialog] Normalizing payment status:", status);
    
    if (status.includes('partly')) return 'partly_paid';
    if (status.includes('fully')) return 'fully_paid';
    if (status.includes('not_paid') || status === 'not paid') return 'not_paid';
    
    return status;
  };

  return {
    selectedEvent,
    setSelectedEvent: setSelectedEventWithWindow,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate,
    setSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
};