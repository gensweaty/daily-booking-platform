
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { businessEmail, requesterName, requestDate, phoneNumber, notes }: BookingNotificationRequest = await req.json();

    console.log("Sending booking notification email to:", businessEmail);
    
    const emailResponse = await resend.emails.send({
      from: "Smartbookly <info@smartbookly.com>",
      to: [businessEmail],
      subject: "New Booking Request Received",
      html: `
        <h1>Hello,</h1>
        <p>You have a new booking request from <strong>${requesterName}</strong></p>
        <p><strong>Date:</strong> ${requestDate}</p>
        ${phoneNumber ? `<p><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>Go to dashboard to approve: <a href="https://smartbookly.com/dashboard">https://smartbookly.com/dashboard</a></p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error sending booking notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
