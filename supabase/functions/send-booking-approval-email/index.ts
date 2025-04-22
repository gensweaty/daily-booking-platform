
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
    
    const { recipientEmail, fullName, businessName, startDate, endDate } = parsedBody;

    console.log(`Processing email to: ${recipientEmail} for ${fullName} at ${businessName}`);
    console.log(`Start date (raw ISO string): ${startDate}`);
    console.log(`End date (raw ISO string): ${endDate}`);

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
      // Create HTML email content
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Hello ${fullName},</h2>
          <p>Your booking has been <b style="color: #4CAF50;">approved</b> at <b>${businessName}</b>.</p>
          <p><strong>Booking date and time:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
          <p>We look forward to seeing you!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>This is an automated message.</i></p>
        </div>
      `;
      
      // Send email using SMTP
      await client.send({
        from: `${businessName} <info@smartbookly.com>`,
        to: recipientEmail,
        subject: `Booking Approved at ${businessName}`,
        content: "Your booking has been approved",
        html: htmlContent,
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

// Format dates in a way that preserves the original time
function formatDateTime(isoString: string): string {
  console.log(`Formatting date: ${isoString}`);
  
  try {
    // Create a Date object preserving the original time
    const date = new Date(isoString);
    
    // Extract date components
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    
    // Extract time components
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    // Format as "April 20, 2025 at 10:00 AM"
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const formattedDate = `${monthNames[month-1]} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
    
    console.log(`Formatted result: ${formattedDate}`);
    return formattedDate;
  } catch (error) {
    console.error(`Error formatting date: ${error}`);
    return isoString; // Return original string if any error occurs
  }
}

serve(handler);
