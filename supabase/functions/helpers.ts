
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    // Get files from the booking_files table instead of event_files
    const { data, error } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingId);
      
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error getting booking request files:", err);
    return [];
  }
};
