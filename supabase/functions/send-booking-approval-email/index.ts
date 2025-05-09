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
  eventId?: string; // Used for deduplication
  source?: string; // Used to track source of request
  language?: string; // Added language parameter to support correct currency symbol
}

// For deduplication: Store a map of recently sent emails with expiring entries
// The key format is eventId_recipientEmail
const recentlySentEmails = new Map<string, number>();

// Clean up old entries from the deduplication map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    // Remove entries older than 10 minutes to be extra safe
    if (now - timestamp > 600000) {
      recentlySentEmails.delete(key);
    }
  }
}, 300000); // Run every 5 minutes

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Received request to send booking approval email via Resend API");

  try {
    const requestBody = await req.text();
    
    let parsedBody: BookingApprovalEmailRequest;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (parseError) {
      console.error("Failed to parse JSON request:", parseError);
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
      language
    } = parsedBody;

    console.log("Request body:", {
      recipientEmail,
      fullName,
      businessName,
      paymentStatus,
      paymentAmount,
      language
    });

    // Build a standardized deduplication key that ignores the source
    // This ensures we don't send duplicate emails just because they come from different sources
    let dedupeKey: string;
    
    if (eventId) {
      dedupeKey = `${eventId}_${recipientEmail}`;
      
      // Check if we already sent an email for this event/recipient
      const now = Date.now();
      if (recentlySentEmails.has(dedupeKey)) {
        const lastSent = recentlySentEmails.get(dedupeKey);
        const timeAgo = now - (lastSent || 0);
        console.log(`Duplicate email detected for key ${dedupeKey}. Last sent ${timeAgo}ms ago. Skipping.`);
        
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
      // If no eventId, use a combination of email and timestamps as a fallback
      dedupeKey = `${recipientEmail}_${startDate}_${endDate}`;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    // If there's no business address, reject the request
    // This ensures we only send emails that include the address
    if (!businessAddress || businessAddress.trim() === '') {
      console.log(`Request without business address rejected for ${recipientEmail}`);
      return new Response(
        JSON.stringify({ 
          message: "Email request rejected due to missing business address",
          to: recipientEmail,
          id: null,
          skipped: true,
          reason: "Missing business address"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    // Format dates
    const formattedStartDate = formatDateTime(startDate);
    const formattedEndDate = formatDateTime(endDate);
    
    try {
      // Get the currency symbol based on language - log extensively for debugging
      const currencySymbol = getCurrencySymbolByLanguage(language);
      console.log(`Using currency symbol: ${currencySymbol} for language: ${language}`);
      
      // Format payment information if available
      let paymentInfo = "";
      if (paymentStatus) {
        const formattedStatus = formatPaymentStatus(paymentStatus);
        
        if ((paymentStatus === 'partly_paid' || paymentStatus === 'partly') && paymentAmount !== undefined && paymentAmount !== null) {
          const amountDisplay = `${currencySymbol}${paymentAmount}`;
          paymentInfo = `<p><strong>Payment status:</strong> ${formattedStatus} (${amountDisplay})</p>`;
        } else if (paymentStatus === 'fully_paid' || paymentStatus === 'fully') {
          const amountDisplay = paymentAmount !== undefined && paymentAmount !== null ? ` (${currencySymbol}${paymentAmount})` : "";
          paymentInfo = `<p><strong>Payment status:</strong> ${formattedStatus}${amountDisplay}</p>`;
        } else {
          paymentInfo = `<p><strong>Payment status:</strong> ${formattedStatus}</p>`;
        }
      }
      
      // Prepare address section
      let addressInfo = "";
      let addressDisplay = businessAddress.trim();
      addressInfo = `<p style="margin: 8px 0;"><strong>Address:</strong> ${addressDisplay}</p>`;
      
      // Normalize business name
      const displayBusinessName = businessName && businessName !== "null" && businessName !== "undefined" 
        ? businessName 
        : 'SmartBookly';
      
      // Create HTML email content with simpler formatting
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Approved</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Hello ${fullName},</h2>
          <p>Your booking has been <b style="color: #4CAF50;">approved</b> at <b>${displayBusinessName}</b>.</p>
          <p style="margin: 8px 0;"><strong>Booking date and time:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
          ${addressInfo}
          ${paymentInfo}
          <p>We look forward to seeing you!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>This is an automated message.</i></p>
        </body>
        </html>
      `;
      
      // Use Resend API to send the email
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("Missing RESEND_API_KEY");
      }
      
      const resend = new Resend(resendApiKey);
      
      const emailResult = await resend.emails.send({
        from: `${displayBusinessName} <info@smartbookly.com>`,
        to: [recipientEmail],
        subject: `Booking Approved at ${displayBusinessName}`,
        html: htmlContent,
      });

      if (emailResult.error) {
        console.error("Error from Resend API:", emailResult.error);
        throw new Error(emailResult.error.message || "Unknown Resend API error");
      }

      console.log(`Email successfully sent via Resend API to ${recipientEmail}, ID: ${emailResult.data?.id}`);
      
      // Mark as recently sent ONLY if the email was successfully sent
      // This prevents failed attempts from blocking future retries
      recentlySentEmails.set(dedupeKey, Date.now());
      console.log(`Setting deduplication key: ${dedupeKey} (tracking ${recentlySentEmails.size} emails)`);
      
      return new Response(
        JSON.stringify({ 
          message: "Email sent successfully",
          to: recipientEmail,
          id: emailResult.data?.id,
          included_address: addressDisplay,
          business_name_used: displayBusinessName,
          source: source || 'unknown',
          dedupeKey: dedupeKey,
          language: language, // Log the language used for verification
          currencySymbol: currencySymbol // Log the currency symbol used
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
      
    } catch (emailError: any) {
      // Catch errors specifically from resend.emails.send
      console.error("Error sending email via Resend API:", emailError);
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
    console.error("Unhandled error in send-booking-approval-email:", error);
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

// Format payment status for display
function formatPaymentStatus(status: string): string {
  switch (status) {
    case "not_paid":
      return "Not Paid";
    case "partly_paid":
    case "partly":
      return "Partly Paid";
    case "fully_paid":
    case "fully":
      return "Fully Paid";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}

// Format dates with timezone awareness using Intl.DateTimeFormat
function formatDateTime(isoString: string): string {
  try {
    // Use Intl.DateTimeFormat with explicit timezone to ensure correct time display
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tbilisi', // Set this to your local business timezone
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    const date = new Date(isoString);
    const formatted = formatter.format(date);
    
    return formatted;
  } catch (error) {
    console.error(`Error formatting date with timezone: ${error}`);
    return isoString; // Return original string if any error occurs
  }
}

serve(handler);
