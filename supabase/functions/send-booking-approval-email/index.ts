
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
    console.log(`Start date (raw): ${startDate}`);
    console.log(`End date (raw): ${endDate}`);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    // Parse dates without changing timezone
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    // Log the parsed dates to verify
    console.log(`Start date (parsed): ${startDateObj.toString()}`);
    console.log(`End date (parsed): ${endDateObj.toString()}`);
    
    // Format dates manually to avoid timezone issues
    const formattedStartDate = formatDateTimeWithLocalTime(startDate);
    const formattedEndDate = formatDateTimeWithLocalTime(endDate);
    
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

// Improved helper function to correctly format date/time from the ISO string directly
function formatDateTimeWithLocalTime(isoDateString: string): string {
  console.log(`Formatting ISO date string: ${isoDateString}`);
  
  try {
    // Parse the ISO date string directly
    const date = new Date(isoDateString);
    console.log(`Parsed date object: ${date.toString()}`);
    
    // Extract date parts directly from the ISO string to avoid timezone conversion
    const isoDate = new Date(isoDateString);
    
    // Get the correct year, month, day from the ISO date 
    const year = isoDate.getFullYear();
    const month = isoDate.getMonth() + 1; // Month is 0-indexed
    const day = isoDate.getDate();
    
    // Get hours and minutes from the ISO string directly
    // We need to extract these from the string to preserve original values
    const timeMatch = isoDateString.match(/T(\d{2}):(\d{2})/);
    
    if (!timeMatch) {
      console.error("Could not extract time from ISO string");
      // Fallback to using the date object directly
      return formatDateTimeLocally(date);
    }
    
    const hours24 = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    
    // Convert to 12-hour format with AM/PM
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12; // Convert 0 to 12
    
    console.log(`Extracted data - Year: ${year}, Month: ${month}, Day: ${day}, Hours: ${hours24}, Minutes: ${minutes}, Period: ${period}`);
    
    // Format as MM/DD/YYYY h:MM AM/PM
    return `${month}/${day}/${year} ${hours12}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
  } catch (error) {
    console.error(`Error formatting date string "${isoDateString}":`, error);
    // If there's an error, fall back to the more basic formatter
    return formatDateTimeLocally(new Date(isoDateString));
  }
}

// Original helper function as fallback
function formatDateTimeLocally(date: Date): string {
  // Extract all date/time components
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  // Format as MM/DD/YYYY h:MM AM/PM
  return `${month}/${day}/${year} ${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
}

serve(handler);
