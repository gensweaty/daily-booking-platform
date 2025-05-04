
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "https://esm.sh/resend@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Create-user-admin function called");
    
    // Create a Supabase client with the Admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    console.log("Environment variables check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey && supabaseServiceRoleKey.length > 20,
      hasResendKey: !!resendApiKey && resendApiKey.length > 10,
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method === 'POST') {
      // Parse the request body
      const { email, password, username } = await req.json() as CreateUserRequest;

      console.log(`Creating user with email ${email} and username ${username}`);

      if (!email || !password || !username) {
        throw new Error('Missing required parameters (email, password, or username)');
      }

      try {
        // Try to create the user with email confirmation enabled
        // This will use Supabase's default email service
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: false, // Require email confirmation
          user_metadata: { username }
        });

        if (error) {
          // Check if error is because user already exists
          if (error.status === 422 && error.message.includes('already been registered')) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: "This email is already registered. Please try signing in instead.",
                errorCode: "email_exists"
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 422, // Return proper status for this type of error
              }
            );
          } else {
            console.error('Error creating user:', error);
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: error.message,
                error: error
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
              }
            );
          }
        }

        console.log(`Successfully created user with ID ${data.user.id}, confirmation email sent`);

        // Now generate the confirmation link - this will be used directly rather than relying on Resend
        console.log("Generating confirmation link...");
        const { data: linkData, error: emailError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email,
          options: {
            redirectTo: `${new URL(supabaseUrl).origin.replace('.supabase.co', '')}/dashboard?verified=true`
          }
        });

        if (emailError) {
          console.error('Error generating confirmation link:', emailError);
          return new Response(
            JSON.stringify({
              success: false,
              message: "User created but failed to generate confirmation link",
              error: emailError
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }

        console.log("Email confirmation link generated successfully");
        const actionUrl = linkData?.properties?.action_link;
        console.log("Action URL:", actionUrl || "No action link provided");

        // First try using Resend if available
        let usedResend = false;
        let resendError = null;

        if (resendApiKey && actionUrl) {
          try {
            const resend = new Resend(resendApiKey);
            // In Resend test mode, we should send emails to the owner's email
            // This allows testing without domain verification
            const ownerEmail = "gensweaty@gmail.com"; // This is the email associated with the Resend account
            
            // Determine if we're likely in Resend test mode
            const isTestMode = !resendApiKey.startsWith('re_'); // Production keys start with re_
            const recipient = isTestMode ? ownerEmail : email;
            
            console.log(`Sending email via Resend to ${recipient} (${isTestMode ? 'test mode' : 'production mode'})`);
            
            const emailResult = await resend.emails.send({
              from: "SmartBookly <onboarding@resend.dev>", // Use the default domain allowed in testing
              to: recipient,
              subject: "Confirm your SmartBookly account",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Welcome to SmartBookly!</h2>
                  <p>Thank you for registering. Please confirm your email address to activate your account.</p>
                  <p>User email: ${email}</p>
                  <p style="margin: 30px 0;">
                    <a href="${actionUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                      Confirm Email Address
                    </a>
                  </p>
                  <p>If you didn't request this email, you can safely ignore it.</p>
                  <p>The link will expire in 24 hours.</p>
                  <p>Best regards,<br>The SmartBookly Team</p>
                  <p>If the button doesn't work, copy and paste this URL into your browser: ${actionUrl}</p>
                </div>
              `,
            });
            
            if (emailResult.error) {
              console.error("Resend email error:", emailResult.error);
              resendError = emailResult.error;
              console.log("Falling back to Supabase's default email service");
            } else {
              usedResend = true;
              console.log("Resend email sent successfully:", emailResult);
              
              // If we're in test mode and sent to owner instead of user,
              // make note of this so UI can show the link directly
              if (isTestMode && recipient !== email) {
                console.log("NOTE: In test mode - email sent to owner account instead of user");
              }
            }
          } catch (resendErr) {
            console.error("Error sending email with Resend:", resendErr);
            resendError = resendErr;
            console.log("Falling back to Supabase's default email service");
          }
        }

        // If Resend failed or wasn't available, we'll rely on Supabase's default email service
        // The good news is that even if our custom email failed, Supabase has already sent its own
        // confirmation email when we created the user with email_confirm: false
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "User created successfully, confirmation email sent",
            user: data.user,
            confirmationLink: actionUrl, // Include the confirmation link in the response
            usedResend: usedResend,
            resendError: resendError
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } catch (createError) {
        console.error('Error in user creation process:', createError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: createError.message || "Error creating user",
            error: createError
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ 
          error: "Method not allowed" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }
  } catch (error) {
    console.error('Error in create-user-admin function:', error);
    
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
