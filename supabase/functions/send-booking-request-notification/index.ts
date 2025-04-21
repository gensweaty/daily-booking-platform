
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Initialize Resend with API key from environment variables
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

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
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Booking notification function invoked with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting to process booking notification request");
    
    // Validate API key
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Missing RESEND_API_KEY configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let requestData: BookingNotificationRequest;
    try {
      requestData = await req.json();
      console.log("Parsed request data:", JSON.stringify(requestData));
    } catch (error) {
      console.error("Failed to parse request body:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { businessEmail, requesterName, requestDate, phoneNumber = '', notes = '' } = requestData;

    // Validate required fields
    if (!businessEmail || !requesterName || !requestDate) {
      const missingFields = [];
      if (!businessEmail) missingFields.push('businessEmail');
      if (!requesterName) missingFields.push('requesterName');
      if (!requestDate) missingFields.push('requestDate');
      
      console.error("Missing required fields:", missingFields.join(', '));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Email validation
    if (!businessEmail.includes('@')) {
      console.error("Invalid email format:", businessEmail);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare email HTML with conditional rendering for optional fields
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333;">New Booking Request</h2>
        <p>Hello,</p>
        <p>You have received a new booking request from <strong>${requesterName}</strong>.</p>
        <p><strong>Date:</strong> ${requestDate}</p>
        ${phoneNumber ? `<p><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>Please log in to your dashboard to approve or reject this request:</p>
        <p><a href="https://smartbookly.com/dashboard" style="color: #0070f3; text-decoration: none;">https://smartbookly.com/dashboard</a></p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="color: #777; font-size: 14px;"><i>This is an automated message from SmartBookly.</i></p>
      </div>
    `;
    
    console.log("Prepared email with HTML body");

    // Send email using Resend API
    console.log("Sending email to:", businessEmail);
    const emailResponse = await resend.emails.send({
      from: "Smartbookly <info@smartbookly.com>",
      to: [businessEmail],
      subject: "New Booking Request - Action Required",
      html: emailHtml,
    });

    console.log("Email sending response:", JSON.stringify(emailResponse));

    if (!emailResponse.id) {
      console.error("Failed to send email:", emailResponse);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to send email",
          details: emailResponse
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { id: emailResponse.id },
        message: "Email notification sent successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unhandled error in booking notification:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

// Start the server
serve(handler);
