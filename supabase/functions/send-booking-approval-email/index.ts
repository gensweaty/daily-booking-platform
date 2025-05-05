
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
  language?: string; // Add language parameter
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }}
      );
    }
    
    const { recipientEmail, fullName, businessName, startDate, endDate, language = "en" } = parsedBody;

    console.log(`Processing email to: ${recipientEmail} for ${fullName} at ${businessName}`);
    console.log(`Language: ${language}`);
    console.log(`Start date (raw ISO string): ${startDate}`);
    console.log(`End date (raw ISO string): ${endDate}`);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }}
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
      // Select email content based on language
      const emailContent = getApprovalEmailContent(language, fullName, businessName, formattedStartDate, formattedEndDate);
      const emailSubject = getApprovalEmailSubject(language, businessName);
      
      // Send email using SMTP with explicit encoding headers
      await client.send({
        from: `${businessName} <info@smartbookly.com>`,
        to: recipientEmail,
        subject: emailSubject,
        content: "Your booking has been approved", // Fallback plain text
        html: emailContent,
        // Add proper UTF-8 encoding headers for all emails, especially important for Georgian
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Content-Transfer-Encoding": "quoted-printable",
          "MIME-Version": "1.0"
        },
      });
      
      console.log(`Email successfully sent to ${recipientEmail}`);
      
      await client.close();
      
      return new Response(
        JSON.stringify({ 
          message: "Email sent successfully",
          to: recipientEmail
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }}
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }}
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }}
    );
  }
};

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

// Get email subject based on language
function getApprovalEmailSubject(language: string, businessName: string): string {
  switch (language.toLowerCase()) {
    case 'ka':
      return `დაჯავშნა დამტკიცებულია ${businessName}-ში`;
    case 'es':
      return `Reserva Aprobada en ${businessName}`;
    case 'en':
    default:
      return `Booking Approved at ${businessName}`;
  }
}

// Get email content based on language
function getApprovalEmailContent(
  language: string,
  fullName: string,
  businessName: string,
  formattedStartDate: string,
  formattedEndDate: string
): string {
  const baseStyles = `
    font-family: Arial, sans-serif; 
    max-width: 600px; 
    margin: 0 auto; 
    padding: 20px; 
    border: 1px solid #eaeaea; 
    border-radius: 5px;
  `;
  
  switch (language.toLowerCase()) {
    case 'ka':
      // Georgian content
      return `
        <!DOCTYPE html>
        <html lang="ka">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>დაჯავშნის დადასტურება</title>
        </head>
        <body style="${baseStyles}">
          <div>
            <h2 style="color: #333;">გამარჯობა ${fullName},</h2>
            <p>თქვენი ჯავშანი <b style="color: #4CAF50;">დამტკიცდა</b> <b>${businessName}</b>-ში.</p>
            <p><strong>დაჯავშნის თარიღი და დრო:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
            <p>ჩვენ მოუთმენლად ველით თქვენს ნახვას!</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
            <p style="color: #777; font-size: 14px;"><i>ეს არის ავტომატური შეტყობინება.</i></p>
          </div>
        </body>
        </html>
      `;
    case 'es':
      // Spanish content
      return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>Reserva Aprobada</title>
        </head>
        <body style="${baseStyles}">
          <div>
            <h2 style="color: #333;">Hola ${fullName},</h2>
            <p>Su reserva ha sido <b style="color: #4CAF50;">aprobada</b> en <b>${businessName}</b>.</p>
            <p><strong>Fecha y hora de la reserva:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
            <p>¡Esperamos verle pronto!</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
            <p style="color: #777; font-size: 14px;"><i>Este es un mensaje automatizado.</i></p>
          </div>
        </body>
        </html>
      `;
    case 'en':
    default:
      // English content (default)
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>Booking Approved</title>
        </head>
        <body style="${baseStyles}">
          <div>
            <h2 style="color: #333;">Hello ${fullName},</h2>
            <p>Your booking has been <b style="color: #4CAF50;">approved</b> at <b>${businessName}</b>.</p>
            <p><strong>Booking date and time:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
            <p>We look forward to seeing you!</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
            <p style="color: #777; font-size: 14px;"><i>This is an automated message.</i></p>
          </div>
        </body>
        </html>
      `;
  }
}

serve(handler);
