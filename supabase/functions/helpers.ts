
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    // Get files from the event_files table first (files are stored here)
    const { data, error } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (error) throw error;
    
    // If files found in event_files, return them
    if (data && data.length > 0) {
      return data;
    }
    
    // Try booking_files table next (this should be the main source for pending bookings)
    const { data: bookingFileData, error: bookingFileError } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingId);
      
    if (bookingFileError) throw bookingFileError;
    
    // If files found in booking_files, return them
    if (bookingFileData && bookingFileData.length > 0) {
      return bookingFileData;
    }
    
    // Fallback: check if the booking request has file metadata directly
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')  // Select all columns to avoid type errors
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError) throw bookingError;
    
    // If booking has file metadata, return it as a file entry
    if (bookingData && bookingData.file_path) {
      return [{
        id: `fallback_${bookingId}`,
        booking_request_id: bookingId,
        filename: bookingData.filename || 'attachment',
        file_path: bookingData.file_path,
        content_type: bookingData.content_type || 'application/octet-stream',
        size: bookingData.file_size || 0,
        created_at: new Date().toISOString(),
        source: 'booking_request_direct'
      }];
    }
    
    // No files found in either location
    return [];
  } catch (err) {
    console.error("Error getting booking request files:", err);
    return [];
  }
};
