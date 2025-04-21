
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Initialize Resend with API key
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "re_YXpwJEX5_KURHRRSBCMg5Dgczo4H7ioLZ";
console.log("Resend API key available:", !!resendApiKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  businessEmail: string;
  requesterName: string;
  requestDate: string;
  phoneNumber: string;
  notes: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Function invoked with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received booking notification request");
    
    // Parse the request body
    const requestBody = await req.text();
    console.log("Raw request body:", requestBody);
    
    let requestData;
    try {
      requestData = JSON.parse(requestBody);
      console.log("Parsed request data:", JSON.stringify(requestData));
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { businessEmail, requesterName, requestDate, phoneNumber, notes }: BookingNotificationRequest = requestData;

    // Validate required fields
    if (!businessEmail || !requesterName || !requestDate) {
      console.error("Missing required fields:", { 
        emailProvided: !!businessEmail, 
        nameProvided: !!requesterName,
        dateProvided: !!requestDate
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: businessEmail, requesterName, or requestDate" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!businessEmail.includes('@')) {
      console.error("Invalid business email format:", businessEmail);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid email format for business email" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Sending booking notification email to:", businessEmail);
    
    // Prepare email HTML with conditional rendering for optional fields
    const emailHtml = `
      <h1>Hello,</h1>
      <p>You have a new booking request from <strong>${requesterName}</strong></p>
      <p><strong>Date:</strong> ${requestDate}</p>
      ${phoneNumber ? `<p><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>Go to dashboard to approve: <a href="https://smartbookly.com/dashboard">https://smartbookly.com/dashboard</a></p>
    `;
    
    console.log("Prepared email HTML:", emailHtml);

    // Send email using Resend
    console.log("About to send email with from:", "Smartbookly <info@smartbookly.com>");
    const emailResponse = await resend.emails.send({
      from: "Smartbookly <info@smartbookly.com>",
      to: [businessEmail],
      subject: "New Booking Request Received",
      html: emailHtml,
    });

    console.log("Email sending response:", JSON.stringify(emailResponse));

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: emailResponse,
        message: "Email notification sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error sending booking notification:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
