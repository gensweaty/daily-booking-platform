import { supabase } from "./supabase";
import { BookingRequest } from "@/types/database";

// Function to create a booking request
export const createBookingRequest = async (data: Partial<BookingRequest>) => {
  console.log("Creating booking request with data:", data);
  
  try {
    // Check if booking_files table exists, if not create it
    const { error: tableCheckError } = await supabase
      .from('booking_files')
      .select('id')
      .limit(1)
      .catch(() => ({ error: { message: 'Table does not exist' } }));
    
    if (tableCheckError) {
      console.log('booking_files table might not exist, trying to create it');
      
      try {
        // Execute SQL to create the table
        const { error: createTableError } = await supabase.rpc('create_booking_files_table_if_not_exists');
        
        if (createTableError) {
          console.error('Error creating booking_files table:', createTableError);
        } else {
          console.log('Successfully created booking_files table');
        }
      } catch (err) {
        console.error('Exception creating booking_files table:', err);
      }
    }
    
    const { data: insertedData, error } = await supabase
      .from('booking_requests')
      .insert(data)
      .select()
      .single();
      
    if (error) {
      console.error("Error creating booking request:", error);
      throw new Error(error.message);
    }
    
    return insertedData;
  } catch (error: any) {
    console.error("Exception in createBookingRequest:", error);
    throw new Error(`Failed to create booking request: ${error.message}`);
  }
};

// Get public calendar events
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("Getting public calendar events for business ID:", businessId);
    
    // Call the Supabase function to get public events
    const { data, error } = await supabase.rpc('get_public_calendar_events', {
      business_id: businessId
    });
    
    if (error) {
      console.error("Error fetching public calendar events:", error);
      throw error;
    }
    
    return data || { events: [], bookings: [] };
  } catch (error) {
    console.error("Exception in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};
