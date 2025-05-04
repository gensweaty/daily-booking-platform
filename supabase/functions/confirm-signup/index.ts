
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmSignupRequest {
  user_id: string;
  email: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      // Parse the request body
      const { user_id, email } = await req.json() as ConfirmSignupRequest;

      console.log(`Processing confirmation for user ${user_id} with email ${email}`);

      if (!user_id || !email) {
        throw new Error('Missing required parameters (user_id or email)');
      }

      // Update the user's email_confirmed_at field directly to bypass email verification
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { email_confirmed_at: new Date().toISOString() }
      );

      if (error) {
        console.error('Error confirming user email:', error);
        throw error;
      }

      console.log(`Successfully confirmed email for user ${user_id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Email confirmed successfully",
        user: data.user
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ 
        error: "Method not allowed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }
  } catch (error) {
    console.error('Error in confirm-signup function:', error);
    
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
