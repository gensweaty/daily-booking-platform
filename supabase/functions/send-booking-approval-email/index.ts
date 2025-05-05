
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
}

// For deduplication: Store a map of recently sent emails with expiring entries
// The key is eventId_recipientEmail
const recentlySentEmails = new Map<string, number>();

// Clean up old entries from the deduplication map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    // Remove entries older than 10 minutes (increased from 2 minutes)
    if (now - timestamp > 600000) {
      recentlySentEmails.delete(key);
    }
  }
}, 300000); // Run every 5 minutes

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Received request to send booking approval email via Resend API");

  try {
    const requestBody = await req.text();
    console.log("Request body (raw):", requestBody);
    
    let parsedBody: BookingApprovalEmailRequest;
    try {
      parsedBody = JSON.parse(requestBody);
      
      // Comprehensive debug logging of the parsed body
      console.log("Parsed request body:");
      console.log(`- Recipient: ${parsedBody.recipientEmail}`);
      console.log(`- Name: ${parsedBody.fullName}`);
      console.log(`- Business: ${parsedBody.businessName}`);
      console.log(`- Dates: ${parsedBody.startDate} to ${parsedBody.endDate}`);
      console.log(`- Payment: ${parsedBody.paymentStatus} (${parsedBody.paymentAmount || 'N/A'})`);
      console.log(`- Business Address: ${parsedBody.businessAddress || '(No address provided)'}`);
      console.log(`- Event ID: ${parsedBody.eventId || '(No event ID)'}`);
      console.log(`- Source: ${parsedBody.source || '(Unknown source)'}`);
      
      // ENHANCED ADDRESS DEBUGGING
      console.log("ADDRESS DIAGNOSTICS:");
      console.log(`- Raw address property: ${JSON.stringify(parsedBody.businessAddress)}`);
      console.log(`- Address type: ${typeof parsedBody.businessAddress}`);
      console.log(`- Address direct access: ${parsedBody.businessAddress}`);
      console.log(`- Is null? ${parsedBody.businessAddress === null}`);
      console.log(`- Is undefined? ${parsedBody.businessAddress === undefined}`);
      console.log(`- Is empty string? ${parsedBody.businessAddress === ''}`);
      
      if (parsedBody.businessAddress && typeof parsedBody.businessAddress === 'string') {
        console.log(`- Address length: ${parsedBody.businessAddress.length}`);
        console.log(`- First 20 chars: "${parsedBody.businessAddress.substring(0, 20)}"`);
        console.log(`- Contains 'null' text? ${parsedBody.businessAddress.includes('null')}`);
        console.log(`- Contains 'undefined' text? ${parsedBody.businessAddress.includes('undefined')}`);
      }

      // BUSINESS NAME DEBUGGING  
      console.log("BUSINESS NAME DIAGNOSTICS:");
      console.log(`- Raw business name property: ${JSON.stringify(parsedBody.businessName)}`);
      console.log(`- Business name type: ${typeof parsedBody.businessName}`);
      console.log(`- Business name direct access: ${parsedBody.businessName}`);
      console.log(`- Is null? ${parsedBody.businessName === null}`);
      console.log(`- Is undefined? ${parsedBody.businessName === undefined}`);
      console.log(`- Is empty string? ${parsedBody.businessName === ''}`);
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
      source
    } = parsedBody;

    // Build a unique deduplication key - combine eventId (if available) with email and add source
    let dedupeKey: string;
    
    if (eventId) {
      dedupeKey = `${eventId}_${recipientEmail}`;
    } else {
      // If no eventId, use a combination of email and timestamps as a fallback
      dedupeKey = `${recipientEmail}_${startDate}_${endDate}`;
    }
    
    // Add source for additional tracking in logs
    if (source) {
      dedupeKey += `_${source}`;
    }
    
    const now = Date.now();
    
    // Check if this exact email was sent recently
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
    
    // Mark as recently sent
    recentlySentEmails.set(dedupeKey, now);
    console.log(`Setting deduplication key: ${dedupeKey} (tracking ${recentlySentEmails.size} emails)`);

    console.log(`Processing email to: ${recipientEmail} for ${fullName} at ${businessName || "Unknown Business"}`);
    console.log(`Start date (raw ISO string): ${startDate}`);
    console.log(`End date (raw ISO string): ${endDate}`);
    console.log(`Payment status: ${paymentStatus}`);
    console.log(`Payment amount: ${paymentAmount}`);
    
    // Debug log for address - CRITICAL
    console.log(`Business address (direct reference): ${businessAddress}`);
    console.log(`Business address (JSON stringified): ${JSON.stringify(businessAddress)}`);
    console.log(`Business address type: ${typeof businessAddress}`);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    // Format dates
    const formattedStartDate = formatDateTime(startDate);
    const formattedEndDate = formatDateTime(endDate);
    
    console.log(`Formatted start date: ${formattedStartDate}`);
    console.log(`Formatted end date: ${formattedEndDate}`);
    
    try {
      // Format payment information if available
      let paymentInfo = "";
      if (paymentStatus) {
        const formattedStatus = formatPaymentStatus(paymentStatus);
        
        if (paymentStatus === 'partly_paid' || paymentStatus === 'partly') {
          const amountDisplay = paymentAmount ? `$${paymentAmount}` : "";
          paymentInfo = `<p><strong>Payment status:</strong> ${formattedStatus} ${amountDisplay}</p>`;
        } else {
          paymentInfo = `<p><strong>Payment status:</strong> ${formattedStatus}</p>`;
        }
      }
      
      // --- IMPROVED Address Processing ---
      let addressInfo = "";
      let addressDisplay = ""; // For logging purposes
      
      // Always attempt to use the address if it exists in any form
      if (businessAddress !== undefined && businessAddress !== null) {
        // Convert to string and clean (handle any potential undefined/null stringified values)
        const addressStr = String(businessAddress).trim();
        console.log(`Address converted to string: "${addressStr}"`);
        
        // Check if it's a valid usable address (not "null" or "undefined" strings or empty)
        if (
          addressStr.length > 0 && 
          addressStr !== "null" && 
          addressStr !== "undefined"
        ) {
          // This is a valid address we can use
          addressDisplay = addressStr;
          addressInfo = `<p style="margin: 8px 0;"><strong>Address:</strong> ${addressDisplay}</p>`;
          console.log(`Valid address found, will display: "${addressDisplay}"`);
        } else {
          console.log(`Address rejected as invalid: "${addressStr}"`);
        }
      } else {
        console.log("Business address is falsy - appears to be missing");
      }

      // Normalize business name
      const displayBusinessName = businessName && businessName !== "null" && businessName !== "undefined" 
        ? businessName 
        : 'SmartBookly';
        
      console.log(`Using business name for email: "${displayBusinessName}"`);
      
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
      
      // Final check of what will be included in the email HTML
      console.log("EMAIL HTML PREVIEW:");
      console.log(`- Address section: ${addressInfo || "(No address will be shown)"}`);
      console.log(`- Payment section: ${paymentInfo || "(No payment info will be shown)"}`);
      console.log(`- Business name used: ${displayBusinessName}`);
      
      // Use Resend API to send the email
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("Missing RESEND_API_KEY");
      }
      
      const resend = new Resend(resendApiKey);

      console.log(`Attempting to send email via Resend API to ${recipientEmail}`);
      
      const emailResult = await resend.emails.send({
        from: `${displayBusinessName} <info@smartbookly.com>`,
        to: [recipientEmail],
        subject: `Booking Approved at ${displayBusinessName}`,
        html: htmlContent,
      });

      console.log("Resend API response:", emailResult);
      if (emailResult.error) {
        console.error("Error from Resend API:", emailResult.error);
        throw new Error(emailResult.error.message || "Unknown Resend API error");
      }

      console.log(`Email successfully sent via Resend API to ${recipientEmail}, ID: ${emailResult.data?.id}`);
      
      return new Response(
        JSON.stringify({ 
          message: "Email sent successfully",
          to: recipientEmail,
          id: emailResult.data?.id,
          included_address: addressDisplay || null, // For debugging
          business_name_used: displayBusinessName,
          source: source || 'unknown',
          dedupeKey: dedupeKey
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
  console.log(`Formatting date with timezone: ${isoString}`);
  
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
    
    console.log(`Original ISO: ${isoString}`);
    console.log(`Formatted with timezone: ${formatted}`);
    
    return formatted;
  } catch (error) {
    console.error(`Error formatting date with timezone: ${error}`);
    return isoString; // Return original string if any error occurs
  }
}

serve(handler);
