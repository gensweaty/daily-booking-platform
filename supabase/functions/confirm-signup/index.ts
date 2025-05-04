
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

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
    console.log("Confirm signup function called");
    
    // Get the verification token from the query string
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      throw new Error('Missing verification token');
    }
    
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
    
    // Verify the token
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: 'signup',
    });

    if (error) {
      console.error('Error verifying token:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error.message 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log('User verified successfully:', data);
    
    // Redirect to dashboard
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Location": `${supabaseUrl.replace('.supabase.co', '')}/dashboard?verified=true`,
      },
      status: 302,
    });
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
