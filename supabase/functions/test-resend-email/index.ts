
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    console.log("Testing Resend email function");
    
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "RESEND_API_KEY is not set in environment variables"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    
    // Mask the key for logging safety (only show first 5 chars)
    const maskedKey = RESEND_API_KEY.substring(0, 5) + "..." + 
                     (RESEND_API_KEY.length > 10 ? RESEND_API_KEY.substring(RESEND_API_KEY.length - 5) : "");
    console.log(`RESEND_API_KEY is set: ${maskedKey}`);
    
    // Create Resend client
    const resend = new Resend(RESEND_API_KEY);
    
    // Parse email address from request if provided
    let testEmail = "test@example.com"; // Default
    try {
      const body = await req.json();
      if (body && body.email) {
        testEmail = body.email;
        console.log(`Using provided email: ${testEmail}`);
      }
    } catch (e) {
      console.log("No valid JSON body provided, using default test email");
    }
    
    // Send a test email
    try {
      const emailResult = await resend.emails.send({
        from: "SmartBookly <onboarding@resend.dev>",
        to: [testEmail],
        subject: "Test Email from SmartBookly",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>This is a test email from SmartBookly</h2>
            <p>If you're seeing this, Resend is configured correctly!</p>
            <p>Time sent: ${new Date().toISOString()}</p>
          </div>
        `,
      });
      
      console.log("Test email sent:", emailResult);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test email sent successfully",
          emailResult: emailResult
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (emailError) {
      console.error("Error sending test email:", emailError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to send test email",
          error: emailError?.message || "Unknown error"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  } catch (error) {
    console.error('Error in test-resend-email function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "An unexpected error occurred",
        success: false
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
