
import { supabase } from "./supabase";
import { CalendarEventType } from "./types/calendar";

export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    // First get the user_id for this business
    const { data: businessData, error: businessError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
    
    if (businessError) {
      console.error("Error fetching business user ID:", businessError);
      throw businessError;
    }
    
    if (!businessData?.user_id) {
      console.error("No user ID found for business:", businessId);
      throw new Error("Business not found");
    }
    
    console.log(`[API] Getting calendar events for user ${businessData.user_id}`);
    
    // Get all events for this user, explicitly excluding deleted events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', businessData.user_id)
      .is('deleted_at', null) // IMPORTANT: Only get non-deleted events
      .order('start_date', { ascending: true });
    
    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }
    
    console.log(`[API] Found ${events?.length || 0} calendar events`);
    
    // Get approved booking requests for this business
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .order('start_date', { ascending: true });
    
    if (bookingsError) {
      console.error("Error fetching approved bookings:", bookingsError);
      throw bookingsError;
    }
    
    console.log(`[API] Found ${bookings?.length || 0} approved booking requests`);
    
    return { events, bookings };
  } catch (error) {
    console.error("Error in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};
