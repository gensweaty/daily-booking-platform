
export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">) => {
  // Get current user if available
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  
  try {
    // Ensure payment_amount is properly handled when saving to the database
    const bookingData = {
      ...request,
      status: 'pending',
      user_id: userData?.user?.id || null // Allow null for public bookings
    };
    
    // Make sure payment_amount is correctly formatted as a number or null
    if (bookingData.payment_amount) {
      bookingData.payment_amount = Number(bookingData.payment_amount);
    } else {
      // Explicitly set to null to avoid database errors
      bookingData.payment_amount = null;
    }
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([bookingData])
      .select()
      .single();

    if (error) {
      console.error("Error creating booking request:", error);
      throw error;
    }
    
    console.log("Created booking request:", data);
    return data;
  } catch (error: any) {
    console.error("Error in createBookingRequest:", error);
    throw new Error(error.message || "Failed to create booking request");
  }
};
