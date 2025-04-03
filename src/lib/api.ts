
// Calendar events for public display
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    // Get the business owner's user ID first
    const { data: businessProfile, error: profileError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
    
    if (profileError) {
      console.error("Error fetching business profile:", profileError);
      throw profileError;
    }
    
    if (!businessProfile?.user_id) {
      console.error("No user ID found for business:", businessId);
      return { events: [], bookings: [] };
    }
    
    const businessUserId = businessProfile.user_id;
    console.log("Fetching events for business user ID:", businessUserId);
    
    // Fetch regular events for the business owner
    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", businessUserId);
    
    if (eventsError) {
      console.error("Error fetching user events:", eventsError);
      throw eventsError;
    }
    
    console.log(`Fetched ${eventsData?.length || 0} regular events for business user`);
    
    // Then fetch approved booking requests
    const { data: bookingsData, error: bookingsError } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "approved");
    
    if (bookingsError) {
      console.error("Error fetching approved bookings:", bookingsError);
      throw bookingsError;
    }
    
    console.log(`Fetched ${bookingsData?.length || 0} approved booking requests`);
    
    return {
      events: eventsData || [],
      bookings: bookingsData || []
    };
  } catch (error: any) {
    console.error("Error fetching public calendar events:", error);
    throw new Error(error.message || "Failed to fetch public calendar events");
  }
};
