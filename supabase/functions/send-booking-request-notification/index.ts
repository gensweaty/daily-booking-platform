
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  businessId?: string;
  requesterName: string;
  startDate: string;
  endDate: string;
  requesterPhone?: string;
  notes?: string;
  businessName?: string;
  requesterEmail?: string;
  hasAttachment?: boolean;
  paymentStatus?: string;
  paymentAmount?: number;
  businessEmail?: string;
  requestDate?: string; // For backward compatibility 
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

    // Extract all possible fields from the request
    const { 
      businessId, 
      requesterName, 
      startDate, 
      endDate, 
      requesterPhone = "", 
      notes = "", 
      businessName = "Your Business", 
      requesterEmail = "",
      hasAttachment = false,
      paymentStatus = "not_paid",
      paymentAmount,
      businessEmail, // This could be directly provided or we need to query it
      requestDate // For backward compatibility
    } = requestData;
    
    // Use either startDate or requestDate for backward compatibility
    const effectiveStartDate = startDate || requestDate;
    const effectiveEndDate = endDate || requestDate;
    
    // Validate required fields
    if (!requesterName || !effectiveStartDate || !effectiveEndDate) {
      const missingFields = [];
      if (!requesterName) missingFields.push("requesterName");
      if (!effectiveStartDate) missingFields.push("startDate/requestDate");
      if (!effectiveEndDate) missingFields.push("endDate/requestDate");
      
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

    // We need to have businessId or businessEmail
    if (!businessId && !businessEmail) {
      console.error("❌ Missing required field: businessId or businessEmail");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required field: businessId or businessEmail" 
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

    // If we have businessId but not businessEmail, we need to fetch the email
    let recipientEmail = businessEmail;
    
    if (businessId && !recipientEmail) {
      // This indicates we need to query for the business email
      console.log("⚠️ Business email not provided in request, will need to query");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Business email is required. Please provide businessEmail in the request." 
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
    if (!recipientEmail || !recipientEmail.includes('@')) {
      console.error("❌ Invalid email format:", recipientEmail);
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

    // Format payment details for email
    let paymentDetails = "Not Paid";
    if (paymentStatus === "partly_paid") {
      paymentDetails = `Partially Paid (Amount: ${paymentAmount || 'not specified'})`;
    } else if (paymentStatus === "fully_paid") {
      paymentDetails = `Fully Paid (Amount: ${paymentAmount || 'not specified'})`;
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
            <p class="detail"><strong>Start Date:</strong> ${effectiveStartDate}</p>
            <p class="detail"><strong>End Date:</strong> ${effectiveEndDate}</p>
            <p class="detail"><strong>Payment:</strong> ${paymentDetails}</p>
            ${requesterPhone ? `<p class="detail"><strong>Phone:</strong> ${requesterPhone}</p>` : ''}
            ${notes ? `<p class="detail"><strong>Notes:</strong> ${notes}</p>` : ''}
            ${requesterEmail ? `<p class="detail"><strong>Email:</strong> ${requesterEmail}</p>` : ''}
            ${hasAttachment ? `<p class="detail"><strong>Attachment:</strong> Yes (check the booking in your dashboard)</p>` : ''}
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

Start Date: ${effectiveStartDate}
End Date: ${effectiveEndDate}
Payment: ${paymentDetails}
${requesterPhone ? `Phone: ${requesterPhone}` : ''}
${notes ? `Notes: ${notes}` : ''}
${requesterEmail ? `Email: ${requesterEmail}` : ''}
${hasAttachment ? `Attachment: Yes (check the booking in your dashboard)` : ''}

Please log in to your dashboard to view and respond to this request:
https://smartbookly.com/dashboard

This is an automated message from SmartBookly

If you did not sign up for SmartBookly, please disregard this email.
    `;
    
    console.log("📧 Sending email to:", recipientEmail);
    
    // Use your verified domain for the from address
    const fromEmail = "SmartBookly <info@smartbookly.com>";
    
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
      
      // Wait a moment to ensure the email is processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (resendError) {
      console.error("❌ Resend API error:", resendError);
      
      // Provide helpful guidance about domain verification
      let errorMessage = resendError instanceof Error ? resendError.message : "Unknown Resend error";
      let helpfulError = errorMessage;
      
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
        message: "Email notification sent successfully",
        id: emailResult.data?.id,
        email: recipientEmail
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
