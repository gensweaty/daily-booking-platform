
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
  businessAddress?: string; 
  paymentStatus?: string;
  paymentAmount?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Received request to send booking approval email");

  try {
    const requestBody = await req.text();
    console.log("Request body:", requestBody);
    
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
    
    const { recipientEmail, fullName, businessName, startDate, endDate, businessAddress, paymentStatus, paymentAmount } = parsedBody;

    console.log(`Processing email to: ${recipientEmail} for ${fullName} at ${businessName}`);
    console.log(`Start date (raw ISO string): ${startDate}`);
    console.log(`End date (raw ISO string): ${endDate}`);
    console.log(`Business address (raw): ${businessAddress}`);
    console.log(`Payment status: ${paymentStatus}`);
    console.log(`Payment amount: ${paymentAmount}`);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    // New date formatting that respects the original time
    const formattedStartDate = formatDateTime(startDate);
    const formattedEndDate = formatDateTime(endDate);
    
    console.log(`Formatted start date: ${formattedStartDate}`);
    console.log(`Formatted end date: ${formattedEndDate}`);
    
    // Setup SMTP client with Resend SMTP configuration
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.resend.com",
        port: 465,
        tls: true,
        auth: {
          username: "resend",
          password: Deno.env.get("RESEND_API_KEY") || "",
        },
      },
    });

    console.log(`Attempting to send email via SMTP to ${recipientEmail}`);
    
    try {
      // Handle address with extra careful cleaning and validation
      let addressSection = "";
      
      if (businessAddress) {
        // More thorough cleaning - remove ALL potential encoding artifacts
        let cleanAddress = businessAddress;
        
        // Remove all encoding artifacts and trim whitespace
        cleanAddress = cleanAddress
          .replace(/=20/g, ' ')   // Replace =20 with a space
          .replace(/=\r\n/g, '')  // Remove soft line breaks
          .replace(/=\n/g, '')    // Remove soft line breaks
          .replace(/=$/g, '')     // Remove trailing equals
          .replace(/\s+/g, ' ')   // Replace multiple spaces with a single space
          .trim();                // Trim whitespace
          
        console.log(`Thoroughly cleaned address: "${cleanAddress}"`);
        
        if (cleanAddress) {
          addressSection = `<p><strong>Address:</strong> ${cleanAddress}</p>`;
          console.log(`Address section for email: "${addressSection}"`);
        } else {
          console.log("Address is empty after cleaning");
        }
      } else {
        console.log("No business address provided");
      }
      
      // Create HTML email content with simpler formatting
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Approved</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #eaeaea;
              border-radius: 5px;
            }
            h2 {
              color: #333;
            }
            .success {
              color: #4CAF50;
              font-weight: bold;
            }
            .info-section {
              margin: 15px 0;
            }
            hr {
              border: none;
              border-top: 1px solid #eaeaea;
              margin: 20px 0;
            }
            .footer {
              color: #777;
              font-size: 14px;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <h2>Hello ${fullName},</h2>
          <p>Your booking has been <span class="success">approved</span> at <b>${businessName}</b>.</p>
          
          <div class="info-section">
            <p><strong>Booking date and time:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
            ${addressSection}
          </div>
          
          <p>We look forward to seeing you!</p>
          <hr>
          <p class="footer">This is an automated message.</p>
        </body>
        </html>
      `;
      
      console.log("HTML email content:", htmlContent);
      
      // Send email using SMTP with simpler content type headers
      await client.send({
        from: `${businessName} <info@smartbookly.com>`,
        to: recipientEmail,
        subject: `Booking Approved at ${businessName}`,
        content: "Your booking has been approved",
        html: htmlContent
      });
      
      console.log(`Email successfully sent to ${recipientEmail}`);
      
      await client.close();
      
      return new Response(
        JSON.stringify({ 
          message: "Email sent successfully",
          to: recipientEmail
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      console.error("Error details:", emailError.message);
      
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          console.error("Error closing SMTP connection:", closeError);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email",
          details: emailError.message || "Unknown error",
          trace: typeof emailError.stack === 'string' ? emailError.stack : "No stack trace available"
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
