
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    // Get files from the booking_files table first
    const { data, error } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingId);
      
    if (error) throw error;
    
    // If files found in booking_files, return them
    if (data && data.length > 0) {
      return data;
    }
    
    // Fallback: check if the booking request has file metadata directly
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('file_path, filename, content_type, file_size')
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
