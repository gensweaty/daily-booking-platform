
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface EventReminderRequest {
  eventId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`📧 Event reminder email function called at ${new Date().toISOString()}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { eventId }: EventReminderRequest = await req.json();
    console.log(`🔍 Processing event reminder for eventId: ${eventId}`);

    if (!eventId) {
      throw new Error('Event ID is required');
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('❌ Error fetching event:', eventError);
      throw new Error('Event not found');
    }

    console.log(`📅 Event found: ${event.title} (${event.start_date})`);

    // Get business owner details
    const { data: businessData, error: businessError } = await supabaseClient
      .from('business_profiles')
      .select('*')
      .eq('user_id', event.user_id)
      .single();

    if (businessError || !businessData) {
      console.warn('⚠️ No business profile found for user, using default sender');
    }

    // Collect all email recipients from the event
    const recipients: Array<{
      email: string;
      name: string;
    }> = [];

    // Add main event person if they have an email
    if (event.social_network_link && isValidEmail(event.social_network_link)) {
      recipients.push({
        email: event.social_network_link,
        name: event.user_surname || event.title || 'Guest'
      });
    }

    // Get additional persons (customers) for this event
    const { data: customers, error: customersError } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('event_id', eventId)
      .eq('type', 'customer')
      .is('deleted_at', null);

    if (!customersError && customers) {
      customers.forEach(customer => {
        if (customer.social_network_link && isValidEmail(customer.social_network_link)) {
          recipients.push({
            email: customer.social_network_link,
            name: customer.user_surname || customer.title || 'Guest'
          });
        }
      });
    }

    if (recipients.length === 0) {
      console.warn('⚠️ No valid email recipients found for event');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No valid email recipients found' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📧 Found ${recipients.length} email recipients`);

    // Format event date and time
    const eventDate = new Date(event.start_date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient) => {
      try {
        console.log(`📤 Sending reminder email to: ${recipient.email}`);

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h1 style="color: #333; margin: 0 0 10px 0;">📅 Event Reminder</h1>
              <p style="color: #666; margin: 0;">Don't forget about your upcoming event!</p>
            </div>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
              <h2 style="color: #333; margin: 0 0 15px 0;">${event.title}</h2>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #495057;">📅 Date:</strong> ${formattedDate}
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #495057;">🕐 Time:</strong> ${formattedTime}
              </div>
              
              ${event.event_notes ? `
                <div style="margin-bottom: 15px;">
                  <strong style="color: #495057;">📝 Notes:</strong>
                  <p style="margin: 5px 0 0 0; color: #666;">${event.event_notes}</p>
                </div>
              ` : ''}
              
              ${businessData ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                  <p style="color: #666; margin: 0;">
                    <strong>From:</strong> ${businessData.business_name}<br>
                    ${businessData.contact_email ? `<strong>Contact:</strong> ${businessData.contact_email}` : ''}
                  </p>
                </div>
              ` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 14px;">
              <p>This is an automated reminder for your upcoming event.</p>
            </div>
          </div>
        `;

        const { data, error } = await resend.emails.send({
          from: businessData?.business_name 
            ? `${businessData.business_name} <onboarding@resend.dev>` 
            : 'Event Reminder <onboarding@resend.dev>',
          to: [recipient.email],
          subject: `📅 Reminder: ${event.title} - ${formattedDate}`,
          html: emailHtml,
        });

        if (error) {
          console.error(`❌ Failed to send email to ${recipient.email}:`, error);
          return { success: false, email: recipient.email, error };
        }

        console.log(`✅ Email sent successfully to ${recipient.email}`);
        return { success: true, email: recipient.email, data };
      } catch (error) {
        console.error(`❌ Error sending email to ${recipient.email}:`, error);
        return { success: false, email: recipient.email, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`📊 Email results: ${successful} successful, ${failed} failed`);

    // Update the reminder_sent_at field
    const { error: updateError } = await supabaseClient
      .from('events')
      .update({ 
        reminder_sent_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('❌ Error updating reminder_sent_at:', updateError);
    } else {
      console.log('✅ Updated reminder_sent_at for event');
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Sent ${successful} reminder emails`,
      results: {
        successful,
        failed,
        details: results
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in send-event-reminder-email function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

serve(handler);
