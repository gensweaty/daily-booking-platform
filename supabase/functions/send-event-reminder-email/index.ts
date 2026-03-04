
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "https://esm.sh/resend@4.3.0";

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

// Multi-language email content with business address
const getEmailContent = (language: string, eventTitle: string, startDate: string, endDate: string, paymentStatus?: string, reminderTime?: string, businessAddress?: string) => {
  let subject, body;
  
  const formattedStartDate = formatEventTimeForLocale(startDate, language);
  const formattedEndDate = formatEventTimeForLocale(endDate, language);
  
  // Create address section if business address is available
  const addressSection = businessAddress ? 
    (language === 'ka' ? 
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>მისამართი:</strong> ${businessAddress}</p>` :
      language === 'es' ?
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Dirección:</strong> ${businessAddress}</p>` :
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Address:</strong> ${businessAddress}</p>`
    ) : '';
  
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
            ${addressSection}
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
            ${addressSection}
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
            ${addressSection}
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

    // Handle NULL user_id - find the actual owner
    let actualOwnerId = event.user_id;
    if (!actualOwnerId) {
      console.log('⚠️ Event has NULL user_id, attempting to find owner...');
      
      // Try to find owner through public_boards or other means
      // For now, we'll need to query for events with similar patterns
      // or use the first admin user as fallback
      const { data: adminUsers } = await supabase.auth.admin.listUsers();
      if (adminUsers && adminUsers.users && adminUsers.users.length > 0) {
        actualOwnerId = adminUsers.users[0].id;
        console.log(`⚠️ Using first admin user as owner: ${actualOwnerId}`);
      }
    }

    let userData: any = null;
    let userEmail: string | null = null;
    let language = 'en';
    let businessAddress: string | null = null;

    // Get user email and language preference if we have a valid owner ID
    if (actualOwnerId) {
      try {
        const { data: userDataResult, error: userError } = await supabase.auth.admin.getUserById(actualOwnerId);
        
        if (!userError && userDataResult?.user?.email) {
          userData = userDataResult;
          userEmail = userDataResult.user.email;
          
          // Get user's language preference and business profile from profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('language')
            .eq('id', actualOwnerId)
            .single();

          language = profileData?.language || 'en';

          // Get business profile for address information
          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('contact_address')
            .eq('user_id', actualOwnerId)
            .single();

          businessAddress = businessProfile?.contact_address || null;
          console.log('🏢 Business address found:', businessAddress);
        } else {
          console.error(`⚠️ Could not get user data for ${actualOwnerId}:`, userError);
        }
      } catch (err) {
        console.error(`⚠️ Error getting user data:`, err);
      }
    }


    // IMPROVED: Better email collection logic for event participants
    const emailAddresses = new Set<string>();
    
    // Add main person's email if available and is valid email
    if (event.social_network_link && event.social_network_link.includes('@') && isValidEmail(event.social_network_link)) {
      emailAddresses.add(event.social_network_link);
      console.log('📧 Added main event email:', event.social_network_link);
    }

    // Get additional persons from customers table (only if we have actualOwnerId)
    const { data: customers, error: customersError } = actualOwnerId ? await supabase
      .from('customers')
      .select('social_network_link')
      .eq('event_id', eventId)
      .eq('user_id', actualOwnerId) : { data: null, error: null };

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

    // Get localized email content with business address
    const { subject, body: rawEmailBody } = getEmailContent(
      language, 
      event.title || event.user_surname || 'Event', 
      event.start_date, 
      event.end_date, 
      event.payment_status,
      undefined, // reminderTime not used in this context
      businessAddress
    );

    // Add "View in Calendar" and "Add to Google Calendar" CTA buttons
    const viewLabel = language === 'ka' ? '📅 კალენდარში ნახვა' : language === 'es' ? '📅 Ver en Calendario' : '📅 View in Calendar';
    const gcalLabel = language === 'ka' ? '📅 Google Calendar-ში დამატება' : language === 'es' ? '📅 Añadir a Google Calendar' : '📅 Add to Google Calendar';
    const formatGCalDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const gcalParams = new URLSearchParams({ action: 'TEMPLATE', text: event.title || event.user_surname || 'Event', dates: `${formatGCalDate(event.start_date)}/${formatGCalDate(event.end_date)}` });
    if (businessAddress) gcalParams.set('location', businessAddress);
    if (event.event_notes) gcalParams.set('details', event.event_notes);
    const gcalUrl = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`;
    const ctaButtonsHtml = `
              <div style="text-align: center; margin: 20px 0 10px 0;">
                <a href="https://smartbookly.com/dashboard?tab=calendar" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">${viewLabel}</a>
              </div>
              <div style="text-align: center; margin: 10px 0 20px 0;">
                <a href="${gcalUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4285f4 0%, #34a853 100%); color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">${gcalLabel}</a>
              </div>`;
    const emailBody = rawEmailBody.replace(/<hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">/, ctaButtonsHtml + '<hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">');

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
          console.log(`✅ Reminder email sent for event ${event.id} to ${emailAddress} in language ${language} with business address`);
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

    // CRITICAL: Always try to send AI chat notification, regardless of email success
    // This ensures users get notified even if email sending fails
    if (actualOwnerId) {
      try {
        // ISOLATION FIX: Route chat message to the correct AI channel based on creator
        // If created by sub-user, send to sub-user's AI channel, NOT admin's
        let userIdentity: string;
        let recipientSubUserId: string | null = null;
        let recipientSubUserEmail: string | null = null;
        
        if (event.created_by_type === 'sub_user' && event.created_by_name) {
          // Sub-user created event - find their sub_user record
          const { data: subUserData } = await supabase
            .from('sub_users')
            .select('id, email')
            .eq('board_owner_id', actualOwnerId)
            .or(`fullname.eq.${event.created_by_name},email.ilike.${event.created_by_name}`)
            .limit(1)
            .single();
          
          if (subUserData) {
            // Use sub-user identity for AI channel
            userIdentity = `S:${subUserData.id}`;
            recipientSubUserId = subUserData.id;
            recipientSubUserEmail = subUserData.email;
            console.log(`🔍 Event created by sub-user, routing to sub-user AI channel: ${userIdentity}`);
          } else {
            // Fallback to admin if sub-user not found
            userIdentity = `A:${actualOwnerId}`;
            console.log(`⚠️ Sub-user not found for ${event.created_by_name}, falling back to admin channel`);
          }
        } else {
          // Admin created event - use admin identity
          userIdentity = `A:${actualOwnerId}`;
          console.log(`🔍 Event created by admin, routing to admin AI channel: ${userIdentity}`);
        }
        
        // Use the same RPC function that frontend uses to get/create AI channel
        const { data: aiChannelId, error: channelError } = await supabase.rpc(
          'ensure_unique_ai_channel',
          {
            p_owner_id: actualOwnerId,
            p_user_identity: userIdentity
          }
        );
        
        if (channelError) {
          console.error(`❌ Error getting AI channel:`, channelError);
          throw channelError;
        }

        if (aiChannelId) {
          console.log(`✅ Found AI channel: ${aiChannelId}`);
          
          // Format event reminder message based on language
          const eventTitle = event.title || event.user_surname || 'Event';
          const formattedStartDate = formatEventTimeForLocale(event.start_date, language);
          const formattedEndDate = event.end_date ? formatEventTimeForLocale(event.end_date, language) : null;
          
          const eventMessage = language === 'ka' 
            ? `📅 ღონისძიების შეხსენება\n\n${eventTitle}\n\n🕐 დაწყება: ${formattedStartDate}${formattedEndDate ? `\n🕐 დასრულება: ${formattedEndDate}` : ''}`
            : language === 'es'
            ? `📅 Recordatorio de Evento\n\n${eventTitle}\n\n🕐 Inicio: ${formattedStartDate}${formattedEndDate ? `\n🕐 Fin: ${formattedEndDate}` : ''}`
            : language === 'ru'
            ? `📅 Напоминание о событии\n\n${eventTitle}\n\n🕐 Начало: ${formattedStartDate}${formattedEndDate ? `\n🕐 Конец: ${formattedEndDate}` : ''}`
            : `📅 Event Reminder\n\n${eventTitle}\n\n🕐 Start: ${formattedStartDate}${formattedEndDate ? `\n🕐 End: ${formattedEndDate}` : ''}`;
          
          // Build metadata for recipient routing (ensures correct Dynamic Island targeting)
          const messageMetadata: Record<string, any> = {};
          if (recipientSubUserId) {
            messageMetadata.recipient_type = 'sub_user';
            messageMetadata.recipient_sub_user_id = recipientSubUserId;
            messageMetadata.recipient_email = recipientSubUserEmail;
          } else {
            messageMetadata.recipient_type = 'admin';
            messageMetadata.recipient_user_id = actualOwnerId;
          }
          
          const { error: chatError } = await supabase
            .from('chat_messages')
            .insert({
              channel_id: aiChannelId,
              content: eventMessage,
              sender_type: 'admin',
              sender_user_id: actualOwnerId,
              sender_name: 'Smartbookly AI',
              owner_id: actualOwnerId,
              message_type: 'event_reminder',
              metadata: messageMetadata
            });
          
          if (chatError) {
            console.error(`❌ Error sending chat reminder for event ${event.id}:`, chatError);
          } else {
            console.log(`✅ Sent event reminder chat message for ${event.id} to ${recipientSubUserId ? 'sub-user' : 'admin'} channel`);
          }
        } else {
          console.log(`⚠️ No AI channel found for ${userIdentity}`);
        }
      } catch (chatError) {
        console.error(`⚠️ Could not send event chat message (non-critical):`, chatError);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent,
        emailsFailed,
        eventId: event.id,
        language: language,
        businessAddress: businessAddress
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('❌ Error in event reminder email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
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
