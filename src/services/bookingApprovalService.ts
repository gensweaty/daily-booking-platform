
import { supabase } from '@/integrations/supabase/client';
import { associateBookingFilesWithEvent } from '@/integrations/supabase/client';

export const approveBookingRequest = async (
  bookingId: string, 
  userId: string
): Promise<{ eventId: string | null; success: boolean }> => {
  try {
    console.log(`[BookingApproval] Starting approval for booking: ${bookingId}`);
    
    // First, get the booking request details
    const { data: booking, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('[BookingApproval] Error fetching booking:', bookingError);
      throw new Error('Booking request not found');
    }

    // Verify the user owns the business
    const { data: business, error: businessError } = await supabase
      .from('business_profiles')
      .select('user_id')
      .eq('id', booking.business_id)
      .single();

    if (businessError || !business || business.user_id !== userId) {
      throw new Error('Unauthorized: You can only approve bookings for your own business');
    }

    // Update booking status to approved
    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({ status: 'approved' })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[BookingApproval] Error updating booking status:', updateError);
      throw updateError;
    }

    // Create a linked event in the events table
    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert({
        title: booking.title,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone,
        social_network_link: booking.requester_email,
        event_notes: booking.description,
        start_date: booking.start_date,
        end_date: booking.end_date,
        payment_status: booking.payment_status || 'not_paid',
        payment_amount: booking.payment_amount,
        user_id: userId, // The business owner
        type: 'booking_request',
        language: booking.language || 'en',
        booking_request_id: bookingId, // CRITICAL: Link back to the booking
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (eventError) {
      console.error('[BookingApproval] Error creating linked event:', eventError);
      throw eventError;
    }

    console.log(`[BookingApproval] Created linked event: ${newEvent.id} for booking: ${bookingId}`);

    // Associate any files from the booking with the new event
    try {
      await associateBookingFilesWithEvent(bookingId, newEvent.id, userId);
      console.log(`[BookingApproval] Associated files from booking ${bookingId} to event ${newEvent.id}`);
    } catch (fileError) {
      console.warn('[BookingApproval] Error associating files:', fileError);
      // Don't fail the approval if file association fails
    }

    return { eventId: newEvent.id, success: true };

  } catch (error) {
    console.error('[BookingApproval] Error in approval process:', error);
    throw error;
  }
};

export const rejectBookingRequest = async (
  bookingId: string, 
  userId: string
): Promise<{ success: boolean }> => {
  try {
    console.log(`[BookingApproval] Starting rejection for booking: ${bookingId}`);
    
    // Get the booking request to verify ownership
    const { data: booking, error: bookingError } = await supabase
      .from('booking_requests')
      .select('business_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking request not found');
    }

    // Verify the user owns the business
    const { data: business, error: businessError } = await supabase
      .from('business_profiles')
      .select('user_id')
      .eq('id', booking.business_id)
      .single();

    if (businessError || !business || business.user_id !== userId) {
      throw new Error('Unauthorized: You can only reject bookings for your own business');
    }

    // Update booking status to rejected
    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({ status: 'rejected' })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[BookingApproval] Error updating booking status:', updateError);
      throw updateError;
    }

    console.log(`[BookingApproval] Successfully rejected booking: ${bookingId}`);
    return { success: true };

  } catch (error) {
    console.error('[BookingApproval] Error in rejection process:', error);
    throw error;
  }
};
