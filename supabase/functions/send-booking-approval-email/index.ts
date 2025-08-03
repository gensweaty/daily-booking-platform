import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Memory-based deduplication to prevent spam (with auto-cleanup)
const recentlySentEmails = new Map<string, number>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    if (timestamp < tenMinutesAgo) {
      recentlySentEmails.delete(key);
    }
  }
}, 10 * 60 * 1000);

interface BookingApprovalRequest {
  recipientEmail: string;
  fullName: string;
  businessName: string;
  startDate: string;
  endDate: string;
  paymentStatus?: string;
  paymentAmount?: number;
  businessAddress?: string;
  eventId?: string;
  language?: string;
  eventNotes?: string;
  source?: 'booking-approval' | 'event-creation' | 'event-reminder'; // Added event-reminder
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      language = 'en',
      eventNotes,
      source = 'booking-approval'
    }: BookingApprovalRequest = await req.json();

    console.log(`📧 Processing ${source} email for:`, recipientEmail);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error("Invalid email format");
    }

    // Enhanced deduplication logic
    let dedupeKey: string;
    if (eventId) {
      dedupeKey = `${eventId}_${recipientEmail}`;
      
      const now = Date.now();
      const lastSent = recentlySentEmails.get(dedupeKey);
      const timeAgo = now - (lastSent || 0);
      
      // Only block if sent within last 2 minutes (anti-spam for regular emails)
      // For reminders, allow them to pass through as they are scheduled
      if (timeAgo < 120000 && source !== 'event-reminder') {
        console.log("⏭️ Skipping duplicate email (sent recently)");
        return new Response(JSON.stringify({ 
          message: "Duplicate email blocked", 
          isDuplicate: true 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      dedupeKey = `${recipientEmail}_${startDate}_${endDate}`;
    }

    // Format dates with proper localization
    const formattedStartDate = formatDateTime(startDate, language);
    const formattedEndDate = formatDateTime(endDate, language);
    
    console.log("📅 Formatted dates:", { formattedStartDate, formattedEndDate });

    // Build payment information section with currency
    const currencySymbol = getCurrencySymbolByLanguage(language);
    const paymentInfo = buildPaymentInfoHTML(paymentStatus, paymentAmount, currencySymbol, language);

    // Build address information with fallback
    const addressInfo = businessAddress?.trim() || getAddressFallback(language);

    // Build event notes section 
    const eventNotesInfo = eventNotes ? buildNotesHTML(eventNotes, language) : "";

    const displayBusinessName = businessName || 'SmartBookly';

    // Generate email content based on source and language
    const { subject, content } = getEmailContent(
      source, 
      language, 
      fullName, 
      displayBusinessName,
      formattedStartDate,
      formattedEndDate,
      paymentInfo,
      addressInfo,
      eventNotesInfo
    );

    // Send email via Resend
    const result = await resend.emails.send({
      from: `${displayBusinessName} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject,
      html: content,
    });

    if (result.error) {
      console.error("❌ Resend API error:", result.error);
      throw new Error(`Failed to send email: ${result.error.message}`);
    }

    // Track successful send in deduplication map (including reminders)
    recentlySentEmails.set(dedupeKey, Date.now());
    
    console.log("✅ Email sent successfully:", result.data?.id);

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.data?.id,
      source: source 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Error in send-booking-approval-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        source: 'error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

// Helper function to format date/time based on language
function formatDateTime(dateTimeStr: string, language: string): string {
  const date = new Date(dateTimeStr);
  const locale = language === 'ka' ? 'ka-GE' : language === 'es' ? 'es-ES' : 'en-US';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tbilisi'
  }).format(date);
}

// Helper function to get currency symbol based on language
function getCurrencySymbolByLanguage(language: string): string {
  switch (language?.toLowerCase()) {
    case 'es':
      return '€';
    case 'ka': 
      return '₾';
    case 'en':
    default:
      return '$';
  }
}

// Helper function to format payment status based on language
function formatPaymentStatus(status: string, language: string): string {
  const normalizedLang = (language || 'en').toLowerCase();
  
  switch (status) {
    case "not_paid":
      return normalizedLang === 'ka' ? "გადაუხდელი" :
             normalizedLang === 'es' ? "No Pagado" : "Not Paid";
    case "partly_paid":
      return normalizedLang === 'ka' ? "ნაწილობრივ გადახდილი" :
             normalizedLang === 'es' ? "Pagado Parcialmente" : "Partly Paid";
    case "fully_paid":
      return normalizedLang === 'ka' ? "სრულად გადახდილი" :
             normalizedLang === 'es' ? "Pagado Totalmente" : "Fully Paid";
    default:
      return status;
  }
}

// Helper function to build payment info HTML
function buildPaymentInfoHTML(paymentStatus: string | undefined, paymentAmount: number | undefined, currencySymbol: string, language: string): string {
  if (!paymentStatus) return "";
  
  const formattedStatus = formatPaymentStatus(paymentStatus, language);
  let paymentInfo = `<p><strong>${getPaymentLabel(language)}:</strong> ${formattedStatus}`;
  
  if (paymentAmount && paymentAmount > 0 && (paymentStatus === "partly_paid" || paymentStatus === "fully_paid")) {
    paymentInfo += ` (${currencySymbol}${paymentAmount})`;
  }
  
  paymentInfo += "</p>";
  return paymentInfo;
}

// Helper function to build notes HTML
function buildNotesHTML(eventNotes: string, language: string): string {
  const notesLabel = language === 'ka' ? "შენიშვნები" :
                    language === 'es' ? "Notas" : "Notes";
  return `<div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">${notesLabel}:</h4>
    <p style="margin: 0; color: #555; line-height: 1.5;">${eventNotes.replace(/\n/g, '<br>')}</p>
  </div>`;
}

// Helper function to get address fallback
function getAddressFallback(language: string): string {
  return language === 'ka' ? "მისამართი დაზუსტდება" : 
         language === 'es' ? "Dirección por confirmar" : "Address to be confirmed";
}

// Helper function to get payment label
function getPaymentLabel(language: string): string {
  return language === 'ka' ? "გადახდის სტატუსი" :
         language === 'es' ? "Estado del Pago" : "Payment Status";
}

// Main function to get email content based on source and language
function getEmailContent(
  source: string,
  language: string,
  fullName: string,
  businessName: string,
  formattedStartDate: string,
  formattedEndDate: string,
  paymentInfo: string,
  addressInfo: string,
  eventNotesInfo: string
): { subject: string; content: string } {

  const normalizedLang = (language || 'en').toLowerCase();
  const normalizedSource = (source || 'booking-approval').toLowerCase();

  console.log(`📧 Generating email content for source: ${normalizedSource}, language: ${normalizedLang}`);

  // Event reminder emails - NEW
  if (normalizedSource === 'event-reminder') {
    let subject: string;
    switch (normalizedLang) {
      case 'ka':
        subject = `🔔 შეხსენება: ${businessName}-ის ღონისძიება`;
        break;
      case 'es': 
        subject = `🔔 Recordatorio: Tu Evento en ${businessName}`;
        break;
      default:
        subject = `🔔 Reminder: Your Event at ${businessName}`;
    }

    // Use the same content structure as event creation but with reminder styling
    const content = generateEventContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo, true); // isReminder = true
    
    return { subject, content };
  }

  // Event creation emails  
  if (normalizedSource === 'event-creation') {
    switch (normalizedLang) {
      case 'ka':
        return {
          subject: `ღონისძიება შეიქმნა ${businessName}-ში`,
          content: generateEventContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo, false)
        };
      case 'es':
        return {
          subject: `Evento Creado en ${businessName}`,
          content: generateEventContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo, false)
        };
      default:
        return {
          subject: `Event Created at ${businessName}`,
          content: generateEventContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo, false)
        };
    }
  }

  // Booking approval emails (default)
  switch (normalizedLang) {
    case 'ka':
      return {
        subject: `ჯავშანი დადასტურებულია ${businessName}-ში`,
        content: generateBookingContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo)
      };
    case 'es':
      return {
        subject: `Reserva Aprobada en ${businessName}`,
        content: generateBookingContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo)
      };
    default:
      return {
        subject: `Booking Approved at ${businessName}`,
        content: generateBookingContent(normalizedLang, fullName, businessName, formattedStartDate, formattedEndDate, paymentInfo, addressInfo, eventNotesInfo)
      };
  }
}

// Helper function to generate event content (used for both creation and reminders)
function generateEventContent(
  language: string, 
  fullName: string, 
  businessName: string, 
  startDate: string, 
  endDate: string, 
  paymentInfo: string, 
  addressInfo: string, 
  eventNotesInfo: string,
  isReminder: boolean = false
): string {
  // Define content based on language and whether it's a reminder
  let greeting: string, mainText: string, dateLabel: string, locationLabel: string, footerText: string;
  
  if (language === 'ka') {
    greeting = `გამარჯობა ${fullName}!`;
    mainText = isReminder 
      ? `ეს არის შეხსენება თქვენი უახლოესი ღონისძიების შესახებ ${businessName}-ში.`
      : `ღონისძიება წარმატებით შეიქმნა ${businessName}-ში.`;
    dateLabel = "📅 თარიღი:";
    locationLabel = "📍 მდებარეობა:";
    footerText = "მადლობა, რომ ამურჩევთ ჩვენს სერვისს!";
  } else if (language === 'es') {
    greeting = `¡Hola ${fullName}!`;
    mainText = isReminder
      ? `Este es un recordatorio de tu próximo evento en ${businessName}.`
      : `Tu evento ha sido creado exitosamente en ${businessName}.`;
    dateLabel = "📅 Fecha:";
    locationLabel = "📍 Ubicación:";
    footerText = "¡Gracias por elegir nuestros servicios!";
  } else {
    greeting = `Hello ${fullName}!`;
    mainText = isReminder
      ? `This is a reminder about your upcoming event at ${businessName}.`
      : `Your event has been successfully created at ${businessName}.`;
    dateLabel = "📅 Date:";
    locationLabel = "📍 Location:";
    footerText = "Thank you for choosing our services!";
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${isReminder ? 'Event Reminder' : 'Event Created'}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${isReminder ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">
      ${isReminder ? '🔔' : '🎉'} ${businessName}
    </h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <h2 style="color: #333; margin-bottom: 20px;">${greeting}</h2>
    
    <p style="font-size: 16px; margin-bottom: 25px;">${mainText}</p>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <h3 style="color: #495057; margin-top: 0;">📋 ${isReminder ? 'Event Details' : 'Event Details'}</h3>
      
      <p><strong>${dateLabel}</strong><br>
      <span style="color: #28a745;">⏰ ${startDate} - ${endDate}</span></p>
      
      <p><strong>${locationLabel}</strong><br>
      ${addressInfo}</p>
      
      ${paymentInfo}
    </div>

    ${eventNotesInfo}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
      <p style="font-style: italic; color: #6c757d;">${footerText}</p>
    </div>
  </div>
</body>
</html>`;
}

// Helper function to generate booking content (existing functionality)
function generateBookingContent(
  language: string, 
  fullName: string, 
  businessName: string, 
  startDate: string, 
  endDate: string, 
  paymentInfo: string, 
  addressInfo: string, 
  eventNotesInfo: string
): string {
  let greeting: string, mainText: string, dateLabel: string, locationLabel: string, footerText: string;
  
  if (language === 'ka') {
    greeting = `გამარჯობა ${fullName}!`;
    mainText = `თქვენი ჯავშანი დადასტურდა ${businessName}-ში.`;
    dateLabel = "📅 თარიღი:";
    locationLabel = "📍 მდებარეობა:";
    footerText = "მადლობა, რომ ამურჩევთ ჩვენს სერვისს!";
  } else if (language === 'es') {
    greeting = `¡Hola ${fullName}!`;
    mainText = `Tu reserva ha sido aprobada en ${businessName}.`;
    dateLabel = "📅 Fecha:";
    locationLabel = "📍 Ubicación:";
    footerText = "¡Gracias por elegir nuestros servicios!";
  } else {
    greeting = `Hello ${fullName}!`;
    mainText = `Your booking has been approved at ${businessName}.`;
    dateLabel = "📅 Date:";
    locationLabel = "📍 Location:";
    footerText = "Thank you for choosing our services!";
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Approved</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 ${businessName}</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <h2 style="color: #333; margin-bottom: 20px;">${greeting}</h2>
    
    <p style="font-size: 16px; margin-bottom: 25px;">${mainText}</p>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <h3 style="color: #495057; margin-top: 0;">📋 Booking Details</h3>
      
      <p><strong>${dateLabel}</strong><br>
      <span style="color: #28a745;">⏰ ${startDate} - ${endDate}</span></p>
      
      <p><strong>${locationLabel}</strong><br>
      ${addressInfo}</p>
      
      ${paymentInfo}
    </div>

    ${eventNotesInfo}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
      <p style="font-style: italic; color: #6c757d;">${footerText}</p>
    </div>
  </div>
</body>
</html>`;
}

serve(handler);
