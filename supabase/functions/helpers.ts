
// This function will be used by our edge functions to get booking request files
export const getBookingRequestFiles = async (supabase: any, bookingId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_booking_request_files', { booking_id_param: bookingId });
      
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error getting booking request files:", err);
    return [];
  }
};
