
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
    // Get the API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
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

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333;">New Booking Request</h2>
        <p>Hello,</p>
        <p>You have received a new booking request from <strong>${requesterName}</strong>.</p>
        <p><strong>Date:</strong> ${requestDate}</p>
        ${phoneNumber ? `<p><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>Please log in to your dashboard to view and respond to this request:</p>
        <p><a href="https://smartbookly.com/dashboard" style="background-color: #0070f3; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">Go to Dashboard</a></p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="color: #777; font-size: 14px;"><i>This is an automated message from SmartBookly</i></p>
      </div>
    `;
    
    console.log("📧 Sending email to:", businessEmail);
    
    // Send email using Resend API
    const emailResponse = await resend.emails.send({
      from: "SmartBookly <notifications@smartbookly.com>",
      to: [businessEmail],
      subject: "New Booking Request - Action Required",
      html: emailHtml,
    });

    console.log("📬 Email API response:", JSON.stringify(emailResponse));

    if (!emailResponse.id) {
      console.error("❌ Failed to send email:", emailResponse);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to send email notification",
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
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email notification sent successfully",
        id: emailResponse.id
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
        error: error.message || "Unknown error occurred",
        stack: error.stack 
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
