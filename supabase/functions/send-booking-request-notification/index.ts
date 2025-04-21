
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  businessEmail: string;
  requesterName: string;
  requestDate: string;
  phoneNumber?: string;
  notes?: string;
  businessName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`🔔 Booking notification function invoked with method: ${req.method}`);
  console.log(`🌐 Request URL: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("✅ Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log API key presence - IMPORTANT: don't log the actual key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    console.log("🔑 API Key available:", !!resendApiKey);
    console.log("🔑 API Key length:", resendApiKey ? resendApiKey.length : 0);
    
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY is not configured in environment variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service configuration is missing" 
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }
    
    const resend = new Resend(resendApiKey);
    
    // Parse request body
    let requestData: BookingNotificationRequest;
    try {
      const body = await req.text();
      console.log("📝 Raw request body:", body);
      requestData = JSON.parse(body);
      console.log("📋 Parsed request data:", JSON.stringify(requestData));
    } catch (error) {
      console.error("❌ Failed to parse request body:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          details: error.message 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Validate required fields
    const { businessEmail, requesterName, requestDate, phoneNumber = "", notes = "", businessName = "Your Business" } = requestData;
    
    if (!businessEmail || !requesterName || !requestDate) {
      const missingFields = [];
      if (!businessEmail) missingFields.push("businessEmail");
      if (!requesterName) missingFields.push("requesterName");
      if (!requestDate) missingFields.push("requestDate");
      
      console.error("❌ Missing required fields:", missingFields.join(", "));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(", ")}` 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Validate email format
    if (!businessEmail.includes('@')) {
      console.error("❌ Invalid email format:", businessEmail);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid email format" 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Check if the recipient is using Hotmail/Outlook
    const isHotmailOrOutlook = businessEmail.toLowerCase().includes('hotmail.com') || 
                               businessEmail.toLowerCase().includes('outlook.com') ||
                               businessEmail.toLowerCase().includes('live.com');
    
    console.log(`📧 Recipient email is using Hotmail/Outlook: ${isHotmailOrOutlook}`);

    // Create email content - improve formatting for better deliverability
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Request</title>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">
        <div style="border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; background-color: #ffffff;">
          <h2 style="color: #0070f3; margin-top: 0;">New Booking Request</h2>
          <p>Hello,</p>
          <p>You have received a new booking request from <strong>${requesterName}</strong>.</p>
          <div style="margin: 20px 0; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
            <p style="margin: 8px 0;"><strong>Date:</strong> ${requestDate}</p>
            ${phoneNumber ? `<p style="margin: 8px 0;"><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
            ${notes ? `<p style="margin: 8px 0;"><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          <p>Please log in to your dashboard to view and respond to this request:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://smartbookly.com/dashboard" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;">
          <p style="color: #666666; font-size: 14px; text-align: center;">This is an automated message from SmartBookly</p>
          <p style="color: #666666; font-size: 12px; text-align: center;">If you did not sign up for SmartBookly, please disregard this email.</p>
        </div>
      </body>
      </html>
    `;
    
    console.log("📧 Sending email to:", businessEmail);
    
    // Choose a sender that works well with Hotmail/Outlook
    // For Hotmail, we'll use onboarding@resend.dev if it's a Hotmail address
    const fromEmail = isHotmailOrOutlook 
      ? "SmartBookly via Resend <onboarding@resend.dev>" 
      : "SmartBookly <info@smartbookly.com>";
      
    console.log("📧 Sending from:", fromEmail);
    
    // Try a different approach - first check if Resend is initialized
    console.log("🔄 Initializing Resend with API key");
    
    // Send email using Resend API
    console.log("📤 Attempting to send email through Resend API");
    
    let emailResponse;
    try {
      emailResponse = await resend.emails.send({
        from: fromEmail,
        to: [businessEmail],
        subject: "New Booking Request - Action Required",
        html: emailHtml,
        // Add reply-to for better deliverability
        reply_to: "no-reply@smartbookly.com",
        // Add text version for better deliverability
        text: `
New Booking Request

Hello,

You have received a new booking request from ${requesterName}.

Date: ${requestDate}
${phoneNumber ? `Phone: ${phoneNumber}` : ''}
${notes ? `Notes: ${notes}` : ''}

Please log in to your dashboard to view and respond to this request:
https://smartbookly.com/dashboard

This is an automated message from SmartBookly
        `,
      });
      
      console.log("📬 Raw Resend API response:", JSON.stringify(emailResponse));
    } catch (resendError) {
      console.error("❌ Resend API error:", resendError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email sending failed", 
          details: resendError instanceof Error ? resendError.message : "Unknown Resend error",
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Check for errors in the response
    if (!emailResponse || emailResponse.error) {
      console.error("❌ Failed to send email - error in response:", emailResponse);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to send email notification - error in response",
          details: emailResponse 
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Success response
    console.log("✅ Email sent successfully with ID:", emailResponse.id);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email notification sent successfully",
        id: emailResponse.id,
        email: businessEmail
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );
    
  } catch (error) {
    console.error("❌ Unhandled error in send-booking-request-notification:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );
  }
};

// Start server
serve(handler);
