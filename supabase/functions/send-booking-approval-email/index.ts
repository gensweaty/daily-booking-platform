
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

// Helper function to get currency symbol
const getCurrencySymbol = (language: string): string => {
  console.log("Getting currency symbol for language:", language);
  
  const normalizedLang = language?.toLowerCase() || 'en';
  console.log("Normalized language:", normalizedLang);
  
  let symbol = '$'; // Default
  
  if (normalizedLang === 'ka') {
    console.log("Using ₾ symbol for Georgian");
    symbol = '₾';
  } else if (normalizedLang === 'es') {
    console.log("Using € symbol for Spanish");
    symbol = '€';
  } else {
    console.log("Using $ symbol for language:", normalizedLang);
    symbol = '$';
  }
  
  console.log("Using currency symbol:", symbol, "for language:", normalizedLang);
  return symbol;
};

// Helper function to format date based on language
const formatEventDate = (dateString: string, language: string): string => {
  const date = new Date(dateString);
  
  if (language === 'ka') {
    return date.toLocaleDateString('ka-GE') + ' ' + date.toLocaleTimeString('ka-GE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else if (language === 'es') {
    return date.toLocaleDateString('es-ES') + ' a las ' + date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else {
    return date.toLocaleDateString('en-US') + ' at ' + date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
};

// Multi-language email content
const getEmailContent = (
  language: string, 
  fullName: string, 
  businessName?: string, 
  eventTitle?: string,
  startDate?: string,
  endDate?: string,
  eventNotes?: string,
  paymentStatus?: string,
  paymentAmount?: number | null,
  businessAddress?: string
) => {
  const currencySymbol = getCurrencySymbol(language);
  console.log("Creating email content - Source: booking-approval, Language:", language);
  
  let subject, body;
  let formattedStartDate = startDate ? formatEventDate(startDate, language) : '';
  let formattedEndDate = endDate ? formatEventDate(endDate, language) : '';
  
  if (language === 'ka') {
    subject = "ჯავშანი დამტკიცდა SmartBookly-ში";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">გამარჯობა ${fullName},</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          თქვენი ჯავშანი <span style="color: #22c55e; font-weight: bold;">დამტკიცდა</span> ${businessName ? `ბიზნესში ${businessName}` : 'SmartBookly-ში'}.
        </p>
        ${eventTitle ? `<p style="font-size: 16px;"><strong>მოვლენა:</strong> ${eventTitle}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 16px; color: #333;">
            <strong>ჯავშნის თარიღი და დრო:</strong> ${formattedStartDate}${formattedEndDate ? ` - ${formattedEndDate}` : ''}
          </p>
          ${businessAddress ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>მისამართი:</strong> ${businessAddress}</p>` : `<p style="margin: 10px 0 0 0; font-size: 16px; color: #9333ea;"><strong>მისამართი:</strong> მისამართი დასადასტურებელია</p>`}
          ${paymentStatus ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>გადახდის სტატუსი:</strong> ${paymentStatus === 'not_paid' ? 'არ არის გადახდილი' : paymentStatus === 'partly_paid' ? 'ნაწილობრივ გადახდილი' : 'სრულად გადახდილი'}</p>` : ''}
          ${paymentAmount ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>თანხა:</strong> ${currencySymbol}${paymentAmount}</p>` : ''}
          ${eventNotes ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>შენიშვნები:</strong> ${eventNotes}</p>` : ''}
        </div>
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <p style="margin: 0; font-size: 16px; color: #15803d;">✅ თქვენი ჯავშანი დადასტურებულია!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          SmartBookly-დან მიღებული შეტყობინება
        </p>
      </div>
    `;
  } else if (language === 'es') {
    subject = "Reserva Aprobada en SmartBookly";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Hola ${fullName},</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Tu reserva ha sido <span style="color: #22c55e; font-weight: bold;">aprobada</span> en ${businessName || 'SmartBookly'}.
        </p>
        ${eventTitle ? `<p style="font-size: 16px;"><strong>Evento:</strong> ${eventTitle}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 16px; color: #333;">
            <strong>Fecha y hora de la reserva:</strong> ${formattedStartDate}${formattedEndDate ? ` - ${formattedEndDate}` : ''}
          </p>
          ${businessAddress ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>Dirección:</strong> ${businessAddress}</p>` : `<p style="margin: 10px 0 0 0; font-size: 16px; color: #9333ea;"><strong>Dirección:</strong> Dirección a confirmar</p>`}
          ${paymentStatus ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>Estado del pago:</strong> ${paymentStatus === 'not_paid' ? 'No Pagado' : paymentStatus === 'partly_paid' ? 'Parcialmente Pagado' : 'Completamente Pagado'}</p>` : ''}
          ${paymentAmount ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>Cantidad:</strong> ${currencySymbol}${paymentAmount}</p>` : ''}
          ${eventNotes ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Notas del evento:</strong> ${eventNotes}</p>` : ''}
        </div>
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <p style="margin: 0; font-size: 16px; color: #15803d;">✅ ¡Tu reserva está confirmada!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Mensaje de SmartBookly
        </p>
      </div>
    `;
  } else {
    subject = "Booking Approved at SmartBookly";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Hello ${fullName},</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Your booking has been <span style="color: #22c55e; font-weight: bold;">approved</span> at ${businessName || 'SmartBookly'}.
        </p>
        ${eventTitle ? `<p style="font-size: 16px;"><strong>Event:</strong> ${eventTitle}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 16px; color: #333;">
            <strong>Booking date and time:</strong> ${formattedStartDate}${formattedEndDate ? ` - ${formattedEndDate}` : ''}
          </p>
          ${businessAddress ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>Address:</strong> ${businessAddress}</p>` : `<p style="margin: 10px 0 0 0; font-size: 16px; color: #9333ea;"><strong>Address:</strong> Address to be confirmed</p>`}
          ${paymentStatus ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>Payment status:</strong> ${paymentStatus === 'not_paid' ? 'Not Paid' : paymentStatus === 'partly_paid' ? 'Partly Paid' : 'Fully Paid'}</p>` : ''}
          ${paymentAmount ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: #333;"><strong>Amount:</strong> ${currencySymbol}${paymentAmount}</p>` : ''}
          ${eventNotes ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Event notes:</strong> ${eventNotes}</p>` : ''}
        </div>
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <p style="margin: 0; font-size: 16px; color: #15803d;">✅ Your booking is confirmed!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Message from SmartBookly
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
    console.log('Received request to send booking approval email via Resend API');
    
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
    
    // Handle different parameter structures for backward compatibility
    const {
      eventId,
      recipientEmail,
      fullName,
      businessName,
      eventTitle,
      startDate,
      endDate,
      eventNotes,
      paymentStatus,
      paymentAmount,
      language = 'en',
      source,
      hasBusinessAddress = false
    } = body;

    // If we have an eventId, fetch the event details from database
    let businessAddress = '';
    
    if (eventId) {
      try {
        // First, get the event details
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (eventError) {
          console.error('Error fetching event:', eventError);
        }

        // Try to get business address from business_profiles if available
        if (hasBusinessAddress) {
          const { data: profile, error: profileError } = await supabase
            .from('business_profiles')
            .select('contact_address')
            .eq('user_id', event?.user_id)
            .single();

          if (!profileError && profile?.contact_address) {
            businessAddress = profile.contact_address;
            console.log('Found business address:', businessAddress);
          } else {
            console.log('No business address found or error:', profileError);
          }
        }
      } catch (error) {
        console.error('Error fetching business details:', error);
      }
    }

    console.log("Request body:", {
      recipientEmail,
      fullName,
      businessName,
      paymentStatus,
      paymentAmount,
      language,
      eventNotes,
      source,
      hasBusinessAddress,
      businessAddress
    });

    const deduplicationKey = `${eventId || 'manual'}_${recipientEmail}`;
    
    // Check if we've recently sent this email
    const recentSendTime = recentlySentEmails.get(deduplicationKey);
    if (recentSendTime && Date.now() - recentSendTime < 2 * 60 * 1000) { // 2 minutes
      console.log(`Skipping duplicate email for key: ${deduplicationKey}`);
      return new Response(
        JSON.stringify({ message: 'Email already sent recently' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Fallback address handling
    const finalAddress = businessAddress || (hasBusinessAddress ? "Address to be confirmed" : undefined);
    if (!businessAddress && hasBusinessAddress) {
      console.log("Using fallback address as business address is missing - but continuing with email");
    }

    // Get localized email content
    const { subject, body: emailBody } = getEmailContent(
      language,
      fullName,
      businessName,
      eventTitle,
      startDate,
      endDate,
      eventNotes,
      paymentStatus,
      paymentAmount,
      finalAddress
    );

    console.log(`Sending email with subject: ${subject}`);

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'SmartBookly <noreply@smartbookly.com>',
      to: [recipientEmail],
      subject: subject,
      html: emailBody
    });

    if (emailResult.error) {
      console.error('Failed to send booking approval email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailResult.error }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`Email successfully sent via Resend API to ${recipientEmail}, ID: ${emailResult.data?.id}`);
    
    // Track this email to prevent duplicates
    console.log(`Setting deduplication key: ${deduplicationKey} (tracking ${recentlySentEmails.size + 1} emails)`);
    recentlySentEmails.set(deduplicationKey, Date.now());

    return new Response(
      JSON.stringify({
        message: 'Booking approval email sent successfully',
        emailId: emailResult.data?.id,
        language: language
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in booking approval email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);
