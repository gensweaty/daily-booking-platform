
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useEventFiles = (eventId?: string) => {
  return useQuery({
    queryKey: ['eventFiles', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      console.log("Fetching files for event:", eventId);
      
      // First check in event_files table
      const { data: eventFiles, error: eventFilesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);
        
      if (eventFilesError) {
        console.error("Error fetching event_files:", eventFilesError);
        throw eventFilesError;
      }
      
      console.log(`Found ${eventFiles?.length || 0} files in event_files table`);
      
      // Get the event to check if it's a converted booking
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('booking_request_id, file_path, filename')
        .eq('id', eventId)
        .maybeSingle();
        
      if (eventError) {
        console.error("Error fetching event:", eventError);
      }
      
      let result = [...(eventFiles || [])];
      
      // Check if the event has a direct file_path that's not in event_files
      if (event?.file_path && !result.some(file => file.file_path === event.file_path)) {
        console.log("Adding direct file from event:", event.file_path);
        result.push({
          id: `event-direct-${eventId}`,
          event_id: eventId,
          filename: event.filename || 'attachment',
          file_path: event.file_path,
          content_type: 'application/octet-stream',
          size: 0,
          created_at: new Date().toISOString(),
          source: 'event'
        });
      }
      
      // If this is a converted booking, check the original booking files
      if (event?.booking_request_id) {
        console.log("This is a converted booking, checking original booking files:", event.booking_request_id);
        
        // Check for file in booking_requests
        const { data: bookingData, error: bookingError } = await supabase
          .from('booking_requests')
          .select('file_path, filename')
          .eq('id', event.booking_request_id)
          .maybeSingle();
          
        if (bookingError) {
          console.error("Error fetching booking_requests:", bookingError);
        } else if (bookingData?.file_path && !result.some(file => file.file_path === bookingData.file_path)) {
          console.log("Adding file from booking_requests:", bookingData.file_path);
          result.push({
            id: `booking-direct-${event.booking_request_id}`,
            event_id: eventId,
            filename: bookingData.filename || 'attachment',
            file_path: bookingData.file_path,
            content_type: 'application/octet-stream',
            size: 0,
            created_at: new Date().toISOString(),
            source: 'booking_request'
          });
        }
        
        // Check for files in booking_files
        const { data: bookingFilesData, error: bookingFilesError } = await supabase
          .from("booking_files")
          .select("*")
          .eq("booking_id", event.booking_request_id);
          
        if (bookingFilesError) {
          console.error("Error fetching booking_files:", bookingFilesError);
        } else if (bookingFilesData && bookingFilesData.length > 0) {
          console.log(`Found ${bookingFilesData.length} files in booking_files`);
          
          // Add files that aren't already in the result
          const bookingFiles = bookingFilesData.filter(
            file => !result.some(existing => existing.file_path === file.file_path)
          ).map(file => ({
            id: `booking-file-${file.id}`,
            event_id: eventId,
            filename: file.filename || 'attachment',
            file_path: file.file_path,
            content_type: file.content_type || 'application/octet-stream',
            size: file.size || 0,
            created_at: file.created_at || new Date().toISOString(),
            source: 'booking_files'
          }));
          
          result = [...result, ...bookingFiles];
        }
      }
      
      // Check if this is actually a booking_request
      const { data: bookingRequestData, error: bookingRequestError } = await supabase
        .from('booking_requests')
        .select('file_path, filename')
        .eq('id', eventId)
        .maybeSingle();
        
      if (bookingRequestError) {
        console.error("Error checking if event ID is a booking_request:", bookingRequestError);
      } else if (bookingRequestData) {
        console.log("This is a booking request, checking for its files:", eventId);
        
        // Add direct file from booking_requests
        if (bookingRequestData.file_path && !result.some(file => file.file_path === bookingRequestData.file_path)) {
          console.log("Adding file from booking_requests for booking:", bookingRequestData.file_path);
          result.push({
            id: `booking-direct-${eventId}`,
            event_id: eventId,
            filename: bookingRequestData.filename || 'attachment',
            file_path: bookingRequestData.file_path,
            content_type: 'application/octet-stream',
            size: 0,
            created_at: new Date().toISOString(),
            source: 'booking_request'
          });
        }
        
        // Check for files in booking_files
        const { data: bookingFilesData, error: bookingFilesError } = await supabase
          .from("booking_files")
          .select("*")
          .eq("booking_id", eventId);
          
        if (bookingFilesError) {
          console.error("Error fetching booking_files for booking:", bookingFilesError);
        } else if (bookingFilesData && bookingFilesData.length > 0) {
          console.log(`Found ${bookingFilesData.length} files in booking_files for booking`);
          
          // Add files that aren't already in the result
          const bookingFiles = bookingFilesData.filter(
            file => !result.some(existing => existing.file_path === file.file_path)
          ).map(file => ({
            id: `booking-file-${file.id}`,
            event_id: eventId,
            filename: file.filename || 'attachment',
            file_path: file.file_path,
            content_type: file.content_type || 'application/octet-stream',
            size: file.size || 0,
            created_at: file.created_at || new Date().toISOString(),
            source: 'booking_files'
          }));
          
          result = [...result, ...bookingFiles];
        }
      }
      
      console.log(`Total files found for event ${eventId}: ${result.length}`);
      return result;
    },
    enabled: !!eventId,
    staleTime: 30000, // 30 seconds
  });
};
