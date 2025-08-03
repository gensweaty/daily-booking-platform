
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Get user profile for the event owner
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', event.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('❌ Error fetching user profile:', profileError);
      throw new Error('User profile not found or email missing');
    }

    // Get business profile for the event owner (optional)
    const { data: businessProfile, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', event.user_id)
      .single();

    if (businessError) {
      console.log('ℹ️ No business profile found, using default business info');
    }

    const businessName = businessProfile?.business_name || 'Your Business';
    const contactEmail = businessProfile?.contact_email || profile.email;

    // Create reminder email content
    const emailSubject = `🔔 Event Reminder: ${event.title || event.user_surname}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Event Reminder</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px 0; }
            .event-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; }
            .reminder-icon { font-size: 24px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="reminder-icon">🔔</div>
              <h1>Event Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${profile.full_name || 'there'},</p>
              <p>This is a reminder about your upcoming event:</p>
              <div class="event-details">
                <strong>Event:</strong> ${event.title || event.user_surname}<br>
                ${event.user_surname ? `<strong>Client:</strong> ${event.user_surname}<br>` : ''}
                ${event.user_number ? `<strong>Phone:</strong> ${event.user_number}<br>` : ''}
                ${event.social_network_link ? `<strong>Contact:</strong> ${event.social_network_link}<br>` : ''}
                <strong>Date:</strong> ${new Date(event.start_date).toLocaleDateString()}<br>
                <strong>Time:</strong> ${new Date(event.start_date).toLocaleTimeString()} - ${new Date(event.end_date).toLocaleTimeString()}<br>
                ${event.event_notes ? `<strong>Notes:</strong> ${event.event_notes}<br>` : ''}
                ${event.payment_status && event.payment_status !== 'not_paid' ? `<strong>Payment Status:</strong> ${event.payment_status.replace('_', ' ')}<br>` : ''}
                ${event.payment_amount ? `<strong>Amount:</strong> $${event.payment_amount}<br>` : ''}
              </div>
              <p>Don't forget about this upcoming event!</p>
            </div>
            <div class="footer">
              <p>Contact: ${contactEmail}</p>
              <p>${businessName}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send the email
    const { error: emailError } = await resend.emails.send({
      from: `${businessName} <onboarding@resend.dev>`,
      to: [profile.email],
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailError) {
      console.error('❌ Error sending reminder email:', emailError);
      throw emailError;
    }

    console.log('✅ Event reminder email sent successfully to:', profile.email);

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
