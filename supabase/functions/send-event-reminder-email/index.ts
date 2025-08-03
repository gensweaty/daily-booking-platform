import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a map to track recently sent emails to avoid duplicates
const recentlySentEmails = new Map<string, number>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    if (timestamp < tenMinutesAgo) {
      recentlySentEmails.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Helper function to format time with proper timezone and locale
const formatEventTimeForLocale = (dateISO: string, lang: string): string => {
  console.log("Original event date ISO string:", dateISO);
  
  const date = new Date(dateISO);
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'es' ? 'es-ES' : 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tbilisi',
  });

  const formattedResult = formatter.format(date);
  console.log("Formatted event time:", formattedResult);
  console.log("Language:", lang, "Locale:", locale);
  
  return formattedResult;
};

// Multi-language email content for event reminders
const getEventReminderEmailContent = (
  language: string, 
  eventTitle: string, 
  startTime: string,
  endTime: string,
  businessName?: string,
  businessAddress?: string,
  eventNotes?: string,
  paymentStatus?: string,
  paymentAmount?: number | null
) => {
  let subject, body;
  
  // Create business info section if available
  const businessInfo = businessName ? `
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 16px; color: #333;">
        <strong>🏢 ${language === 'ka' ? 'ბიზნესი' : language === 'es' ? 'Negocio' : 'Business'}:</strong> ${businessName}
      </p>
      ${businessAddress ? `<p style="margin: 10px 0; font-size: 14px; color: #666;"><strong>${language === 'ka' ? 'მისამართი' : language === 'es' ? 'Dirección' : 'Address'}:</strong> ${businessAddress}</p>` : ''}
      <p style="margin: 10px 0 0 0; font-size: 16px; color: #333;">
        <strong>📅 ${language === 'ka' ? 'დრო' : language === 'es' ? 'Hora' : 'Time'}:</strong> ${startTime} - ${endTime}
      </p>
      ${eventNotes ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>${language === 'ka' ? 'შენიშვნები' : language === 'es' ? 'Notas' : 'Notes'}:</strong> ${eventNotes}</p>` : ''}
    </div>
  ` : `
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 16px; color: #333;">
        <strong>📅 ${language === 'ka' ? 'დრო' : language === 'es' ? 'Hora' : 'Time'}:</strong> ${startTime} - ${endTime}
      </p>
      ${eventNotes ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>${language === 'ka' ? 'შენიშვნები' : language === 'es' ? 'Notas' : 'Notes'}:</strong> ${eventNotes}</p>` : ''}
    </div>
  `;

  // Create payment info section if available
  const paymentInfo = paymentStatus && paymentStatus !== 'not_paid' ? `
    <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
      <p style="margin: 0; font-size: 16px; color: #155724;">
        💳 ${language === 'ka' ? 'გადახდის სტატუსი' : language === 'es' ? 'Estado de pago' : 'Payment Status'}: 
        ${paymentStatus === 'fully_paid' ? 
          (language === 'ka' ? 'სრულად გადახდილი' : language === 'es' ? 'Pagado completamente' : 'Fully Paid') :
          (language === 'ka' ? 'ნაწილობრივ გადახდილი' : language === 'es' ? 'Pagado parcialmente' : 'Partially Paid')
        }
        ${paymentAmount ? ` (${paymentAmount} ${language === 'ka' ? 'ლარი' : language === 'es' ? 'EUR' : 'USD'})` : ''}
      </p>
    </div>
  ` : '';
  
  if (language === 'ka') {
    subject = "📅 შეხსენება: თქვენი ჯავშანი!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">ჯავშნის შეხსენება</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          შეგახსენებთ თქვენს მოვლენაზე: <strong>${eventTitle}</strong>
        </p>
        ${businessInfo}
        ${paymentInfo}
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p style="margin: 0; font-size: 16px; color: #155724;">✨ არ დაგავიწყდეს თქვენი მოვლენა!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          SmartBookly-დან მიღებული შეხსენება
        </p>
      </div>
    `;
  } else if (language === 'es') {
    subject = "📅 ¡Recordatorio: Su reserva!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Recordatorio de Reserva</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Este es un recordatorio de su evento: <strong>${eventTitle}</strong>
        </p>
        ${businessInfo}
        ${paymentInfo}
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p style="margin: 0; font-size: 16px; color: #155724;">✨ ¡No olvide su evento!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Recordatorio de SmartBookly
        </p>
      </div>
    `;
  } else {
    subject = "📅 Reminder: Your Booking!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Booking Reminder</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          This is a reminder for your event: <strong>${eventTitle}</strong>
        </p>
        ${businessInfo}
        ${paymentInfo}
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p style="margin: 0; font-size: 16px; color: #155724;">✨ Don't forget your event!</p>
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
    console.log('📅 Event reminder email function started');
    
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

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { eventId } = body;

    // If eventId is provided, send email for specific event
    if (eventId) {
      console.log('📧 Sending reminder email for specific event:', eventId);
      
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        console.error('Error fetching event:', eventError);
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Check if email reminder is enabled and email exists
      if (!event.email_reminder_enabled && !event.reminder_enabled) {
        console.log('📧 Email reminder not enabled for event:', eventId);
        return new Response(
          JSON.stringify({ message: 'Email reminder not enabled for this event' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get recipient email from social_network_link field
      const recipientEmail = event.social_network_link;
      if (!recipientEmail || !recipientEmail.includes('@')) {
        console.error(`No valid email found for event ${event.id}`);
        return new Response(
          JSON.stringify({ error: 'No valid email address for event' }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      const deduplicationKey = `${event.id}_${recipientEmail}`;

      // Check if we've recently sent this email (prevent duplicates)
      const recentSendTime = recentlySentEmails.get(deduplicationKey);
      if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
        console.log(`⏭️ Skipping duplicate email for event ${event.id}`);
        return new Response(
          JSON.stringify({ message: 'Email already sent recently' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get user's language and business info
      const { data: profileData } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', event.user_id)
        .single();

      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('business_name, contact_address')
        .eq('user_id', event.user_id)
        .single();

      const language = profileData?.language || 'en';
      const businessName = businessData?.business_name;
      const businessAddress = businessData?.contact_address;
      
      // Format event times using the new function with proper locale and timezone
      const formattedStartTime = formatEventTimeForLocale(event.start_date, language);
      const formattedEndTime = formatEventTimeForLocale(event.end_date, language);

      // Get localized email content with business info
      const { subject, body: emailBody } = getEventReminderEmailContent(
        language, 
        event.title || event.user_surname, 
        formattedStartTime,
        formattedEndTime,
        businessName,
        businessAddress,
        event.event_notes,
        event.payment_status,
        event.payment_amount
      );

      // Send email
      const emailResult = await resend.emails.send({
        from: 'SmartBookly <noreply@smartbookly.com>',
        to: [recipientEmail],
        subject: subject,
        html: emailBody
      });

      if (emailResult.error) {
        console.error(`Failed to send reminder email for event ${event.id}:`, emailResult.error);
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      console.log(`✅ Reminder email sent for event ${event.id} to ${recipientEmail} in language ${language}`);
      
      // Mark the event as email sent and disable future sends
      await supabase
        .from('events')
        .update({ 
          reminder_sent_at: new Date().toISOString(),
          email_reminder_enabled: false,
          reminder_enabled: false
        })
        .eq('id', event.id);

      // Track in deduplication map
      recentlySentEmails.set(deduplicationKey, Date.now());

      return new Response(
        JSON.stringify({
          message: 'Event reminder email sent successfully',
          emailsSent: 1,
          eventId: event.id,
          language: language
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // If no eventId provided, process all due event reminders
    const now = new Date().toISOString();
    
    console.log('📋 Querying for due event reminders...');
    
    // Find events with due reminders that haven't been sent yet
    const { data: dueEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .lte('reminder_at', now)
      .or('email_reminder_enabled.eq.true,reminder_enabled.eq.true')
      .is('reminder_sent_at', null)
      .is('deleted_at', null);

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

    console.log(`📝 Found ${dueEvents?.length || 0} due events with email reminders`);

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
    let emailsSkipped = 0;

    for (const event of dueEvents) {
      try {
        // Get recipient email from social_network_link field
        const recipientEmail = event.social_network_link;
        if (!recipientEmail || !recipientEmail.includes('@')) {
          console.error(`No valid email found for event ${event.id}, skipping`);
          emailsSkipped++;
          continue;
        }

        const deduplicationKey = `${event.id}_${recipientEmail}`;

        // Check if we've recently sent this email
        const recentSendTime = recentlySentEmails.get(deduplicationKey);
        if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
          console.log(`⏭️ Skipping duplicate email for event ${event.id}`);
          emailsSkipped++;
          continue;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', event.user_id)
          .single();

        const { data: businessData } = await supabase
          .from('business_profiles')
          .select('business_name, contact_address')
          .eq('user_id', event.user_id)
          .single();

        const language = profileData?.language || 'en';
        const businessName = businessData?.business_name;
        const businessAddress = businessData?.contact_address;
        
        const formattedStartTime = formatEventTimeForLocale(event.start_date, language);
        const formattedEndTime = formatEventTimeForLocale(event.end_date, language);

        const { subject, body: emailBody } = getEventReminderEmailContent(
          language, 
          event.title || event.user_surname, 
          formattedStartTime,
          formattedEndTime,
          businessName,
          businessAddress,
          event.event_notes,
          event.payment_status,
          event.payment_amount
        );

        const emailResult = await resend.emails.send({
          from: 'SmartBookly <noreply@smartbookly.com>',
          to: [recipientEmail],
          subject: subject,
          html: emailBody
        });

        if (emailResult.error) {
          console.error(`Failed to send reminder email for event ${event.id}:`, emailResult.error);
          continue;
        }

        console.log(`✅ Reminder email sent for event ${event.id} to ${recipientEmail} in language ${language}`);
        
        await supabase
          .from('events')
          .update({ 
            reminder_sent_at: new Date().toISOString(),
            email_reminder_enabled: false,
            reminder_enabled: false
          })
          .eq('id', event.id);

        recentlySentEmails.set(deduplicationKey, Date.now());
        emailsSent++;

      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        continue;
      }
    }

    console.log(`📊 Event reminder email summary: ${emailsSent} sent, ${emailsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent,
        emailsSkipped,
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

serve(handler);
