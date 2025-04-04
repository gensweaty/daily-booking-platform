
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("[API] Getting public calendar events for business:", businessId);
    
    // First get the user_id associated with this business
    const { data: businessData, error: businessError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
      
    if (businessError) {
      console.error("[API] Error fetching business profile:", businessError);
      return { events: [], bookings: [] };
    }
    
    if (!businessData?.user_id) {
      console.error("[API] No user_id found for business:", businessId);
      return { events: [], bookings: [] };
    }

    console.log("[API] Found business user_id:", businessData.user_id);

    // Get events for this user
    const { data: eventData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', businessData.user_id);  // Strict filtering by user_id

    if (eventsError) {
      console.error("[API] Error fetching events:", eventsError);
      return { events: [], bookings: [] };
    }
    
    console.log(`[API] Fetched events count: ${eventData?.length || 0}`);
    
    // Get approved bookings
    const { data: bookingData, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved');
      
    if (bookingsError) {
      console.error("[API] Error fetching booking requests:", bookingsError);
      return { events: eventData || [], bookings: [] };
    }
    
    console.log(`[API] Fetched approved bookings count: ${bookingData?.length || 0}`);
    
    return { 
      events: eventData || [], 
      bookings: bookingData || []
    };
  } catch (err) {
    console.error("[API] Exception in getPublicCalendarEvents:", err);
    return { events: [], bookings: [] };
  }
};
