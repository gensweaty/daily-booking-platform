
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventReminderRequest {
  eventId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId }: EventReminderRequest = await req.json();
    
    console.log('📅 Processing event reminder email for eventId:', eventId);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch event data
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('❌ Error fetching event:', eventError);
      throw new Error('Event not found');
    }

    // Get business profile for the event owner
    const { data: businessProfile, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', event.user_id)
      .single();

    if (businessError) {
      console.log('ℹ️ No business profile found, using default business info');
    }

    // Call the existing booking approval email function with isReminder = true
    console.log('📧 Calling booking approval email function with reminder flag');
    
    const { data: emailResult, error: emailError } = await supabase.functions.invoke(
      'send-booking-approval-email',
      {
        body: {
          bookingId: eventId,
          isReminder: true
        }
      }
    );

    if (emailError) {
      console.error('❌ Error calling booking approval email function:', emailError);
      throw emailError;
    }

    console.log('✅ Event reminder email sent successfully via booking approval function');

    return new Response(
      JSON.stringify({ success: true, message: 'Event reminder email sent successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in send-event-reminder-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
