
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingApprovalEmailRequest {
  recipientEmail: string;
  fullName: string;
  businessName: string;
  startDate: string;
  endDate: string;
  paymentStatus?: string; 
  paymentAmount?: number;
  businessAddress?: string;
  eventId?: string;
  source?: string;
  language?: string;
  eventNotes?: string;
}

// For deduplication: Store a map of recently sent emails with expiring entries
const recentlySentEmails = new Map<string, number>();

// Clean up old entries from the deduplication map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    if (now - timestamp > 600000) {
      recentlySentEmails.delete(key);
    }
  }
}, 300000);

// Helper function to get currency symbol based on language
function getCurrencySymbolByLanguage(language?: string): string {
  console.log(`Getting currency symbol for language: ${language}`);
  
  if (!language) {
    console.log("No language provided, defaulting to $ (en)");
    return '$';
  }
  
  const normalizedLang = language.toLowerCase();
  console.log(`Normalized language: ${normalizedLang}`);
  
  switch (normalizedLang) {
    case 'es':
      console.log("Spanish language detected, using € symbol");
      return '€';
    case 'ka':
      console.log("Georgian language detected, using ₾ symbol");
      return '₾';
    case 'en':
    default:
      console.log(`Using $ symbol for language: ${language}`);
      return '$';
  }
}

// Function to get email content based on language
function getEmailContent(
  language: string, 
  fullName: string, 
  businessName: string, 
  formattedStartDate: string,
  formattedEndDate: string,
  paymentInfo: string,
  addressInfo: string,
  eventNotesInfo: string
): string {
  const normalizedLang = (language || 'en').toLowerCase();
  
  console.log(`Creating email content in language: ${normalizedLang}`);
  
  const displayBusinessName = businessName && businessName !== "null" && businessName !== "undefined" 
    ? businessName 
    : 'SmartBookly';
  
  switch (normalizedLang) {
    case 'ka':
      return `
        <!DOCTYPE html>
        <html lang="ka">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ჯავშანი დადასტურებულია</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">გამარჯობა ${fullName},</h2>
          <p>თქვენი ღონისძიება დაიწყება <b>${displayBusinessName}</b>-ში.</p>
          <p style="margin: 8px 0;"><strong>ღონისძიების თარიღი და დრო:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
          ${addressInfo}
          ${paymentInfo}
          ${eventNotesInfo}
          <p>ჩვენ მოუთმენლად ველით თქვენს ნახვას!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>ეს არის ავტომატური შეტყობინება.</i></p>
        </body>
        </html>
      `;
      
    case 'es':
      return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Evento Confirmado</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Hola ${fullName},</h2>
          <p>Su evento ha sido <b style="color: #4CAF50;">confirmado</b> en <b>${displayBusinessName}</b>.</p>
          <p style="margin: 8px 0;"><strong>Fecha y hora del evento:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
          ${addressInfo}
          ${paymentInfo}
          ${eventNotesInfo}
          <p>¡Esperamos verle pronto!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>Este es un mensaje automático.</i></p>
        </body>
        </html>
      `;
      
    default:
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Event Confirmed</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Hello ${fullName},</h2>
          <p>Your event has been <b style="color: #4CAF50;">confirmed</b> at <b>${displayBusinessName}</b>.</p>
          <p style="margin: 8px 0;"><strong>Event date and time:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
          ${addressInfo}
          ${paymentInfo}
          ${eventNotesInfo}
          <p>We look forward to seeing you!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>This is an automated message.</i></p>
        </body>
        </html>
      `;
  }
}

// Format payment status for different languages
function formatPaymentStatus(status: string, language?: string): string {
  const normalizedLang = (language || 'en').toLowerCase();
  
  switch (status) {
    case "not_paid":
      if (normalizedLang === 'ka') return "გადაუხდელი";
      if (normalizedLang === 'es') return "No Pagado";
      return "Not Paid";
      
    case "partly_paid":
    case "partly":
      if (normalizedLang === 'ka') return "ნაწილობრივ გადახდილი";
      if (normalizedLang === 'es') return "Pagado Parcialmente";
      return "Partly Paid";
      
    case "fully_paid":
    case "fully":
      if (normalizedLang === 'ka') return "სრულად გადახდილი";
      if (normalizedLang === 'es') return "Pagado Totalmente";
      return "Fully Paid";
      
    default:
      const formatted = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
      return formatted;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("📧 [EMAIL] Received request to send email via Resend API");
  console.log("📧 [EMAIL] RESEND_API_KEY present:", !!Deno.env.get("RESEND_API_KEY"));

  try {
    const requestBody = await req.text();
    console.log("📧 [EMAIL] Raw request body:", requestBody);
    
    let parsedBody: BookingApprovalEmailRequest;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (parseError) {
      console.error("📧 [EMAIL] Failed to parse JSON request:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    const { 
      recipientEmail, 
      fullName, 
      businessName, 
      startDate, 
      endDate, 
      paymentStatus, 
      paymentAmount,
      businessAddress,
      eventId,
      source,
      language,
      eventNotes
    } = parsedBody;

    console.log("📧 [EMAIL] Parsed request body:", {
      recipientEmail,
      fullName,
      businessName,
      paymentStatus,
      paymentAmount,
      language,
      eventNotes: eventNotes ? "Present" : "Not present",
      businessAddress: businessAddress ? "Present" : "Not present",
      source
    });

    // Build deduplication key
    let dedupeKey: string;
    
    if (eventId) {
      dedupeKey = `${eventId}_${recipientEmail}`;
      
      // Check if we already sent an email for this event/recipient
      const now = Date.now();
      if (recentlySentEmails.has(dedupeKey)) {
        const lastSent = recentlySentEmails.get(dedupeKey);
        const timeAgo = now - (lastSent || 0);
        console.log(`📧 [EMAIL] Duplicate email detected for key ${dedupeKey}. Last sent ${timeAgo}ms ago. Skipping.`);
        
        return new Response(
          JSON.stringify({ 
            message: "Email request was identified as a duplicate and skipped",
            to: recipientEmail,
            id: null,
            isDuplicate: true,
            dedupeKey: dedupeKey,
            timeAgo: timeAgo
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
        );
      }
    } else {
      dedupeKey = `${recipientEmail}_${startDate}_${endDate}`;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("📧 [EMAIL] Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    // Format dates
    const formattedStartDate = formatDateTime(startDate, language);
    const formattedEndDate = formatDateTime(endDate, language);
    
    console.log("📧 [EMAIL] Formatted dates:", { formattedStartDate, formattedEndDate });

    try {
      // Get the currency symbol based on language
      const currencySymbol = getCurrencySymbolByLanguage(language);
      console.log(`📧 [EMAIL] Using currency symbol: ${currencySymbol} for language: ${language}`);
      
      // Format payment information if available based on language
      let paymentInfo = "";
      if (paymentStatus) {
        const formattedStatus = formatPaymentStatus(paymentStatus, language);
        
        const paymentStatusLabel = language === 'ka' 
          ? "გადახდის სტატუსი" 
          : (language === 'es' ? "Estado del pago" : "Payment status");
        
        if ((paymentStatus === 'partly_paid' || paymentStatus === 'partly') && paymentAmount !== undefined && paymentAmount !== null) {
          const amountDisplay = `${currencySymbol}${paymentAmount}`;
          paymentInfo = `<p><strong>${paymentStatusLabel}:</strong> ${formattedStatus} (${amountDisplay})</p>`;
        } else if (paymentStatus === 'fully_paid' || paymentStatus === 'fully') {
          const amountDisplay = paymentAmount !== undefined && paymentAmount !== null ? ` (${currencySymbol}${paymentAmount})` : "";
          paymentInfo = `<p><strong>${paymentStatusLabel}:</strong> ${formattedStatus}${amountDisplay}</p>`;
        } else {
          paymentInfo = `<p><strong>${paymentStatusLabel}:</strong> ${formattedStatus}</p>`;
        }
      }
      
      // Prepare address section
      let addressInfo = "";
      const trimmedAddress = businessAddress?.trim();
      let addressDisplay = trimmedAddress || "Address not provided";
      
      const addressLabel = language === 'ka' 
        ? "მისამართი" 
        : (language === 'es' ? "Dirección" : "Address");
      
      addressInfo = `<p style="margin: 8px 0;"><strong>${addressLabel}:</strong> ${addressDisplay}</p>`;
      
      // Prepare event notes section
      let eventNotesInfo = "";
      if (eventNotes && typeof eventNotes === 'string' && eventNotes.trim() !== "") {
        const notesLabel = language === 'ka'
          ? "შენიშვნა ღონისძიებაზე"
          : (language === 'es' ? "Notas del evento" : "Event notes");
        
        eventNotesInfo = `<p style="margin: 8px 0;"><strong>${notesLabel}:</strong> ${eventNotes.trim()}</p>`;
      }
      
      // Create HTML email content based on language
      const htmlContent = getEmailContent(
        language || 'en', 
        fullName, 
        businessName, 
        formattedStartDate,
        formattedEndDate,
        paymentInfo,
        addressInfo,
        eventNotesInfo
      );
      
      // Use Resend API to send the email
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("📧 [EMAIL] Missing RESEND_API_KEY");
        throw new Error("Missing RESEND_API_KEY");
      }
      
      const resend = new Resend(resendApiKey);
      
      // Email subjects based on language
      const emailSubject = language === 'ka' 
        ? `ღონისძიება დადასტურებულია ${businessName || 'SmartBookly'}-ში` 
        : (language === 'es' 
            ? `Evento Confirmado en ${businessName || 'SmartBookly'}` 
            : `Event Confirmed at ${businessName || 'SmartBookly'}`);
      
      console.log("📧 [EMAIL] Sending email with subject:", emailSubject);
      console.log("📧 [EMAIL] From address:", `${businessName || 'SmartBookly'} <info@smartbookly.com>`);
      console.log("📧 [EMAIL] To address:", recipientEmail);

      const emailResult = await resend.emails.send({
        from: `${businessName || 'SmartBookly'} <info@smartbookly.com>`,
        to: [recipientEmail],
        subject: emailSubject,
        html: htmlContent,
      });

      if (emailResult.error) {
        console.error("📧 [EMAIL] Error from Resend API:", emailResult.error);
        throw new Error(emailResult.error.message || "Unknown Resend API error");
      }

      console.log(`📧 [EMAIL] Email successfully sent via Resend API to ${recipientEmail}, ID: ${emailResult.data?.id}`);
      
      // Mark as recently sent ONLY if the email was successfully sent
      recentlySentEmails.set(dedupeKey, Date.now());
      console.log(`📧 [EMAIL] Setting deduplication key: ${dedupeKey} (tracking ${recentlySentEmails.size} emails)`);
      
      return new Response(
        JSON.stringify({ 
          message: "Email sent successfully",
          to: recipientEmail,
          id: emailResult.data?.id,
          included_address: addressDisplay,
          business_name_used: businessName || 'SmartBookly',
          source: source || 'unknown',
          dedupeKey: dedupeKey,
          language: language,
          currencySymbol: currencySymbol,
          hasEventNotes: !!eventNotesInfo
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
      
    } catch (emailError: any) {
      console.error("📧 [EMAIL] Error sending email via Resend API:", emailError);
      return new Response(
        JSON.stringify({
          error: "Failed to send email via Resend API",
          details: emailError.message || "Unknown error",
          trace: emailError.stack
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
  } catch (error: any) {
    console.error("📧 [EMAIL] Unhandled error in send-booking-approval-email:", error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Unknown error", 
        stack: error?.stack,
        message: "Failed to send email. Please try again later."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
};

// Format dates with timezone awareness using Intl.DateTimeFormat
function formatDateTime(isoString: string, language?: string): string {
  try {
    let locale = 'en-US';
    if (language === 'ka') {
      locale = 'ka-GE';
    } else if (language === 'es') {
      locale = 'es-ES';
    }
    
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Tbilisi',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: language !== 'ka',
    });
    
    const date = new Date(isoString);
    const formatted = formatter.format(date);
    
    return formatted;
  } catch (error) {
    console.error(`📧 [EMAIL] Error formatting date with timezone: ${error}`);
    return isoString;
  }
}

serve(handler);
