
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

function formatBookingDate(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const dateStr = start.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const startTime = start.toLocaleTimeString('en-US', { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true 
    });
    const endTime = end.toLocaleTimeString('en-US', { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true 
    });
    
    console.log(`Formatted date from ${startDate} and ${endDate} to: ${dateStr} (${startTime} - ${endTime})`);
    return `${dateStr} (${startTime} - ${endTime})`;
  } catch (error) {
    console.error("Error formatting date:", error);
    // Return a fallback format if parsing fails
    return `${startDate} - ${endDate}`;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Edge function called with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY environment variable");
    return new Response(
      JSON.stringify({ error: "Missing RESEND_API_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
  
  try {
    console.log("Parsing request body");
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

    console.log("Request parsed successfully with data:", { 
      recipientEmail, 
      fullName, 
      businessName, 
      startDate, 
      endDate 
    });

    if (!recipientEmail) {
      console.error("Missing recipient email in request");
      return new Response(
        JSON.stringify({ error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    // Validate dates
    if (!startDate || !endDate) {
      console.error("Missing date values:", { startDate, endDate });
      return new Response(
        JSON.stringify({ error: "Start date and end date are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    try {
      new Date(startDate);
      new Date(endDate);
    } catch (dateError) {
      console.error("Invalid date format:", { startDate, endDate, error: dateError });
      return new Response(
        JSON.stringify({ error: "Invalid date format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    const formattedDate = formatBookingDate(startDate, endDate);
    const name = fullName || "Customer";
    const business = businessName || "Our Business";

    const subject = `Booking Approved at ${business}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333;">Hello ${name},</h2>
        <p>Your booking has been <b style="color: #4CAF50;">approved</b> at <b>${business}</b>.</p>
        <p><strong>Booking date and time:</strong> ${formattedDate}</p>
        <p>We look forward to seeing you!</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="color: #777; font-size: 14px;"><i>This is an automated message from SmartBookly</i></p>
      </div>
    `;

    console.log("Preparing to send email to:", recipientEmail);
    console.log("Email subject:", subject);
    console.log("Formatted date for email:", formattedDate);
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SmartBookly <onboarding@resend.dev>",
        to: [recipientEmail],
        subject,
        html,
      }),
    });

    console.log("Resend API response status:", res.status);
    
    const data = await res.json();
    console.log("Resend API response body:", data);

    if (!res.ok) {
      console.error("Failed to send email. Status:", res.status, "Response:", data);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    console.log("Email sent successfully to:", recipientEmail);
    return new Response(
      JSON.stringify({ message: "Booking approval email sent", data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  } catch (error: any) {
    console.error("Unhandled error in send-booking-approval-email:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error", stack: error?.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
};

serve(handler);
