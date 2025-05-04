
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
    
    // Test API key by listing API keys
    try {
      const apiKeysResponse = await resend.apiKeys.list();
      console.log("API keys list response:", apiKeysResponse);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Resend API key is valid",
          data: {
            keyInfo: {
              keyPrefix: maskedKey,
              apiKeyCount: apiKeysResponse.data?.length || 0
            }
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (resendError) {
      console.error("Error testing Resend API key:", resendError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to validate Resend API key",
          error: resendError?.message || "Unknown error"
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
