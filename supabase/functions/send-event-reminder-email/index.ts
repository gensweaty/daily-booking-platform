
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EventReminderRequest {
  eventId: string;
  reminderTime: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, reminderTime, userId }: EventReminderRequest = await req.json();
    
    console.log('Scheduling event reminder:', { eventId, reminderTime, userId });

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get business profile for business info
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Schedule the reminder using a simple setTimeout approach
    // In a real production app, you'd use a proper job queue
    const reminderDate = new Date(reminderTime);
    const now = new Date();
    const delay = reminderDate.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(async () => {
        try {
          // Send the reminder email
          await supabase.functions.invoke('send-booking-approval-email', {
            body: {
              recipientEmail: event.social_network_link,
              fullName: event.title || event.user_surname || 'Customer',
              businessName: businessProfile?.business_name || 'Business',
              startDate: event.start_date,
              endDate: event.end_date,
              paymentStatus: event.payment_status || 'not_paid',
              paymentAmount: event.payment_amount,
              contactAddress: businessProfile?.contact_address || '',
              eventId: event.id,
              language: event.language || 'en',
              eventNotes: event.event_notes || '',
              isReminder: true
            }
          });
          console.log('Event reminder email sent successfully');
        } catch (error) {
          console.error('Error sending reminder email:', error);
        }
      }, delay);

      console.log('Event reminder scheduled successfully');
      return new Response(
        JSON.stringify({ success: true, message: 'Reminder scheduled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('Reminder time is in the past, not scheduling');
      return new Response(
        JSON.stringify({ success: false, message: 'Reminder time is in the past' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in send-event-reminder-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
