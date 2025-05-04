
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create a Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

interface SignupRequest {
  email: string;
  redirectUrl: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { email, redirectUrl }: SignupRequest = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`Generating magic link for: ${email}`);

    // Generate a magic link instead of confirmation email
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: redirectUrl || 'https://smartbookly.com/dashboard',
      }
    });

    if (error) {
      console.error("Error generating link:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const magicLink = data.properties.action_link;
    console.log("Magic link generated successfully");

    // Send the email using Resend
    const emailResult = await resend.emails.send({
      from: "SmartBookly <no-reply@smartbookly.com>",
      to: email,
      subject: "Confirm your SmartBookly account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Welcome to SmartBookly!</h1>
          <p>Thank you for signing up. To start using SmartBookly, please confirm your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Email Address</a>
          </div>
          <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
          <p style="word-break: break-all;">${magicLink}</p>
          <p>This link will expire in 24 hours.</p>
          <p>Best regards,<br>The SmartBookly Team</p>
        </div>
      `,
    });

    console.log("Email sent result:", emailResult);

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation email sent" }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
