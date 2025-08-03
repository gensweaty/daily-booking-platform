
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to format time with proper timezone and locale
const formatEventTimeForLocale = (dateISO: string, lang: string): string => {
  const date = new Date(dateISO);
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'es' ? 'es-ES' : 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  return formatter.format(date);
};

// Multi-language email content
const getEventReminderEmailContent = (
  language: string, 
  eventTitle: string, 
  startTime: string, 
  endTime: string,
  eventNotes?: string
) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = "🔔 ღონისძიების შეხსენება!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">ღონისძიების შეხსენება</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          შეგახსენებთ ღონისძიებაზე: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>დაწყების დრო:</strong> ${startTime}
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>დამთავრების დრო:</strong> ${endTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>შენიშვნები:</strong> ${eventNotes}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">📅 არ დაგავიწყდეს!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          SmartBookly-დან მიღებული შეხსენება
        </p>
      </div>
    `;
  } else if (language === 'es') {
    subject = "🔔 ¡Recordatorio de evento!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Recordatorio de Evento</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Este es un recordatorio para tu evento: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Hora de inicio:</strong> ${startTime}
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Hora de finalización:</strong> ${endTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>Notas:</strong> ${eventNotes}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">📅 ¡No lo olvides!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Recordatorio de SmartBookly
        </p>
      </div>
    `;
  } else {
    subject = "🔔 Event Reminder!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Event Reminder</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          This is a reminder for your upcoming event: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Start time:</strong> ${startTime}
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>End time:</strong> ${endTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>Notes:</strong> ${eventNotes}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">📅 Don't forget!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Reminder from SmartBookly
        </p>
      </div>
    `;
  }
  
  return { subject, body };
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Event reminder email function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { eventId } = body;

    // If eventId is provided, send email for specific event
    if (eventId) {
      console.log('📧 Sending email for specific event:', eventId);
      
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('email_reminder_enabled', true)
        .is('reminder_sent_at', null)
        .single();

      if (eventError || !event) {
        console.error('Error fetching event or event not eligible for reminder:', eventError);
        return new Response(
          JSON.stringify({ error: 'Event not found or not eligible for reminder' }),
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      await processEventReminder(supabase, resend, event);
      
      return new Response(
        JSON.stringify({
          message: 'Event reminder email sent successfully',
          eventId: event.id
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Bulk processing: get all due reminders
    console.log('📋 Processing all due event reminders...');
    
    const { data: dueEvents, error: eventsError } = await supabase
      .rpc('get_due_event_reminders');

    if (eventsError) {
      console.error('Error fetching due events:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch due events' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`📝 Found ${dueEvents?.length || 0} due event reminders`);

    if (!dueEvents || dueEvents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No due event reminders found' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const event of dueEvents) {
      try {
        await processEventReminder(supabase, resend, event);
        emailsSent++;
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        emailsFailed++;
      }
    }

    console.log(`📊 Event reminder email summary: ${emailsSent} sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent,
        emailsFailed,
        totalEvents: dueEvents.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in event reminder email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

async function processEventReminder(supabase: any, resend: any, event: any) {
  // Get event participants (main contact + additional customers)
  const recipients: string[] = [];
  
  // Add main event contact email
  if (event.social_network_link && event.social_network_link.includes('@')) {
    recipients.push(event.social_network_link);
  }

  // Get additional participants from customers table
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('social_network_link')
    .eq('event_id', event.id);

  if (!customersError && customers) {
    customers.forEach((customer: any) => {
      if (customer.social_network_link && 
          customer.social_network_link.includes('@') && 
          !recipients.includes(customer.social_network_link)) {
        recipients.push(customer.social_network_link);
      }
    });
  }

  if (recipients.length === 0) {
    console.log(`⚠️ No valid email recipients found for event ${event.id}`);
    // Mark as sent anyway to avoid repeated attempts
    await supabase.rpc('mark_reminder_sent', { event_id: event.id });
    return;
  }

  // Get user's language preference
  const { data: profileData } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', event.user_id)
    .single();

  const language = profileData?.language || 'en';
  
  // Format event times
  const formattedStartTime = formatEventTimeForLocale(event.start_date, language);
  const formattedEndTime = formatEventTimeForLocale(event.end_date, language);

  // Get localized email content
  const { subject, body } = getEventReminderEmailContent(
    language, 
    event.title, 
    formattedStartTime, 
    formattedEndTime,
    event.event_notes
  );

  // Send individual emails to each recipient
  for (const email of recipients) {
    try {
      const emailResult = await resend.emails.send({
        from: 'SmartBookly <noreply@smartbookly.com>',
        to: [email],
        subject: subject,
        html: body
      });

      if (emailResult.error) {
        console.error(`Failed to send email to ${email}:`, emailResult.error);
        throw emailResult.error;
      }

      console.log(`✅ Reminder email sent for event ${event.id} to ${email} in language ${language}`);
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  }

  // Mark reminder as sent
  await supabase.rpc('mark_reminder_sent', { event_id: event.id });
}

serve(handler);
