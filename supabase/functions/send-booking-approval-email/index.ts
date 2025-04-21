
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const VERIFIED_EMAIL = "gensweaty@gmail.com"; // Your verified email address

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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    const { recipientEmail, fullName, businessName, startDate, endDate } = parsedBody;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error("Invalid email format:", recipientEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    // In test mode, we're forced to use our verified email as the recipient
    const testMode = true; // Set to false once you have verified a domain
    const recipientToUse = testMode ? VERIFIED_EMAIL : recipientEmail;
    
    console.log(`Email will be sent to ${testMode ? "TEST EMAIL " + recipientToUse + " (instead of " + recipientEmail + ")" : recipientEmail}`);
    
    // Get formatted dates for display
    const startFormatted = new Date(startDate).toLocaleString();
    const endFormatted = new Date(endDate).toLocaleString();
    
    // For testing, we'll add the original recipient in the subject line
    const emailSubject = testMode 
      ? `[TEST] Booking Approved at ${businessName} (would be sent to ${recipientEmail})`
      : `Booking Approved at ${businessName}`;
    
    console.log("Attempting to send email from:", `${businessName} <onboarding@resend.dev>`);
    console.log("Email will be sent to:", recipientToUse);
    
    const emailResponse = await resend.emails.send({
      from: `${businessName} <onboarding@resend.dev>`,
      to: [recipientToUse],
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          ${testMode ? `<p style="background-color: #fff4e5; padding: 10px; border-radius: 4px;"><b>TEST MODE</b>: This email would normally be sent to ${recipientEmail}</p>` : ''}
          <h2 style="color: #333;">Hello ${fullName},</h2>
          <p>Your booking has been <b style="color: #4CAF50;">approved</b> at <b>${businessName}</b>.</p>
          <p><strong>Booking date and time:</strong> ${startFormatted} - ${endFormatted}</p>
          <p>We look forward to seeing you!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>This is an automated message.</i></p>
        </div>
      `,
    });

    console.log("Email response from Resend:", emailResponse);

    if (emailResponse.error) {
      console.error("Resend email error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          error: emailResponse.error,
          message: "There was an error sending the email. In test mode, emails are sent to the developer."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    console.log("Email processed successfully to:", recipientToUse);
    return new Response(
      JSON.stringify({ 
        message: testMode 
          ? "Test email sent successfully to developer account (not to customer)" 
          : "Booking approval email sent successfully",
        testMode: testMode,
        actualRecipient: recipientToUse,
        intendedRecipient: recipientEmail,
        emailResponse 
      }),
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
