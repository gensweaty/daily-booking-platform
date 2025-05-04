
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Password-reset function called");
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    console.log("Environment variables check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey && supabaseServiceRoleKey.length > 20,
      hasResendKey: !!resendApiKey && resendApiKey.length > 10,
    });

    if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const resend = new Resend(resendApiKey);

    if (req.method === 'POST') {
      // Parse the request body
      const { email } = await req.json() as PasswordResetRequest;

      console.log(`Processing password reset for email: ${email}`);

      if (!email) {
        throw new Error('Missing required parameter: email');
      }

      try {
        // Check if user exists
        const { data: user, error: userError } = await supabaseAdmin.auth.admin.listUsers({
          filter: {
            email: email,
          }
        });

        if (userError) {
          console.error('Error checking user:', userError);
          // For security reasons, still send a success message even if user doesn't exist
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "If an account exists with this email, you'll receive a password reset link shortly" 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }

        // Check if user exists in the database
        if (!user || user.users.length === 0) {
          console.log(`No user found with email: ${email}`);
          // For security reasons, return success even if the user doesn't exist
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "If an account exists with this email, you'll receive a password reset link shortly" 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }

        // Get the base URL for the app
        const domain = req.url.includes('localhost') || req.url.includes('lovable.app') 
          ? new URL(req.url).origin 
          : 'https://smartbookly.com';
        console.log("Base URL for app:", domain);
        
        // Generate the password reset link
        console.log("Generating password reset link...");
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: {
            redirectTo: `${domain}/reset-password`,
          }
        });

        if (linkError) {
          console.error('Error generating password reset link:', linkError);
          throw linkError;
        }

        console.log("Password reset link generated successfully");
        const recoveryUrl = linkData?.properties?.action_link;
        console.log("Recovery URL:", recoveryUrl || "No recovery link provided");
        
        if (!recoveryUrl) {
          throw new Error('No recovery link was generated');
        }

        // Send the email using Resend
        console.log("Sending password reset email via Resend...");
        const emailResult = await resend.emails.send({
          from: 'SmartBookly <no-reply@smartbookly.com>',
          to: email,
          subject: 'Reset your SmartBookly password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Reset Your Password</h2>
              <p>We received a request to reset your password for your SmartBookly account.</p>
              <div style="margin: 30px 0;">
                <a href="${recoveryUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                  Reset Password
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #4f46e5;"><a href="${recoveryUrl}">${recoveryUrl}</a></p>
              <p>If you didn't request a password reset, you can ignore this email. Your password will not be changed.</p>
              <p>The password reset link will expire in 1 hour.</p>
              <hr style="margin: 30px 0; border: none; height: 1px; background-color: #eaeaea;">
              <p style="color: #6b7280; font-size: 14px;">© SmartBookly</p>
            </div>
          `,
        });
        
        console.log("Email sending result:", emailResult);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If an account exists with this email, you'll receive a password reset link shortly" 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } catch (error) {
        console.error('Error processing password reset:', error);
        // For security reasons, don't expose specific errors
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If an account exists with this email, you'll receive a password reset link shortly" 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }
  } catch (error) {
    console.error('Error in password-reset function:', error);
    
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
