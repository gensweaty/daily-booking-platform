
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

// Helper function to get currency symbol based on language
const getCurrencySymbol = (lang: string): string => {
  console.log("Getting currency symbol for language:", lang);
  
  let symbol: string;
  if (lang === 'ka') {
    symbol = '₾'; // Georgian Lari
  } else if (lang === 'es') {
    symbol = '€'; // Euro
  } else {
    symbol = '$'; // US Dollar (default)
  }
  
  console.log(`Using ${symbol} symbol for language: ${lang}`);
  return symbol;
};

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

// Multi-language email content
const getEmailContent = (
  language: string, 
  fullName: string, 
  businessName?: string, 
  startTime?: string, 
  endTime?: string, 
  eventNotes?: string, 
  paymentStatus?: string, 
  paymentAmount?: number,
  businessAddress?: string,
  source?: string
) => {
  const normalizedLanguage = language?.toLowerCase() || 'en';
  console.log("Normalized language:", normalizedLanguage);
  console.log("Creating email content - Source:", source || 'booking-approval', "Language:", normalizedLanguage);

  const currencySymbol = getCurrencySymbol(normalizedLanguage);
  console.log("Using currency symbol:", currencySymbol, "for language:", normalizedLanguage);

  let subject, body;
  
  if (normalizedLanguage === 'ka') {
    subject = "ჯავშანი დადასტურებულია SmartBookly-ზე";
    body = `
      <div style="font-family: 'BPG Glaho WEB Caps', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">✅ ჯავშანი დადასტურებულია!</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            გამარჯობა <strong>${fullName}</strong>,
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 25px;">
            მადლობა SmartBookly-ის სარგებლობისთვის! თქვენი ჯავშანი წარმატებით დადასტურდა.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; border-left: 4px solid #28a745; margin: 25px 0;">
            <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 18px;">📅 ღონისძიების დეტალები</h3>
            ${businessName ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>კომპანია:</strong> ${businessName}</p>` : ''}
            ${startTime ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>დრო:</strong> ${startTime}${endTime ? ` - ${endTime}` : ''}</p>` : ''}
            ${businessAddress ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>მისამართი:</strong> ${businessAddress}</p>` : ''}
            ${eventNotes ? `<p style="margin: 15px 0 0 0; font-size: 14px; color: #666;"><strong>შენიშვნები:</strong> ${eventNotes}</p>` : ''}
          </div>

          ${paymentStatus && paymentStatus !== 'not_paid' ? `
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #17a2b8; margin: 25px 0;">
            <h3 style="color: #17a2b8; margin: 0 0 10px 0; font-size: 16px;">💳 გადახდის ინფორმაცია</h3>
            <p style="margin: 5px 0; font-size: 14px; color: #333;">
              <strong>სტატუსი:</strong> ${paymentStatus === 'fully_paid' ? 'სრულად გადახდილი' : paymentStatus === 'partly_paid' ? 'ნაწილობრივ გადახდილი' : 'არ არის გადახდილი'}
            </p>
            ${paymentAmount && paymentAmount > 0 ? `<p style="margin: 5px 0; font-size: 14px; color: #333;"><strong>თანხა:</strong> ${paymentAmount}${currencySymbol}</p>` : ''}
          </div>` : ''}

          <div style="background-color: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; margin: 25px 0;">
            <p style="margin: 0; font-size: 16px; color: #856404;">
              <strong>⚠️ მნიშვნელოვანი:</strong> გთხოვთ დროული იყოთ და თუ გაქვთ რაიმე კითხვები, დაგვიკავშირდით.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              მადლობა SmartBookly-ის არჩევისთვის!
            </p>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            ეს ავტომატური შეტყობინებაა SmartBookly-სგან. გთხოვთ, ნუ უპასუხებთ ამ ელ-ფოსტას.
          </p>
        </div>
      </div>
    `;
  } else if (normalizedLanguage === 'es') {
    subject = "Reserva Confirmada en SmartBookly";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">✅ ¡Reserva Confirmada!</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            Hola <strong>${fullName}</strong>,
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 25px;">
            ¡Gracias por usar SmartBookly! Tu reserva ha sido confirmada exitosamente.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; border-left: 4px solid #28a745; margin: 25px 0;">
            <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 18px;">📅 Detalles del Evento</h3>
            ${businessName ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>Empresa:</strong> ${businessName}</p>` : ''}
            ${startTime ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ''}</p>` : ''}
            ${businessAddress ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>Dirección:</strong> ${businessAddress}</p>` : ''}
            ${eventNotes ? `<p style="margin: 15px 0 0 0; font-size: 14px; color: #666;"><strong>Notas:</strong> ${eventNotes}</p>` : ''}
          </div>

          ${paymentStatus && paymentStatus !== 'not_paid' ? `
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #17a2b8; margin: 25px 0;">
            <h3 style="color: #17a2b8; margin: 0 0 10px 0; font-size: 16px;">💳 Información de Pago</h3>
            <p style="margin: 5px 0; font-size: 14px; color: #333;">
              <strong>Estado:</strong> ${paymentStatus === 'fully_paid' ? 'Pagado Completamente' : paymentStatus === 'partly_paid' ? 'Pagado Parcialmente' : 'No Pagado'}
            </p>
            ${paymentAmount && paymentAmount > 0 ? `<p style="margin: 5px 0; font-size: 14px; color: #333;"><strong>Monto:</strong> ${paymentAmount}${currencySymbol}</p>` : ''}
          </div>` : ''}

          <div style="background-color: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; margin: 25px 0;">
            <p style="margin: 0; font-size: 16px; color: #856404;">
              <strong>⚠️ Importante:</strong> Por favor llega puntual y si tienes alguna pregunta, no dudes en contactarnos.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              ¡Gracias por elegir SmartBookly!
            </p>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            Este es un mensaje automático de SmartBookly. Por favor no respondas a este correo.
          </p>
        </div>
      </div>
    `;
  } else {
    subject = "Booking Approved at SmartBookly";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">✅ Booking Approved!</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 20px;">
            Hello <strong>${fullName}</strong>,
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 25px;">
            Thank you for using SmartBookly! Your booking has been successfully approved.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; border-left: 4px solid #28a745; margin: 25px 0;">
            <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 18px;">📅 Event Details</h3>
            ${businessName ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>Business:</strong> ${businessName}</p>` : ''}
            ${startTime ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>Time:</strong> ${startTime}${endTime ? ` - ${endTime}` : ''}</p>` : ''}
            ${businessAddress ? `<p style="margin: 5px 0; font-size: 16px; color: #333;"><strong>Address:</strong> ${businessAddress}</p>` : ''}
            ${eventNotes ? `<p style="margin: 15px 0 0 0; font-size: 14px; color: #666;"><strong>Notes:</strong> ${eventNotes}</p>` : ''}
          </div>

          ${paymentStatus && paymentStatus !== 'not_paid' ? `
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #17a2b8; margin: 25px 0;">
            <h3 style="color: #17a2b8; margin: 0 0 10px 0; font-size: 16px;">💳 Payment Information</h3>
            <p style="margin: 5px 0; font-size: 14px; color: #333;">
              <strong>Status:</strong> ${paymentStatus === 'fully_paid' ? 'Fully Paid' : paymentStatus === 'partly_paid' ? 'Partially Paid' : 'Not Paid'}
            </p>
            ${paymentAmount && paymentAmount > 0 ? `<p style="margin: 5px 0; font-size: 14px; color: #333;"><strong>Amount:</strong> ${currencySymbol}${paymentAmount}</p>` : ''}
          </div>` : ''}

          <div style="background-color: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; margin: 25px 0;">
            <p style="margin: 0; font-size: 16px; color: #856404;">
              <strong>⚠️ Important:</strong> Please arrive on time and feel free to contact us if you have any questions.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              Thank you for choosing SmartBookly!
            </p>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            This is an automated message from SmartBookly. Please do not reply to this email.
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { 
      eventId, 
      recipientEmail, 
      language = 'en', 
      fullName, 
      businessName, 
      startDate, 
      endDate, 
      eventNotes, 
      paymentStatus, 
      paymentAmount,
      source,
      businessAddress
    } = body;

    console.log("Request body:", {
      recipientEmail,
      fullName,
      businessName,
      paymentStatus,
      paymentAmount,
      language,
      eventNotes,
      source,
      hasBusinessAddress: !!businessAddress,
      businessAddress: businessAddress || ""
    });

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid recipient email is required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Check for duplicate emails
    const deduplicationKey = `${eventId}_${recipientEmail}`;
    const recentSendTime = recentlySentEmails.get(deduplicationKey);
    if (recentSendTime && Date.now() - recentSendTime < 5 * 60 * 1000) {
      console.log(`Skipping duplicate email for event ${eventId}`);
      return new Response(
        JSON.stringify({ message: 'Email already sent recently', duplicate: true }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Format dates if provided
    let formattedStartTime, formattedEndTime;
    if (startDate) {
      formattedStartTime = formatEventTimeForLocale(startDate, language);
    }
    if (endDate) {
      formattedEndTime = formatEventTimeForLocale(endDate, language);
    }

    // Get email content with business address
    const { subject, body: emailBody } = getEmailContent(
      language, 
      fullName || 'User', 
      businessName, 
      formattedStartTime, 
      formattedEndTime, 
      eventNotes, 
      paymentStatus, 
      paymentAmount,
      businessAddress, // Pass the business address
      source
    );

    console.log("Sending email with subject:", subject);

    // Send email
    const emailResult = await resend.emails.send({
      from: 'SmartBookly <noreply@smartbookly.com>',
      to: [recipientEmail],
      subject: subject,
      html: emailBody
    });

    if (emailResult.error) {
      console.error('Failed to send email via Resend API:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailResult.error }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`Email successfully sent via Resend API to ${recipientEmail}, ID: ${emailResult.data?.id}`);
    
    // Track sent email
    recentlySentEmails.set(deduplicationKey, Date.now());
    console.log(`Setting deduplication key: ${deduplicationKey} (tracking ${recentlySentEmails.size} emails)`);

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

  } catch (error: any) {
    console.error('Error in send-booking-approval-email function:', error);
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
