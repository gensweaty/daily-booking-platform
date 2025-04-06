import { useState, useEffect } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

export interface UseEventDialogProps {
  createEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  updateEvent?: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  deleteEvent?: (id: string) => Promise<void>;
}

export interface UseEventDialogReturn {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | undefined;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  event: CalendarEventType | undefined;
  setEvent: React.Dispatch<React.SetStateAction<CalendarEventType | undefined>>;
  handleCreateEvent: (eventData: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  handleUpdateEvent: (eventData: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  handleDeleteEvent: (eventId: string) => Promise<void>;
  checkTimeSlotAvailability: (startDateTime: string, endDateTime: string, eventId?: string) => Promise<{ available: boolean; conflictingEvent?: any }>;
  selectedEvent: CalendarEventType | null;
  setSelectedEvent: React.Dispatch<React.SetStateAction<CalendarEventType | null>>;
  isNewEventDialogOpen: boolean;
  setIsNewEventDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  eventFiles: any[];
}

export const useEventDialog = (props?: UseEventDialogProps): UseEventDialogReturn => {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [event, setEvent] = useState<CalendarEventType | undefined>(undefined);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [eventFiles, setEventFiles] = useState<any[]>([]);

  const { handleSubmitEvent, checkTimeSlotAvailability } = useCalendarEvents();
  const { toast } = useToast();

  useEffect(() => {
    const fetchEventFiles = async () => {
      if (selectedEvent?.id || event?.id) {
        const eventId = selectedEvent?.id || event?.id;
        console.log("Fetching files for event ID:", eventId);
        
        try {
          if (selectedEvent?.booking_request_id || event?.booking_request_id) {
            const bookingId = selectedEvent?.booking_request_id || event?.booking_request_id;
            const { data: bookingFiles, error: bookingFilesError } = await supabase
              .from('booking_files')
              .select('*')
              .eq('booking_id', bookingId);
              
            if (bookingFilesError) {
              console.error('Error fetching booking files:', bookingFilesError);
            } else if (bookingFiles && bookingFiles.length > 0) {
              console.log('Found booking files:', bookingFiles);
              setEventFiles(bookingFiles.map(file => ({
                id: file.file_path,
                filename: file.filename,
                content_type: file.content_type,
                source: 'booking_attachments'
              })));
              return;
            }
          }
          
          const { data: files, error } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', eventId);
            
          if (error) {
            console.error('Error fetching event files:', error);
          } else if (files && files.length > 0) {
            console.log('Found event files:', files);
            setEventFiles(files.map(file => ({
              id: file.file_path,
              filename: file.filename,
              content_type: file.content_type,
              source: 'event_attachments'
            })));
          } else {
            setEventFiles([]);
          }
        } catch (error) {
          console.error('Error in fetchEventFiles:', error);
        }
      }
    };
    
    fetchEventFiles();
  }, [selectedEvent, event]);

  const onOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEventFiles([]);
    }
  };

  const handleCreateEvent = async (eventData: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      const submitFn = props?.createEvent || handleSubmitEvent;
      const result = await submitFn(eventData);
      
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      setOpen(false);
      return result;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (eventData: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    try {
      const submitFn = props?.updateEvent || handleSubmitEvent;
      const result = await submitFn(eventData);
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      setOpen(false);
      return result;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteEvent = async (eventId: string): Promise<void> => {
    try {
      const deleteFn = props?.deleteEvent || ((_id: string) => {
        throw new Error("Delete function not provided");
      });
      
      await deleteFn(eventId);
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    open,
    onOpenChange,
    selectedDate,
    setSelectedDate,
    event,
    setEvent,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    checkTimeSlotAvailability,
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    eventFiles,
  };
};
