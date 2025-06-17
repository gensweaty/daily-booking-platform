import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface CreateEventData {
  title: string;
  start_date: string;
  end_date: string;
  type?: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number;
  file?: File;
  checkAvailability?: boolean;
  language?: string;
  is_group_event?: boolean;
  group_name?: string;
  participants?: Array<{
    name: string;
    email: string;
    notes?: string;
  }>;
}

interface UpdateEventData extends CreateEventData {
  id: string;
  type: string;
}

interface ConflictDetails {
  conflictingEvent: CalendarEventType;
  overlapStart: string;
  overlapEnd: string;
}

interface AvailabilityResult {
  available: boolean;
  conflictDetails?: ConflictDetails;
}

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Helper function to associate booking files with a new event
  const associateBookingFilesWithEvent = async (
    bookingRequestId: string,
    newEventId: string,
    userId: string
  ) => {
    try {
      console.log(`Copying files from booking ${bookingRequestId} to event ${newEventId}`);
      
      // Fetch all files associated with the booking request
      const { data: bookingFiles, error: fetchError } = await supabase
        .from('booking_files')
        .select('*')
        .eq('booking_request_id', bookingRequestId);
        
      if (fetchError) {
        console.error("Error fetching booking files:", fetchError);
        throw fetchError;
      }
      
      if (!bookingFiles || bookingFiles.length === 0) {
        console.log("No files found for booking request:", bookingRequestId);
        return null;
      }
      
      console.log(`Found ${bookingFiles.length} files to copy`);
      
      // Copy each file to the event_files table
      const copiedFiles = [];
      for (const file of bookingFiles) {
        const { filename, file_path, content_type, size } = file;
        
        // Insert the file record into event_files
        const { data: newFile, error: copyError } = await supabase
          .from('event_files')
          .insert({
            event_id: newEventId,
            filename,
            file_path,
            content_type,
            size,
            user_id: userId,
          })
          .select()
          .single();
          
        if (copyError) {
          console.error("Error copying file to event_files:", copyError);
          continue; // Skip to the next file
        }
        
        copiedFiles.push(newFile);
        console.log(`Copied file ${filename} to event ${newEventId}`);
      }
      
      if (copiedFiles.length === 0) {
        console.log("No files were successfully copied to the event");
        return null;
      }
      
      // Return the first copied file (or adjust as needed)
      return copiedFiles[0];
    } catch (error) {
      console.error("Error associating booking files with event:", error);
      return null;
    }
  };

  // Helper to determine if times have changed between original and new dates
  const haveTimesChanged = (
    originalStartDate: string,
    originalEndDate: string,
    newStartDate: string,
    newEndDate: string
  ): boolean => {
    const originalStart = new Date(originalStartDate).getTime();
    const originalEnd = new Date(originalEndDate).getTime();
    const newStart = new Date(newStartDate).getTime();
    const newEnd = new Date(newEndDate).getTime();
    
    return originalStart !== newStart || originalEnd !== newEnd;
  };

  // Normalize timestamp for proper comparison - fix for false conflict warnings
  const normalizeTimestamp = (dateStr: string): string => {
    return new Date(dateStr).toISOString();
  };

  const checkTimeSlotAvailability = useCallback(async (
    startDate: string,
    endDate: string,
    eventId?: string
  ): Promise<AvailabilityResult> => {
    try {
      let query = supabase
        .from("events")
        .select("*")
        .is("deleted_at", null);

      if (businessUserId) {
        query = query.eq("user_id", businessUserId);
      } else if (user?.id) {
        query = query.eq("user_id", user.id);
      }

      // Exclude current event from conflict check when editing
      if (eventId) {
        query = query.neq("id", eventId);
      }

      query = query
        .or(`start_date.lt.${endDate},end_date.gt.${startDate}`)
        .order("start_date", { ascending: true });

      const { data: conflictingEvents, error } = await query;

      if (error) {
        console.error("Error checking availability:", error);
        throw error;
      }

      if (conflictingEvents && conflictingEvents.length > 0) {
        const conflictingEvent = conflictingEvents[0];
        return {
          available: false,
          conflictDetails: {
            conflictingEvent,
            overlapStart: new Date(Math.max(new Date(startDate).getTime(), new Date(conflictingEvent.start_date).getTime())).toISOString(),
            overlapEnd: new Date(Math.min(new Date(endDate).getTime(), new Date(conflictingEvent.end_date).getTime())).toISOString(),
          }
        };
      }

      return { available: true };
    } catch (error) {
      console.error("Error in checkTimeSlotAvailability:", error);
      throw error;
    }
  }, [businessUserId, user?.id]);

  const createEventMutation = useMutation({
    mutationFn: async (eventData: CreateEventData) => {
      console.log("Creating event with data:", eventData);
      
      if (!user?.id && !businessUserId) {
        throw new Error(t('common.authRequired'));
      }

      const userId = businessUserId || user?.id;
      const language = eventData.language || 'en';

      // Check availability for non-group events only
      if (eventData.checkAvailability && !eventData.is_group_event) {
        const { available, conflictDetails } = await checkTimeSlotAvailability(
          eventData.start_date,
          eventData.end_date
        );

        if (!available && conflictDetails) {
          throw new Error(t('booking.timeSlotConflict', {
            title: conflictDetails.conflictingEvent.title,
            start: new Date(conflictDetails.overlapStart).toLocaleString(),
            end: new Date(conflictDetails.overlapEnd).toLocaleString()
          }));
        }
      }

      let fileUrl = null;
      let fileName = null;
      let contentType = null;
      let fileSize = null;

      if (eventData.file) {
        const fileExt = eventData.file.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event-files')
          .upload(filePath, eventData.file);

        if (uploadError) {
          console.error("File upload error:", uploadError);
          throw new Error(t('files.fileUploadError'));
        }

        fileUrl = filePath;
        fileName = eventData.file.name;
        contentType = eventData.file.type;
        fileSize = eventData.file.size;
      }

      const baseEvent = {
        user_id: userId,
        title: eventData.title,
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        type: eventData.type || 'private_party',
        user_surname: eventData.user_surname,
        user_number: eventData.user_number,
        social_network_link: eventData.social_network_link,
        event_notes: eventData.event_notes,
        payment_status: eventData.payment_status,
        payment_amount: eventData.payment_amount,
        file_path: fileUrl,
        filename: fileName,
        content_type: contentType,
        size: fileSize,
        language,
        is_group_event: eventData.is_group_event || false,
        group_name: eventData.group_name,
      };

      if (eventData.is_group_event && eventData.participants && eventData.participants.length > 0) {
        // Create main group event
        const { data: mainEvent, error: mainError } = await supabase
          .from("events")
          .insert([baseEvent])
          .select()
          .single();

        if (mainError) throw mainError;

        // Create participant events
        const participantEvents = eventData.participants.map(participant => ({
          ...baseEvent,
          title: `${eventData.group_name} - ${participant.name}`,
          user_surname: participant.name,
          social_network_link: participant.email,
          event_notes: participant.notes || eventData.event_notes,
          parent_group_id: mainEvent.id,
        }));

        const { error: participantsError } = await supabase
          .from("events")
          .insert(participantEvents);

        if (participantsError) throw participantsError;

        return mainEvent;
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert([baseEvent])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: t('common.success'),
        description: t('events.eventCreated'),
      });
    },
    onError: (error) => {
      console.error("Error creating event:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: UpdateEventData) => {
      console.log("Updating event with data:", eventData);
      
      if (!user?.id && !businessUserId) {
        throw new Error(t('common.authRequired'));
      }

      // Get existing event for comparison
      const { data: existingEvent, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventData.id)
        .single();

      if (fetchError) throw fetchError;

      // Fix: Use normalized timestamp comparison to prevent false positives
      const timesChanged = (
        normalizeTimestamp(existingEvent.start_date) !== normalizeTimestamp(eventData.start_date) ||
        normalizeTimestamp(existingEvent.end_date) !== normalizeTimestamp(eventData.end_date)
      );

      // Only check availability if times changed and it's not a group event
      if (timesChanged && !eventData.is_group_event) {
        const { available, conflictDetails } = await checkTimeSlotAvailability(
          eventData.start_date,
          eventData.end_date,
          eventData.id // Exclude current event from conflict check
        );

        if (!available && conflictDetails) {
          throw new Error(t('booking.timeSlotConflict', {
            title: conflictDetails.conflictingEvent.title,
            start: new Date(conflictDetails.overlapStart).toLocaleString(),
            end: new Date(conflictDetails.overlapEnd).toLocaleString()
          }));
        }
      }

      let fileUrl = existingEvent.file_path;
      let fileName = existingEvent.filename;
      let contentType = existingEvent.content_type;
      let fileSize = existingEvent.size;

      if (eventData.file) {
        const userId = businessUserId || user?.id;
        const fileExt = eventData.file.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;

        if (existingEvent.file_path) {
          await supabase.storage
            .from('event-files')
            .remove([existingEvent.file_path]);
        }

        const { error: uploadError } = await supabase.storage
          .from('event-files')
          .upload(filePath, eventData.file);

        if (uploadError) {
          console.error("File upload error:", uploadError);
          throw new Error(t('files.fileUploadError'));
        }

        fileUrl = filePath;
        fileName = eventData.file.name;
        contentType = eventData.file.type;
        fileSize = eventData.file.size;
      }

      const updateData = {
        title: eventData.title,
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        type: eventData.type,
        user_surname: eventData.user_surname,
        user_number: eventData.user_number,
        social_network_link: eventData.social_network_link,
        event_notes: eventData.event_notes,
        payment_status: eventData.payment_status,
        payment_amount: eventData.payment_amount,
        file_path: fileUrl,
        filename: fileName,
        content_type: contentType,
        size: fileSize,
        is_group_event: eventData.is_group_event,
        group_name: eventData.group_name,
      };

      const { data, error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", eventData.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: t('common.success'),
        description: t('events.eventUpdated'),
      });
    },
    onError: (error) => {
      console.error("Error updating event:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: t('common.success'),
        description: t('events.eventDeleted'),
      });
    },
    onError: (error) => {
      console.error("Error deleting event:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
        variant: "destructive",
      });
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", businessId, businessUserId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*")
        .is("deleted_at", null)
        .order("start_date", { ascending: true });

      if (businessId && businessUserId) {
        query = query.eq("user_id", businessUserId);
      } else if (user?.id) {
        query = query.eq("user_id", user.id);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!(businessId && businessUserId) || !!user?.id,
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    checkTimeSlotAvailability,
  };
};

// Export the associateBookingFilesWithEvent function for external use
export { associateBookingFilesWithEvent };
