
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

  console.log("🚀 Received actual POST request to send email");

  try {
    // Get the API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    console.log("🔑 API Key available:", !!resendApiKey);
    
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY is not configured in environment variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service configuration is missing",
          apiKeyPresent: false
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
    
    // Initialize Resend with the API key
    console.log("🔄 Initializing Resend client");
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

    // Create email content - improve formatting for better deliverability
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Request</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
          .container { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; }
          .header { color: #0070f3; margin-top: 0; }
          .details { margin: 20px 0; background-color: #f9f9f9; padding: 15px; border-radius: 4px; }
          .detail { margin: 8px 0; }
          .button { text-align: center; margin: 25px 0; }
          .button a { background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
          .footer { color: #666; font-size: 14px; text-align: center; margin-top: 20px; }
          .small { font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="header">New Booking Request</h2>
          <p>Hello,</p>
          <p>You have received a new booking request from <strong>${requesterName}</strong>.</p>
          <div class="details">
            <p class="detail"><strong>Date:</strong> ${requestDate}</p>
            ${phoneNumber ? `<p class="detail"><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
            ${notes ? `<p class="detail"><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          <p>Please log in to your dashboard to view and respond to this request:</p>
          <div class="button">
            <a href="https://smartbookly.com/dashboard">Go to Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;">
          <p class="footer">This is an automated message from SmartBookly</p>
          <p class="small">If you did not sign up for SmartBookly, please disregard this email.</p>
        </div>
      </body>
      </html>
    `;
    
    // Create plain text version for better deliverability
    const plainText = `
New Booking Request

Hello,

You have received a new booking request from ${requesterName}.

Date: ${requestDate}
${phoneNumber ? `Phone: ${phoneNumber}` : ''}
${notes ? `Notes: ${notes}` : ''}

Please log in to your dashboard to view and respond to this request:
https://smartbookly.com/dashboard

This is an automated message from SmartBookly

If you did not sign up for SmartBookly, please disregard this email.
    `;
    
    console.log("📧 Sending email to:", businessEmail);
    
    // IMPORTANT: For testing phase, only send emails to verified email addresses
    // Until domain verification is complete
    const testMode = true; // Set to false in production
    
    let recipientEmail = businessEmail;
    const verifiedEmail = "gensweaty@gmail.com"; // Your verified email from the error message
    
    if (testMode && businessEmail !== verifiedEmail) {
      console.log(`⚠️ Test mode active - redirecting email from ${businessEmail} to ${verifiedEmail}`);
      recipientEmail = verifiedEmail;
    }
    
    // Always use onboarding@resend.dev for better deliverability during testing
    const fromEmail = "SmartBookly <onboarding@resend.dev>";
    
    console.log("📧 Final recipient:", recipientEmail);
    console.log("📧 Sending from:", fromEmail);
    console.log("📧 Subject: New Booking Request - Action Required");
    
    let emailResult;
    try {
      console.log("📤 About to execute Resend API call");
      
      // Make sure we fully await the email sending before returning
      emailResult = await resend.emails.send({
        from: fromEmail,
        to: [recipientEmail],
        subject: "New Booking Request - Action Required",
        html: emailHtml,
        text: plainText,
        reply_to: "no-reply@smartbookly.com",
      });
      
      console.log("📬 Raw Resend API response:", JSON.stringify(emailResult));
      
      if (emailResult.error) {
        throw new Error(emailResult.error.message || "Unknown error from Resend API");
      }
      
      console.log("✅ Email sent successfully with ID:", emailResult.data?.id);
      console.log("✅ Recipient:", recipientEmail);
      
      if (testMode && businessEmail !== recipientEmail) {
        console.log("⚠️ NOTE: Email redirected in test mode.");
        console.log(`⚠️ Original recipient was: ${businessEmail}`);
        console.log(`⚠️ Redirected to: ${recipientEmail}`);
      }
      
      // Wait a moment to ensure the email is processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (resendError) {
      console.error("❌ Resend API error:", resendError);
      
      // Provide helpful guidance about domain verification
      let errorMessage = resendError instanceof Error ? resendError.message : "Unknown Resend error";
      let helpfulError = errorMessage;
      
      if (errorMessage.includes("verify a domain")) {
        helpfulError = "Domain verification required: " + errorMessage + 
                      " Please visit https://resend.com/domains to verify your domain.";
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email sending failed", 
          details: helpfulError,
          originalError: errorMessage,
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
    console.log("✅ Request processed successfully, returning response");
    
    // Wait to ensure all logs are flushed before returning
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: testMode && businessEmail !== recipientEmail ? 
          "Test email sent to your verified email address" : 
          "Email notification sent successfully",
        id: emailResult.data?.id,
        email: recipientEmail,
        testMode: testMode,
        originalRecipient: businessEmail
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
    
    // Wait to ensure all logs are flushed before returning
    await new Promise(resolve => setTimeout(resolve, 300));
    
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

// Start server and make sure all promises resolve before shutdown
serve(handler);
