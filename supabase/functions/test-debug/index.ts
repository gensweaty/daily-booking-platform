
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔥 TEST FUNCTION INVOKED SUCCESSFULLY!");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  
  try {
    const body = await req.text();
    console.log("Body:", body);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test function working!",
        timestamp: new Date().toISOString(),
        body: body 
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      }
    );
  } catch (error) {
    console.error("Error in test function:", error);
    return new Response(
      JSON.stringify({ error: "Test function error" }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      }
    );
  }
};

serve(handler);
