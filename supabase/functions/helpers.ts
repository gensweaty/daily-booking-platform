
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    console.log(`Getting files for booking ID: ${bookingId}`);
    const allFiles = [];
    
    // STEP 1: Check event_files table first (this is where approved booking files end up)
    const { data: eventFilesData, error: eventFilesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (eventFilesError) {
      console.error("Error fetching from event_files:", eventFilesError);
    } else if (eventFilesData && eventFilesData.length > 0) {
      console.log(`Found ${eventFilesData.length} files in event_files`);
      allFiles.push(...eventFilesData.map(file => ({
        ...file,
        source: 'event_files'
      })));
    }
    
    // STEP 2: Fallback - check if the booking request has file metadata directly
    if (allFiles.length === 0) {
      console.log("No files found in dedicated tables, checking booking_requests for file metadata");
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();
        
      if (bookingError) {
        console.error("Error fetching from booking_requests:", bookingError);
      } else if (bookingData && bookingData.file_path) {
        console.log("Found file metadata directly in booking_requests");
        allFiles.push({
          id: `fallback_${bookingId}`,
          booking_request_id: bookingId,
          filename: bookingData.filename || 'attachment',
          file_path: bookingData.file_path,
          content_type: bookingData.content_type || 'application/octet-stream',
          size: bookingData.file_size || bookingData.size || 0,
          created_at: new Date().toISOString(),
          source: 'booking_request_direct'
        });
      }
    }
    
    console.log(`Total files found for booking ID ${bookingId}: ${allFiles.length}`);
    return allFiles;
  } catch (err) {
    console.error("Error in getBookingRequestFiles:", err);
    return [];
  }
};
