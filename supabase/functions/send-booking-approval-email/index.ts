
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
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dateStr = start.toLocaleDateString();
  const startTime = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} (${startTime} - ${endTime})`;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
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
    const { recipientEmail, fullName, businessName, startDate, endDate }: BookingApprovalEmailRequest = await req.json();

    console.log("Sending email to:", recipientEmail);
    console.log("Data:", { fullName, businessName, startDate, endDate });

    if (!recipientEmail) {
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

    const formattedDate = formatBookingDate(startDate, endDate);

    const subject = `Booking Approved at ${businessName}`;
    const html = `
      <h2>Hello ${fullName},</h2>
      <p>Your booking has been <b>approved</b> at <b>${businessName}</b>.</p>
      <p><strong>Booking date and time:</strong> ${formattedDate}</p>
      <p>Thank you for choosing us!</p>
      <p><i>This is an automated message from SmartBookly</i></p>
    `;

    console.log("Sending email with Resend API to:", recipientEmail);
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

    const data = await res.json();
    console.log("Resend API response:", data);

    if (!res.ok) {
      console.error("Failed to send email:", data);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    return new Response(
      JSON.stringify({ message: "Booking approval email sent", data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  } catch (error: any) {
    console.error("Error in send-booking-approval-email:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
};

serve(handler);
