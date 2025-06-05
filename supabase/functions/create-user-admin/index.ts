
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    if (!resendApiKey) {
      throw new Error('Missing required environment variable RESEND_API_KEY');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const resend = new Resend(resendApiKey);

    if (req.method === 'POST') {
      // Parse the request body
      const { email, password, username } = await req.json() as CreateUserRequest;

      console.log(`Creating user with email ${email} and username ${username}`);

      if (!email || !password || !username) {
        throw new Error('Missing required parameters (email, password, or username)');
      }

      try {
        // Create the user with email confirmation disabled (we'll handle it manually)
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: false, // We'll send our own email using Resend
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

        console.log(`Successfully created user with ID ${data.user.id}`);

        // Create a 14-day trial subscription for the new user
        try {
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 14);

          const { error: subscriptionError } = await supabaseAdmin
            .from('subscriptions')
            .insert({
              user_id: data.user.id,
              email: email,
              status: 'trial',
              plan_type: 'monthly',
              trial_end_date: trialEndDate.toISOString(),
              current_period_start: new Date().toISOString(),
              current_period_end: trialEndDate.toISOString(),
              currency: 'usd',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (subscriptionError) {
            console.error('Error creating trial subscription:', subscriptionError);
            // Don't fail the user creation, but log the error
          } else {
            console.log('Trial subscription created successfully for user:', data.user.id);
          }
        } catch (trialError) {
          console.error('Error in trial subscription creation:', trialError);
          // Don't fail the user creation
        }

        // Get the base URL for the app
        const domain = req.url.includes('localhost') || req.url.includes('lovable.app') 
          ? new URL(req.url).origin 
          : 'https://smartbookly.com';
        console.log("Base URL for app:", domain);

        // Generate the verification link
        console.log("Generating confirmation email...");
        const { data: linkData, error: emailError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email,
          options: {
            redirectTo: `${domain}/dashboard?verified=true`,
          }
        });

        if (emailError) {
          console.error('Error generating confirmation email:', emailError);
          return new Response(
            JSON.stringify({
              success: false,
              message: "User created but failed to generate confirmation email",
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
        
        if (!actionUrl) {
          throw new Error('No verification link was generated');
        }

        // Send the email using Resend
        console.log("Sending email via Resend...");
        const emailResult = await resend.emails.send({
          from: 'SmartBookly <no-reply@smartbookly.com>',
          to: email,
          subject: 'Verify your SmartBookly account',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Welcome to SmartBookly!</h2>
              <p>Thank you for signing up. Please verify your email address to get started.</p>
              <div style="margin: 30px 0;">
                <a href="${actionUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                  Verify your email
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #4f46e5;"><a href="${actionUrl}">${actionUrl}</a></p>
              <p>If you didn't sign up for SmartBookly, you can ignore this email.</p>
              <hr style="margin: 30px 0; border: none; height: 1px; background-color: #eaeaea;">
              <p style="color: #6b7280; font-size: 14px;">© SmartBookly</p>
            </div>
          `,
        });
        
        console.log("Email sending result:", emailResult);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "User created successfully. Please check your email (including spam folder) for the verification link.",
            user: data.user
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
