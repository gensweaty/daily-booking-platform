
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

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
    
    console.log("Environment variables check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey && supabaseServiceRoleKey.length > 20,
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
        // Create the user with email confirmation enabled
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: false, // We'll send confirmation email using the configured SMTP
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

        // Get the base URL for the app
        const baseUrl = new URL(req.url).origin;
        console.log("Base URL for app:", baseUrl);

        // Generate the verification email
        console.log("Generating confirmation email...");
        const { data: linkData, error: emailError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email,
          options: {
            // Use domain from request for redirect (works in both development and production)
            redirectTo: `${baseUrl}/dashboard?verified=true`,
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
