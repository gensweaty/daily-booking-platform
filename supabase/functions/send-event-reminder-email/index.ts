
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventReminderPayload {
  eventId: string;
}

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
const formatDateTime = (dateTimeISO: string, lang: string): string => {
  console.log("Original dateTime ISO string:", dateTimeISO);
  
  const date = new Date(dateTimeISO);
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

// Helper function to get currency symbol
const getCurrencySymbolByLanguage = (language: string): string => {
  switch (language) {
    case 'ka': return '₾'; // Georgian Lari
    case 'es': return '€'; // Euro
    default: return '$';   // US Dollar
  }
};

// Helper function to format payment status
const formatPaymentStatus = (status: string, language: string): string => {
  switch (language) {
    case 'ka':
      switch (status) {
        case 'not_paid': return 'არ არის გადახდილი';
        case 'partly_paid': return 'ნაწილობრივ გადახდილი';
        case 'fully_paid': return 'სრულად გადახდილი';
        default: return status;
      }
    case 'es':
      switch (status) {
        case 'not_paid': return 'No pagado';
        case 'partly_paid': return 'Pagado parcialmente';
        case 'fully_paid': return 'Pagado completamente';
        default: return status;
      }
    default:
      switch (status) {
        case 'not_paid': return 'Not paid';
        case 'partly_paid': return 'Partly paid';
        case 'fully_paid': return 'Fully paid';
        default: return status;
      }
  }
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

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    let payload: EventReminderPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const { eventId } = payload;
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'eventId is required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log('📧 Processing event reminder for eventId:', eventId);

    // Fetch event details from database with business info
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id, title, start_date, end_date, user_surname, user_number,
        social_network_link, event_notes, payment_status, payment_amount,
        email_reminder_enabled, reminder_sent_at, language, user_id
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('Failed to fetch event or event not found', eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found or DB error' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // If the reminder was already sent or disabled, skip further processing
    if (!event.email_reminder_enabled) {
      console.log('📧 Email reminder not enabled or already sent for event:', eventId);
      return new Response(
        JSON.stringify({ message: 'Reminder already sent or disabled' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get business information
    const { data: business } = await supabase
      .from('business_profiles')
      .select('business_name, contact_address')
      .eq('user_id', event.user_id)
      .single();

    const businessName = business?.business_name || 'SmartBookly';
    const businessAddress = business?.contact_address;

    // Prepare recipient email and deduplication
    const recipientEmail = event.social_network_link; // Assuming this contains the customer email
    const customerName = event.user_surname;

    if (!recipientEmail) {
      console.error('No email address found for event', event.id);
      return new Response(
        JSON.stringify({ error: 'No email address found for event' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const dedupeKey = `${event.id}_${recipientEmail}`;
    if (recentlySentEmails.has(dedupeKey)) {
      console.log(`⏭️ Skipping duplicate email for event ${event.id}`);
      return new Response(
        JSON.stringify({ message: 'Duplicate reminder skipped', isDuplicate: true }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error('Invalid email address for event', event.id, recipientEmail);
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Format dates in a user-friendly way
    const language = event.language || 'en';
    const formattedStart = formatDateTime(event.start_date, language);
    const formattedEnd = event.end_date ? formatDateTime(event.end_date, language) : null;

    // Build dynamic sections
    const currencySymbol = getCurrencySymbolByLanguage(language);
    let paymentInfo = "";
    if (event.payment_status) {
      const statusText = formatPaymentStatus(event.payment_status, language);
      const paymentLabel = language === 'ka' ? "გადახდის სტატუსი" 
                        : language === 'es' ? "Estado del pago" 
                        : "Payment status";
      if (event.payment_status.includes("part") && event.payment_amount) {
        paymentInfo = `<p><strong>${paymentLabel}:</strong> ${statusText} (${currencySymbol}${event.payment_amount})</p>`;
      } else if (event.payment_status.includes("fully")) {
        const amountText = event.payment_amount ? ` (${currencySymbol}${event.payment_amount})` : "";
        paymentInfo = `<p><strong>${paymentLabel}:</strong> ${statusText}${amountText}</p>`;
      } else {
        paymentInfo = `<p><strong>${paymentLabel}:</strong> ${statusText}</p>`;
      }
    }

    // Address info
    const addressLabel = language === 'ka' ? "მისამართი" 
                     : language === 'es' ? "Dirección" 
                     : "Address";
    let addressInfo = "";
    if (businessAddress) {
      addressInfo = `<p><strong>${addressLabel}:</strong> ${businessAddress}</p>`;
    } else {
      const addrPlaceholder = language === 'ka' ? "მისამართი დაზუსტდება"
                           : language === 'es' ? "Dirección por confirmar"
                           : "Address to be confirmed";
      addressInfo = `<p><strong>${addressLabel}:</strong> ${addrPlaceholder}</p>`;
    }

    // Event notes section
    let notesInfo = "";
    if (event.event_notes && event.event_notes.trim() !== "") {
      const notesLabel = language === 'ka' ? "ღონისძიების შენიშვნა"
                       : language === 'es' ? "Notas del evento"
                       : "Event notes";
      notesInfo = `<p><strong>${notesLabel}:</strong> ${event.event_notes}</p>`;
    }

    // Generate email subject and content based on language
    let emailSubject: string;
    let emailHtml: string;
    switch (language.toLowerCase()) {
      case 'ka':  // Georgian
        emailSubject = `ღონისძიების შეხსენება: ${businessName}`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">ღონისძიების შეხსენება</h2>
            <p>გამარჯობა ${customerName || ''},</p>
            <p>გახსენებთ, რომ თქვენი დაჯავშნილი ღონისძიება გაიმართება <b>${businessName}</b>-ში.</p>
            <p><strong>თარიღი და დრო:</strong> ${formattedStart}${formattedEnd ? ' - ' + formattedEnd : ''}</p>
            ${addressInfo}
            ${paymentInfo}
            ${notesInfo}
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px; color: #333;">✉️ ეს არის ავტომატური შეხსენება. გელოდებით თქვენ ღონისძიებაზე!</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              SmartBookly-დან მიღებული შეხსენება
            </p>
          </div>
        `;
        break;
      case 'es':  // Spanish
        emailSubject = `Recordatorio de Evento en ${businessName}`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Recordatorio de Evento</h2>
            <p>Hola ${customerName || ''},</p>
            <p>Le recordamos que tiene un evento reservado en <b>${businessName}</b>.</p>
            <p><strong>Fecha y hora:</strong> ${formattedStart}${formattedEnd ? ' - ' + formattedEnd : ''}</p>
            ${addressInfo}
            ${paymentInfo}
            ${notesInfo}
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px; color: #333;">✉️ Este es un recordatorio automático. ¡Esperamos verlo en el evento!</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              Recordatorio de SmartBookly
            </p>
          </div>
        `;
        break;
      default:  // English
        emailSubject = `Reminder: Your Upcoming Event at ${businessName}`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Event Reminder</h2>
            <p>Hello ${customerName || ''},</p>
            <p>This is a friendly reminder of your upcoming event at <b>${businessName}</b>.</p>
            <p><strong>Event date and time:</strong> ${formattedStart}${formattedEnd ? ' - ' + formattedEnd : ''}</p>
            ${addressInfo}
            ${paymentInfo}
            ${notesInfo}
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px; color: #333;">✉️ This is an automated reminder. We look forward to seeing you at the event!</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              Reminder from SmartBookly
            </p>
          </div>
        `;
    }

    // Send email via Resend API
    const emailResult = await resend.emails.send({
      from: `${businessName} <noreply@smartbookly.com>`,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml
    });

    if (emailResult.error) {
      console.error('Resend API error:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Email send failed', details: emailResult.error }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`✅ Event reminder email sent for event ${event.id} to ${recipientEmail} in language ${language}`);
    
    // Mark email as sent in the database (disable future reminder)
    await supabase
      .from('events')
      .update({ 
        email_reminder_enabled: false, 
        reminder_sent_at: new Date().toISOString() 
      })
      .eq('id', event.id);

    // Add to deduplication map
    recentlySentEmails.set(dedupeKey, Date.now());

    return new Response(
      JSON.stringify({
        message: 'Event reminder sent successfully',
        emailId: emailResult.data?.id,
        eventId: event.id,
        language: language
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
