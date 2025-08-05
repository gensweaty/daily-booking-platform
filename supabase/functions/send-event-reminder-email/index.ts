
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
const formatReminderTimeForLocale = (reminderAtISO: string, lang: string): string => {
  console.log("Original reminderAt ISO string:", reminderAtISO);
  
  const date = new Date(reminderAtISO);
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
  console.log("Formatted reminder time:", formattedResult);
  console.log("Language:", lang, "Locale:", locale);
  
  return formattedResult;
};

// Format event date and time
const formatEventTimeForLocale = (dateISO: string, lang: string): string => {
  const date = new Date(dateISO);
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'es' ? 'es-ES' : 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tbilisi',
  });

  return formatter.format(date);
};

// Multi-language email content
const getEmailContent = (language: string, eventTitle: string, startDate: string, endDate: string, paymentStatus?: string, reminderTime?: string) => {
  let subject, body;
  
  const formattedStartDate = formatEventTimeForLocale(startDate, language);
  const formattedEndDate = formatEventTimeForLocale(endDate, language);
  
  if (language === 'ka') {
    subject = "📅 მოვლენის შეხსენება - " + eventTitle;
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">📅</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">მოვლენის შეხსენება -</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${eventTitle}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            გამარჯობა ${eventTitle}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ეს არის შეხსენება თქვენი მოახლოებული მოვლენის შესახებ:
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 მოვლენის დეტალები</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>მოვლენა:</strong> ${eventTitle}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>დაწყების თარიღი:</strong> ${formattedStartDate}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>დასრულების თარიღი:</strong> ${formattedEndDate}</p>
            ${paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>გადახდის სტატუსი:</strong> <span style="background: ${paymentStatus === 'fully_paid' ? '#d4edda' : paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${paymentStatus === 'fully_paid' ? '#155724' : paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${paymentStatus === 'fully_paid' ? 'სრულად გადახდილი' : paymentStatus === 'partly_paid' ? 'ნაწილობრივ გადახდილი' : 'არ არის გადახდილი'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 არ დაგავიწყდეს!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            მიღებულია SmartBookly-დან - თქვენი ჭკვიანი დაჯავშნის სისტემა
          </p>
        </div>
      </div>
    `;
  } else if (language === 'es') {
    subject = "📅 Recordatorio de Evento - " + eventTitle;
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">📅</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Recordatorio de Evento -</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${eventTitle}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            ¡Hola ${eventTitle}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Este es un recordatorio sobre tu próximo evento:
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Detalles del Evento</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Evento:</strong> ${eventTitle}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Fecha de Inicio:</strong> ${formattedStartDate}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Fecha de Fin:</strong> ${formattedEndDate}</p>
            ${paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Estado de Pago:</strong> <span style="background: ${paymentStatus === 'fully_paid' ? '#d4edda' : paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${paymentStatus === 'fully_paid' ? '#155724' : paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${paymentStatus === 'fully_paid' ? 'PAGADO' : paymentStatus === 'partly_paid' ? 'PARCIALMENTE PAGADO' : 'NO PAGADO'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 ¡No lo olvides!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            SmartBookly - Sistema de Gestión de Reservas Inteligente
          </p>
        </div>
      </div>
    `;
  } else {
    subject = "📅 Event Reminder - " + eventTitle;
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">📅</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Event Reminder -</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${eventTitle}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            Hello ${eventTitle}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            This is a reminder about your upcoming event:
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Event Details</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Event:</strong> ${eventTitle}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Start Date:</strong> ${formattedStartDate}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>End Date:</strong> ${formattedEndDate}</p>
            ${paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Payment Status:</strong> <span style="background: ${paymentStatus === 'fully_paid' ? '#d4edda' : paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${paymentStatus === 'fully_paid' ? '#155724' : paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${paymentStatus === 'fully_paid' ? 'PAID' : paymentStatus === 'partly_paid' ? 'PARTLY PAID' : 'NOT PAID'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 Don't forget!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            SmartBookly - Smart Booking Management System
          </p>
        </div>
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
    console.log('📅 Event reminder email function called at', new Date().toISOString());
    
    // ADD DEBUGGING: Log the user agent to identify source of calls
    const userAgent = req.headers.get('user-agent') || 'unknown';
    console.log('🔍 Request source - User-Agent:', userAgent);
    
    // Block calls from pg_net (database triggers) since frontend handles this
    if (userAgent.includes('pg_net')) {
      console.log('🚫 Blocking pg_net call - frontend handles event reminders');
      return new Response(
        JSON.stringify({ message: 'Event reminders are handled by frontend, not database triggers' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
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

    // ENHANCED: Better request body parsing with detailed logging
    let body;
    const bodyText = await req.text();
    console.log('📧 Raw request body text:', bodyText);
    console.log('📧 Request body length:', bodyText.length);
    
    if (!bodyText || bodyText.trim() === '') {
      console.error('❌ Empty request body received');
      return new Response(
        JSON.stringify({ error: 'Empty request body' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    try {
      body = JSON.parse(bodyText);
      console.log('📧 Parsed request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('❌ Failed to parse request body as JSON:', parseError);
      console.error('❌ Raw body was:', bodyText);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', rawBody: bodyText }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const { eventId } = body;

    // ENHANCED: Better eventId validation with detailed logging
    if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
      console.error('❌ Missing or invalid eventId in request body:', { eventId, body, userAgent });
      return new Response(
        JSON.stringify({ error: 'Event ID is required and must be a valid string', receivedBody: body }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log('📧 Processing event reminder for eventId:', eventId);

    // Fetch event data
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      console.error('❌ Error fetching event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found', eventId: eventId, dbError: eventError }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log('✅ Found event:', event.title || event.user_surname, 'with ID:', event.id);

    // Check if email reminder is enabled
    if (!event.email_reminder_enabled) {
      console.log('📧 Email reminder not enabled for event:', eventId);
      return new Response(
        JSON.stringify({ message: 'Email reminder not enabled for this event' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get user email and language preference
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(event.user_id);
    
    if (userError || !userData.user?.email) {
      console.error(`❌ Failed to get user email for event ${event.id}:`, userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get user's language preference from profiles table
    const { data: profileData } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', event.user_id)
      .single();

    const language = profileData?.language || 'en';

    // IMPROVED: Better email collection logic for event participants
    const emailAddresses = new Set<string>();
    
    // Add main person's email if available and is valid email
    if (event.social_network_link && event.social_network_link.includes('@') && isValidEmail(event.social_network_link)) {
      emailAddresses.add(event.social_network_link);
      console.log('📧 Added main event email:', event.social_network_link);
    }

    // Get additional persons from customers table
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('social_network_link')
      .eq('event_id', eventId)
      .eq('user_id', event.user_id);

    if (customers && !customersError) {
      customers.forEach(customer => {
        if (customer.social_network_link && customer.social_network_link.includes('@') && isValidEmail(customer.social_network_link)) {
          emailAddresses.add(customer.social_network_link);
          console.log('📧 Added customer email:', customer.social_network_link);
        }
      });
    }

    console.log('📧 Total valid email addresses found:', emailAddresses.size);

    if (emailAddresses.size === 0) {
      console.log('📧 No valid email addresses found for event:', eventId);
      return new Response(
        JSON.stringify({ message: 'No valid email addresses found for this event' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get localized email content
    const { subject, body: emailBody } = getEmailContent(
      language, 
      event.title || event.user_surname || 'Event', 
      event.start_date, 
      event.end_date, 
      event.payment_status
    );

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send emails to all addresses
    for (const emailAddress of emailAddresses) {
      const deduplicationKey = `${event.id}_${emailAddress}`;

      // Check if we've recently sent this email (prevent duplicates)
      const recentSendTime = recentlySentEmails.get(deduplicationKey);
      if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
        console.log(`⏭️ Skipping duplicate email for event ${event.id} to ${emailAddress}`);
        continue;
      }

      try {
        // Send email
        const emailResult = await resend.emails.send({
          from: 'SmartBookly <noreply@smartbookly.com>',
          to: [emailAddress],
          subject: subject,
          html: emailBody
        });

        if (emailResult.error) {
          console.error(`❌ Failed to send email for event ${event.id} to ${emailAddress}:`, emailResult.error);
          emailsFailed++;
        } else {
          console.log(`✅ Reminder email sent for event ${event.id} to ${emailAddress} in language ${language}`);
          recentlySentEmails.set(deduplicationKey, Date.now());
          emailsSent++;
        }
      } catch (error) {
        console.error(`❌ Error sending email to ${emailAddress}:`, error);
        emailsFailed++;
      }
    }

    // Mark the event as email sent and disable future sends if any emails were sent
    if (emailsSent > 0) {
      await supabase
        .from('events')
        .update({ 
          reminder_sent_at: new Date().toISOString(),
          email_reminder_enabled: false
        })
        .eq('id', event.id);
      
      console.log(`✅ Updated event ${event.id} - marked reminder as sent and disabled future emails`);
    }

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent,
        emailsFailed,
        eventId: event.id,
        language: language
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('❌ Error in event reminder email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

serve(handler);
